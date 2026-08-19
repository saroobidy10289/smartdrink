import { create } from 'zustand';

const STORAGE_KEY = 'petri-net-state';
const HANDLE_COUNT = 8;

// Un point de connexion valide ressemble a "h-0" .. "h-5"
function isValidHandleId(raw) {
  if (typeof raw !== 'string') return false;
  const m = raw.match(/^h-(\d)$/);
  if (!m) return false;
  const n = Number(m[1]);
  return n >= 0 && n < HANDLE_COUNT;
}

function migrateHandle(raw, fallbackIndex) {
  if (isValidHandleId(raw)) return raw;
  return `h-${fallbackIndex % HANDLE_COUNT}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const nodes = saved.nodes || [];
      const edges = (saved.edges || []).map((e, i) => ({
        ...e,
        sourceHandle: migrateHandle(e.sourceHandle, i * 2),
        targetHandle: migrateHandle(e.targetHandle, i * 2 + 1),
      }));
      return { nodes, edges };
    }
  } catch {}
  return { nodes: [], edges: [] };
}

function saveState(nodes, edges) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
  } catch {}
}

let nodeId = 0;
let edgeId = 0;

function rebuildIds(nodes, edges) {
  let maxN = 0;
  let maxE = 0;
  nodes.forEach((n) => {
    const num = parseInt(n.id.split('_')[1]);
    if (num > maxN) maxN = num;
  });
  edges.forEach((e) => {
    const num = parseInt(e.id.split('_')[1]);
    if (num > maxE) maxE = num;
  });
  nodeId = maxN;
  edgeId = maxE;
}

const saved = loadState();
rebuildIds(saved.nodes, saved.edges);

const getId = () => `node_${++nodeId}`;
const getEdgeId = () => `edge_${++edgeId}`;

function persist(state) {
  saveState(state.nodes, state.edges);
}

function captureMarking(nodes) {
  const places = nodes
    .filter((n) => n.type === 'place')
    .sort((a, b) => a.data.label.localeCompare(b.data.label, undefined, { numeric: true }));
  return places.map((p) => ({
    id: p.id,
    label: p.data.label,
    marking: p.data.marking,
  }));
}

// Un point (handle) d'un noeud est "libre" tant qu'aucun arc existant
// ne l'utilise deja, que ce soit en tant que source ou en tant que cible.
// => 2 arcs ne peuvent jamais partager le meme point sur un meme noeud.
function isHandleFree(edges, nodeId, handleId) {
  return !edges.some(
    (e) =>
      (e.source === nodeId && e.sourceHandle === handleId) ||
      (e.target === nodeId && e.targetHandle === handleId)
  );
}

const usePetriStore = create((set, get) => ({
  nodes: saved.nodes,
  edges: saved.edges,
  mode: 'select',
  arcStart: null, // { nodeId, handleId } | null
  simRunning: false,
  simSpeed: 1000,
  simIntervalId: null,
  firingTransition: null,
  history: [],
  markingSequence: [],
  centerView: 'project',

  setNodes: (nodes) => {
    set({ nodes });
    persist({ nodes, edges: get().edges });
  },
  setEdges: (edges) => {
    set({ edges });
    persist({ nodes: get().nodes, edges });
  },
  setMode: (mode) => {
    const st = get();
    if (mode !== 'execute' && st.simRunning) {
      st.stopSimulation();
    }
    set({ mode, arcStart: null });
  },
  setArcStart: (payload) => set({ arcStart: payload }),
  setCenterView: (view) => set({ centerView: view }),

  onNodesChange: (changes) => {
    set((state) => {
      const updated = applyChanges(state.nodes, changes);
      persist({ nodes: updated, edges: state.edges });
      return { nodes: updated };
    });
  },

  addPlace: (position) => {
    const id = getId();
    const count = get().nodes.filter((n) => n.type === 'place').length + 1;
    set((state) => {
      const nodes = [
        ...state.nodes,
        {
          id,
          type: 'place',
          position: position || { x: 250 + count * 30, y: 150 + count * 30 },
          data: { label: `P${count}`, marking: 0, initialMarking: 0 },
        },
      ];
      persist({ nodes, edges: state.edges });
      return { nodes };
    });
  },

  addTransition: (position) => {
    const id = getId();
    const count = get().nodes.filter((n) => n.type === 'transition').length + 1;
    set((state) => {
      const nodes = [
        ...state.nodes,
        {
          id,
          type: 'transition',
          position: position || { x: 350 + count * 30, y: 200 + count * 30 },
          data: { label: `T${count}`, rotation: 0 },
        },
      ];
      persist({ nodes, edges: state.edges });
      return { nodes };
    });
  },

  addLegend: (position) => {
    const id = getId();
    const count = get().nodes.filter((n) => n.type === 'legend').length + 1;
    set((state) => {
      const nodes = [
        ...state.nodes,
        {
          id,
          type: 'legend',
          position: position || { x: 100 + count * 30, y: 100 + count * 30 },
          data: { text: 'Legende' },
        },
      ];
      persist({ nodes, edges: state.edges });
      return { nodes };
    });
  },

  updateLegendText: (nodeId, text) => {
    set((state) => {
      const nodes = state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, text } } : n
      );
      persist({ nodes, edges: state.edges });
      return { nodes };
    });
  },

  deleteNode: (nodeId) => {
    set((state) => {
      const nodes = state.nodes.filter((n) => n.id !== nodeId);
      const edges = state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      );
      persist({ nodes, edges });
      return { nodes, edges };
    });
  },

  // Verifie si un point precis (nodeId + handleId) est encore disponible.
  isHandleFree: (nodeId, handleId) => {
    const state = get();
    return isHandleFree(state.edges, nodeId, handleId);
  },

  // Appele quand l'utilisateur clique sur UN point precis d'une place ou
  // d'une transition en mode "arc". Le premier clic choisit le point de
  // depart, le second choisit le point d'arrivee et cree l'arc entre les
  // deux points exacts choisis (la fleche se dessine donc sur le dernier
  // point clique, cote cible).
  selectHandle: (nodeId, handleId) => {
    const state = get();
    if (state.mode !== 'arc') return;
    if (!isHandleFree(state.edges, nodeId, handleId)) return;

    if (!state.arcStart) {
      set({ arcStart: { nodeId, handleId } });
      return;
    }

    // Reclic sur le meme noeud : on remplace simplement le point de depart
    if (state.arcStart.nodeId === nodeId) {
      set({ arcStart: { nodeId, handleId } });
      return;
    }

    const { nodeId: startNode, handleId: startHandle } = state.arcStart;
    state.addArc(startNode, startHandle, nodeId, handleId);
    set({ arcStart: null });
  },

  // Cree un arc entre un point de depart precis et un point d'arrivee
  // precis. Retourne true si l'arc a bien ete cree.
  addArc: (source, sourceHandle, target, targetHandle) => {
    const state = get();
    const sourceNode = state.nodes.find((n) => n.id === source);
    const targetNode = state.nodes.find((n) => n.id === target);
    if (!sourceNode || !targetNode) return false;
    if (!isValidHandleId(sourceHandle) || !isValidHandleId(targetHandle)) return false;

    const isPlaceToTransition =
      sourceNode.type === 'place' && targetNode.type === 'transition';
    const isTransitionToPlace =
      sourceNode.type === 'transition' && targetNode.type === 'place';
    if (!isPlaceToTransition && !isTransitionToPlace) return false;

    if (!isHandleFree(state.edges, source, sourceHandle)) return false;
    if (!isHandleFree(state.edges, target, targetHandle)) return false;

    const exists = state.edges.some(
      (e) => e.source === source && e.target === target
    );
    if (exists) return false;

    const id = getEdgeId();
    set((s) => {
      const edges = [
        ...s.edges,
        {
          id,
          source,
          target,
          sourceHandle,
          targetHandle,
          type: 'custom',
          data: { weight: 1 },
          animated: false,
        },
      ];
      persist({ nodes: s.nodes, edges });
      return { edges };
    });
    return true;
  },

  updateNodeLabel: (nodeId, label) => {
    set((state) => {
      const nodes = state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label } } : n
      );
      persist({ nodes, edges: state.edges });
      return { nodes };
    });
  },

  updatePlaceMarking: (nodeId, marking) => {
    set((state) => {
      const nodes = state.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: { ...n.data, marking: Number(marking), initialMarking: Number(marking) },
            }
          : n
      );
      persist({ nodes, edges: state.edges });
      return { nodes };
    });
  },

  updateNodeRotation: (nodeId, rotation) => {
    set((state) => {
      const nodes = state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, rotation: rotation % 360 } }
          : n
      );
      persist({ nodes, edges: state.edges });
      return { nodes };
    });
  },

  updateEdgeWeight: (edgeId, weight) => {
    set((state) => {
      const edges = state.edges.map((e) =>
        e.id === edgeId
          ? { ...e, data: { ...e.data, weight: Number(weight) } }
          : e
      );
      persist({ nodes: state.nodes, edges });
      return { edges };
    });
  },

  updateEdgeControlPoints: (edgeId, cp1, cp2) => {
    set((state) => {
      const edges = state.edges.map((e) =>
        e.id === edgeId
          ? { ...e, data: { ...e.data, cp1, cp2 } }
          : e
      );
      persist({ nodes: state.nodes, edges });
      return { edges };
    });
  },

  deleteEdge: (edgeId) => {
    set((state) => {
      const edges = state.edges.filter((e) => e.id !== edgeId);
      persist({ nodes: state.nodes, edges });
      return { edges };
    });
  },

  clearAll: () => {
    nodeId = 0;
    edgeId = 0;
    const st = get();
    if (st.simRunning) st.stopSimulation();
    set({ nodes: [], edges: [], arcStart: null, history: [], markingSequence: [] });
    persist({ nodes: [], edges: [] });
  },

  exportProject: () => {
    const state = get();
    const data = {
      version: 1,
      name: 'Reseau de Petri',
      date: new Date().toISOString(),
      nodes: state.nodes,
      edges: state.edges,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `petri-net-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importProject: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.nodes || !data.edges) throw new Error('Format invalide');
          const st = get();
          if (st.simRunning) st.stopSimulation();
          let maxN = 0;
          let maxE = 0;
          data.nodes.forEach((n) => {
            const num = parseInt(n.id.split('_')[1]);
            if (num > maxN) maxN = num;
          });
          data.edges.forEach((ed) => {
            const num = parseInt(ed.id.split('_')[1]);
            if (num > maxE) maxE = num;
          });
          nodeId = maxN;
          edgeId = maxE;
          const initialMarking = captureMarking(data.nodes);
          const edgesWithHandles = data.edges.map((ed, i) => ({
            ...ed,
            sourceHandle: migrateHandle(ed.sourceHandle, i * 2),
            targetHandle: migrateHandle(ed.targetHandle, i * 2 + 1),
          }));
          set({
            nodes: data.nodes,
            edges: edgesWithHandles,
            arcStart: null,
            history: [],
            markingSequence: [{ step: 0, transition: '(initial)', marking: initialMarking }],
          });
          persist({ nodes: data.nodes, edges: edgesWithHandles });
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Erreur de lecture'));
      reader.readAsText(file);
    });
  },

  loadDemo: () => {
    const st = get();
    if (st.simRunning) st.stopSimulation();
    nodeId = 8;
    edgeId = 9;

    const demoNodes = [
      { id: 'node_1', type: 'place', position: { x: 120, y: 180 }, data: { label: 'P1', marking: 2, initialMarking: 2 } },
      { id: 'node_2', type: 'place', position: { x: 420, y: 180 }, data: { label: 'P2', marking: 0, initialMarking: 0 } },
      { id: 'node_3', type: 'place', position: { x: 420, y: 420 }, data: { label: 'P3', marking: 0, initialMarking: 0 } },
      { id: 'node_4', type: 'place', position: { x: 120, y: 420 }, data: { label: 'P4', marking: 1, initialMarking: 1 } },
      { id: 'node_5', type: 'transition', position: { x: 270, y: 175 }, data: { label: 'T1', rotation: 0 } },
      { id: 'node_6', type: 'transition', position: { x: 420, y: 295 }, data: { label: 'T2', rotation: 0 } },
      { id: 'node_7', type: 'transition', position: { x: 270, y: 415 }, data: { label: 'T3', rotation: 0 } },
      { id: 'node_8', type: 'transition', position: { x: 120, y: 295 }, data: { label: 'T4', rotation: 0 } },
    ];

    // Chaque noeud est touche 2 fois (une fois source, une fois cible) :
    // on lui attribue donc 2 points distincts (h-0 et h-1) pour respecter
    // la regle "un point = un seul arc".
    const demoEdges = [
      { id: 'edge_1', source: 'node_1', target: 'node_5', sourceHandle: 'h-0', targetHandle: 'h-0', type: 'custom', data: { weight: 1 }, animated: false },
      { id: 'edge_2', source: 'node_5', target: 'node_2', sourceHandle: 'h-1', targetHandle: 'h-0', type: 'custom', data: { weight: 1 }, animated: false },
      { id: 'edge_3', source: 'node_2', target: 'node_6', sourceHandle: 'h-1', targetHandle: 'h-0', type: 'custom', data: { weight: 1 }, animated: false },
      { id: 'edge_4', source: 'node_6', target: 'node_3', sourceHandle: 'h-1', targetHandle: 'h-0', type: 'custom', data: { weight: 1 }, animated: false },
      { id: 'edge_5', source: 'node_3', target: 'node_7', sourceHandle: 'h-1', targetHandle: 'h-0', type: 'custom', data: { weight: 1 }, animated: false },
      { id: 'edge_6', source: 'node_7', target: 'node_4', sourceHandle: 'h-1', targetHandle: 'h-0', type: 'custom', data: { weight: 1 }, animated: false },
      { id: 'edge_7', source: 'node_4', target: 'node_8', sourceHandle: 'h-1', targetHandle: 'h-0', type: 'custom', data: { weight: 1 }, animated: false },
      { id: 'edge_8', source: 'node_8', target: 'node_1', sourceHandle: 'h-1', targetHandle: 'h-1', type: 'custom', data: { weight: 1 }, animated: false },
    ];

    const initialMarking = captureMarking(demoNodes);

    set({
      nodes: demoNodes,
      edges: demoEdges,
      arcStart: null,
      history: [],
      markingSequence: [{ step: 0, transition: '(initial)', marking: initialMarking }],
    });
    persist({ nodes: demoNodes, edges: demoEdges });
  },

  resetMarkings: () => {
    set((state) => {
      const nodes = state.nodes.map((n) =>
        n.type === 'place'
          ? { ...n, data: { ...n.data, marking: n.data.initialMarking } }
          : n
      );
      const initialMarking = captureMarking(nodes);
      persist({ nodes, edges: state.edges });
      return {
        nodes,
        history: [],
        markingSequence: [{ step: 0, transition: '(initial)', marking: initialMarking }],
      };
    });
  },

  // === Simulation ===
  isTransitionEnabled: (transitionId) => {
    const state = get();
    const edges = state.edges;
    const nodes = state.nodes;

    const inputEdges = edges.filter((e) => e.target === transitionId);
    if (inputEdges.length === 0) return true;

    return inputEdges.every((edge) => {
      const place = nodes.find((n) => n.id === edge.source);
      if (!place || place.type !== 'place') return false;
      return place.data.marking >= (edge.data?.weight || 1);
    });
  },

  getEnabledTransitions: () => {
    const state = get();
    return state.nodes
      .filter((n) => n.type === 'transition')
      .filter((t) => state.isTransitionEnabled(t.id))
      .sort((a, b) => a.data.label.localeCompare(b.data.label, undefined, { numeric: true }));
  },

  fireTransition: (transitionId) => {
    const state = get();
    if (!state.isTransitionEnabled(transitionId)) return false;

    const inputEdges = state.edges.filter((e) => e.target === transitionId);
    const outputEdges = state.edges.filter((e) => e.source === transitionId);

    set((prev) => {
      let nodes = prev.nodes.map((n) => n);

      inputEdges.forEach((edge) => {
        const weight = edge.data?.weight || 1;
        nodes = nodes.map((n) =>
          n.id === edge.source
            ? { ...n, data: { ...n.data, marking: n.data.marking - weight } }
            : n
        );
      });

      outputEdges.forEach((edge) => {
        const weight = edge.data?.weight || 1;
        nodes = nodes.map((n) =>
          n.id === edge.target
            ? { ...n, data: { ...n.data, marking: n.data.marking + weight } }
            : n
        );
      });

      const transitionLabel =
        nodes.find((n) => n.id === transitionId)?.data?.label || transitionId;

      persist({ nodes, edges: prev.edges });

      const markingSnapshot = captureMarking(nodes);
      const newSequence = [
        ...prev.markingSequence,
        {
          step: prev.markingSequence.length,
          transition: transitionLabel,
          marking: markingSnapshot,
        },
      ];

      return {
        nodes,
        firingTransition: transitionId,
        history: [...prev.history, { step: prev.history.length + 1, transition: transitionLabel }],
        markingSequence: newSequence,
      };
    });

    setTimeout(() => set({ firingTransition: null }), 400);
    return true;
  },

  startSimulation: () => {
    const state = get();
    if (state.simRunning) return;

    const id = setInterval(() => {
      const s = get();
      const enabled = s.getEnabledTransitions();
      if (enabled.length > 0) {
        s.fireTransition(enabled[0].id);
      } else {
        s.stopSimulation();
      }
    }, state.simSpeed);

    set({ simRunning: true, simIntervalId: id, mode: 'execute' });
  },

  stopSimulation: () => {
    const st = get();
    if (st.simIntervalId) clearInterval(st.simIntervalId);
    set({ simRunning: false, simIntervalId: null });
  },

  setSimSpeed: (speed) => {
    const st = get();
    set({ simSpeed: speed });
    if (st.simRunning) {
      st.stopSimulation();
      get().startSimulation();
    }
  },

  stepSimulation: () => {
    const state = get();
    const enabled = state.getEnabledTransitions();
    if (enabled.length > 0) {
      state.fireTransition(enabled[0].id);
    }
  },
}));

function applyChanges(nodes, changes) {
  let result = [...nodes];
  for (const change of changes) {
    if (change.type === 'position' && change.position) {
      result = result.map((n) =>
        n.id === change.id ? { ...n, position: change.position } : n
      );
    } else if (change.type === 'remove') {
      result = result.filter((n) => n.id !== change.id);
    } else if (change.type === 'select') {
      result = result.map((n) =>
        n.id === change.id ? { ...n, selected: change.selected } : n
      );
    }
  }
  return result;
}

export default usePetriStore;