import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import usePetriStore from './store/usePetriStore';
import PlaceNode from './components/PlaceNode';
import TransitionNode from './components/TransitionNode';
import CustomEdge from './components/CustomEdge';
import Sidebar from './components/Sidebar';
import MarkingPanel from './components/MarkingPanel';
import CalculationPanel from './components/CalculationPanel';
import LegendNode from './components/LegendNode';
import './App.css';

const nodeTypes = {
  place: PlaceNode,
  transition: TransitionNode,
  legend: LegendNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

function Flow() {
  const nodes = usePetriStore((s) => s.nodes);
  const edges = usePetriStore((s) => s.edges);
  const setEdges = usePetriStore((s) => s.setEdges);
  const onNodesChange = usePetriStore((s) => s.onNodesChange);
  const mode = usePetriStore((s) => s.mode);
  const arcStart = usePetriStore((s) => s.arcStart);
  const setArcStart = usePetriStore((s) => s.setArcStart);
  const addPlace = usePetriStore((s) => s.addPlace);
  const addTransition = usePetriStore((s) => s.addTransition);
  const centerView = usePetriStore((s) => s.centerView);
  const setCenterView = usePetriStore((s) => s.setCenterView);
  const markingSequence = usePetriStore((s) => s.markingSequence);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [markingPanelOpen, setMarkingPanelOpen] = useState(false);

  // La creation d'arc se fait desormais au clic sur un point (handle)
  // precis d'une place ou d'une transition -- voir PlaceNode/TransitionNode
  // (store.selectHandle). Le clic sur le corps du noeud ne sert donc plus
  // qu'a l'ouverture de la modale de marquage (mode select).
  const onNodeClick = useCallback(() => {}, []);

  const onPaneClick = useCallback(
    (event) => {
      if (mode === 'arc') {
        setArcStart(null);
        return;
      }
      if (mode === 'execute' || mode === 'select') return;

      const bounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - 30,
        y: event.clientY - bounds.top - 30,
      };

      if (mode === 'place') {
        addPlace(position);
      } else if (mode === 'transition') {
        addTransition(position);
      }
    },
    [mode, addPlace, addTransition, setArcStart]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      const updated = [...edges];
      for (const change of changes) {
        if (change.type === 'remove') {
          const idx = updated.findIndex((e) => e.id === change.id);
          if (idx !== -1) updated.splice(idx, 1);
        }
      }
      setEdges(updated);
    },
    [edges, setEdges]
  );

  const modeLabel = {
    select: { text: 'Mode Selection', color: '#0f172a' },
    arc: { text: 'Mode Arc', color: '#6366f1' },
    execute: { text: 'Mode Execution', color: '#059669' },
  };

  const currentMode = modeLabel[mode] || modeLabel.select;

  const handleSidebarClose = () => setSidebarOpen(false);
  const handleMarkingClose = () => setMarkingPanelOpen(false);

  const isAnyDrawerOpen = sidebarOpen || markingPanelOpen;

  return (
    <div className={`app-container ${sidebarOpen ? 'sidebar-open' : ''} ${markingPanelOpen ? 'marking-panel-open' : ''}`}>
      {/* Mobile backdrop */}
      <div
        className={`mobile-backdrop ${isAnyDrawerOpen ? 'visible' : ''}`}
        onClick={() => { setSidebarOpen(false); setMarkingPanelOpen(false); }}
      />

      {/* Sidebar */}
      <Sidebar onClose={handleSidebarClose} />

      {/* Desktop toggle button */}
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title={sidebarOpen ? 'Masquer le panneau' : 'Afficher le panneau'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {sidebarOpen ? (
            <>
              <polyline points="15 18 9 12 15 6" />
            </>
          ) : (
            <>
              <polyline points="9 18 15 12 9 6" />
            </>
          )}
        </svg>
      </button>

      <div className="center-area">
        {/* Mobile top bar */}
        <div className="mobile-top-bar">
          <button
            className="mobile-hamburger"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="mobile-title">Reseau de Petri</span>
          <button
            className="mobile-marking-btn"
            onClick={() => setMarkingPanelOpen(!markingPanelOpen)}
            title="Marquages"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            {markingSequence.length > 0 && <span className="mobile-marking-badge" />}
          </button>
        </div>

        <div className="view-toggle">
          <button
            className={`toggle-btn ${centerView === 'project' ? 'active' : ''}`}
            onClick={() => setCenterView('project')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Projet
          </button>
          <button
            className={`toggle-btn ${centerView === 'calcul' ? 'active' : ''}`}
            onClick={() => setCenterView('calcul')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="8" y1="6" x2="16" y2="6" />
              <line x1="8" y1="10" x2="16" y2="10" />
              <line x1="8" y1="14" x2="12" y2="14" />
            </svg>
            Calculs
          </button>
        </div>

        {centerView === 'project' ? (
          <>
            <div
              className="mode-indicator"
              style={{ background: currentMode.color }}
            >
              {mode === 'arc' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="19" x2="19" y2="5" />
                  <polyline points="12 5 19 5 19 12" />
                </svg>
              )}
              {mode === 'execute' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              )}
              {mode === 'select' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              )}
              {currentMode.text}
              {mode === 'arc' && !arcStart && (
                <span> : Cliquez sur un point d'une place ou d'une transition</span>
              )}
              {mode === 'arc' && arcStart && (
                <span> : Point de depart choisi, cliquez sur un point de l'autre element</span>
              )}
              {mode === 'execute' && (
                <span> : Cliquez sur une transition verte</span>
              )}
            </div>

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              defaultEdgeOptions={{ type: 'custom' }}
              snapToGrid
              snapGrid={[15, 15]}
              deleteKeyCode={null}
              multiSelectionKeyCode="Shift"
              className={mode === 'arc' ? 'arc-mode' : ''}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
              <Controls position="bottom-right" />
              <MiniMap
                position="bottom-right"
                nodeColor={(n) => {
                  if (n.type === 'place') return '#e0e7ff';
                  if (n.type === 'legend') return '#fef3c7';
                  return '#fef3c7';
                }}
                style={{ marginBottom: 60 }}
              />
            </ReactFlow>
          </>
        ) : (
          <CalculationPanel />
        )}
      </div>
      <MarkingPanel onClose={handleMarkingClose} />
    </div>
  );
}

function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}

export default App;