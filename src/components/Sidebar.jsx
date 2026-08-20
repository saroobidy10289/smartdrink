import { useRef, useState } from 'react';
import usePetriStore from '../store/usePetriStore';
import { Circle, Minus, MousePointer, Trash2, RotateCcw, Play, Pause, SkipForward, Zap, Download, Upload, FlaskConical } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

function Sidebar({ onClose }) {
  const mode = usePetriStore((s) => s.mode);
  const setMode = usePetriStore((s) => s.setMode);
  const addPlace = usePetriStore((s) => s.addPlace);
  const addTransition = usePetriStore((s) => s.addTransition);
  const addLegend = usePetriStore((s) => s.addLegend);
  const clearAll = usePetriStore((s) => s.clearAll);
  const resetMarkings = usePetriStore((s) => s.resetMarkings);
  const nodes = usePetriStore((s) => s.nodes);
  const edges = usePetriStore((s) => s.edges);
  const simRunning = usePetriStore((s) => s.simRunning);
  const simSpeed = usePetriStore((s) => s.simSpeed);
  const startSimulation = usePetriStore((s) => s.startSimulation);
  const stopSimulation = usePetriStore((s) => s.stopSimulation);
  const stepSimulation = usePetriStore((s) => s.stepSimulation);
  const setSimSpeed = usePetriStore((s) => s.setSimSpeed);
  const history = usePetriStore((s) => s.history);
  const exportProject = usePetriStore((s) => s.exportProject);
  const importProject = usePetriStore((s) => s.importProject);
  const loadDemo = usePetriStore((s) => s.loadDemo);
  const fileInputRef = useRef(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const places = nodes.filter((n) => n.type === 'place');
  const transitions = nodes.filter((n) => n.type === 'transition');

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importProject(file);
    } catch (err) {
      alert('Erreur lors de l\'import : ' + err.message);
    }
    e.target.value = '';
  };

  const handleClearAll = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = () => {
    clearAll();
    setShowClearConfirm(false);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Reseau de Petri</h2>
        <p className="sidebar-subtitle">Editeur</p>
        <button className="mobile-close-btn" onClick={onClose} title="Fermer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="sidebar-section">
        <h3>Mode</h3>
        <button
          className={`tool-btn ${mode === 'select' ? 'active' : ''}`}
          onClick={() => setMode('select')}
          title="Selection / Edition"
        >
          <MousePointer size={18} />
          <span>Selection</span>
        </button>
        <button
          className={`tool-btn ${mode === 'arc' ? 'active' : ''}`}
          onClick={() => setMode('arc')}
          title="Connecter avec un arc"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="19" x2="19" y2="5" />
            <polyline points="12 5 19 5 19 12" />
          </svg>
          <span>Arc</span>
        </button>
        <button
          className={`tool-btn ${mode === 'execute' ? 'active execute' : ''}`}
          onClick={() => setMode('execute')}
          title="Mode Execution - cliquer pour tirer"
        >
          <Zap size={18} />
          <span>Execution</span>
        </button>
      </div>

      <div className="sidebar-section">
        <h3>Ajouter</h3>
        <button className="add-btn place-btn" onClick={() => addPlace()}>
          <Circle size={18} />
          <span>Place</span>
        </button>
        <button className="add-btn transition-btn" onClick={() => addTransition()}>
          <Minus size={18} />
          <span>Transition</span>
        </button>
        <button className="add-btn legend-btn" onClick={() => addLegend()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span>Legende</span>
        </button>
      </div>

      <div className="sidebar-section">
        <h3>Simulation</h3>
        <div className="sim-controls">
          <button
            className={`sim-btn ${simRunning ? 'running' : ''}`}
            onClick={() => (simRunning ? stopSimulation() : startSimulation())}
            title={simRunning ? 'Arreter' : 'Lancer'}
          >
            {simRunning ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            className="sim-btn"
            onClick={stepSimulation}
            title="Pas a pas"
            disabled={simRunning}
          >
            <SkipForward size={16} />
          </button>
          <button
            className="sim-btn"
            onClick={resetMarkings}
            title="Reinitialiser les marquages"
          >
            <RotateCcw size={16} />
          </button>
        </div>
        <div className="speed-control">
          <label>Vitesse : {simSpeed}ms</label>
          <input
            type="range"
            min={100}
            max={3000}
            step={100}
            value={simSpeed}
            onChange={(e) => setSimSpeed(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="sidebar-section">
        <h3>Projet</h3>
        <button className="action-btn" onClick={exportProject} title="Sauvegarder en JSON">
          <Download size={18} />
          <span>Sauvegarder</span>
        </button>
        <button className="action-btn" onClick={() => fileInputRef.current?.click()} title="Charger un JSON">
          <Upload size={18} />
          <span>Charger</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          style={{ display: 'none' }}
        />
        <button className="action-btn demo-btn" onClick={loadDemo} title="Charger le projet exemple">
          <FlaskConical size={18} />
          <span>Projet Demo</span>
        </button>
        <button className="action-btn danger" onClick={handleClearAll} title="Supprimer tout">
          <Trash2 size={18} />
          <span>Supprimer</span>
        </button>
      </div>

      <div className="sidebar-section stats">
        <h3>Statistiques</h3>
        <div className="stat-row">
          <span>Places :</span>
          <span className="stat-value">{places.length}</span>
        </div>
        <div className="stat-row">
          <span>Transitions :</span>
          <span className="stat-value">{transitions.length}</span>
        </div>
        <div className="stat-row">
          <span>Arcs :</span>
          <span className="stat-value">{edges.length}</span>
        </div>
        <div className="stat-row">
          <span>Jetons totaux :</span>
          <span className="stat-value">
            {places.reduce((sum, p) => sum + (p.data.marking || 0), 0)}
          </span>
        </div>
      </div>

      {history.length > 0 && (
        <div className="sidebar-section history">
          <h3>Historique ({history.length} pas)</h3>
          <div className="history-list">
            {history.slice(-10).reverse().map((h) => (
              <div key={h.step} className="history-item">
                <span className="history-step">#{h.step}</span>
                <span className="history-transition">{h.transition}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        <p className="help-text">
          {mode === 'execute'
            ? "Cliquez sur une transition verte pour la tirer"
            : mode === 'arc'
            ? "Cliquez source puis cible, ou glissez entre 2 noeuds"
            : "Glissez depuis un point bleu/orange pour creer un arc"}
        </p>
        <p className="help-text">
          Double-cliquez sur un nom pour le modifier
        </p>
      </div>

      {showClearConfirm && (
        <ConfirmModal
          title="Supprimer le projet"
          message="Toutes les places, transitions et arcs seront definitivement supprimes. Cette action est irreversible."
          onConfirm={confirmClearAll}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}

export default Sidebar;
