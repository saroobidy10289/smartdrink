import { useEffect, useRef } from 'react';
import usePetriStore from '../store/usePetriStore';

function MarkingPanel() {
  const markingSequence = usePetriStore((s) => s.markingSequence);
  const nodes = usePetriStore((s) => s.nodes);
  const listRef = useRef(null);

  const places = nodes
    .filter((n) => n.type === 'place')
    .sort((a, b) => a.data.label.localeCompare(b.data.label, undefined, { numeric: true }));

  const currentMarking = places.map((p) => ({
    label: p.data.label,
    marking: p.data.marking,
  }));

  const initialEntry = markingSequence.find((s) => s.step === 0);
  const initialMarking = initialEntry?.marking || [];

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [markingSequence.length]);

  if (places.length === 0) {
    return (
      <div className="marking-panel">
        <div className="panel-header">
          <h2>Marquages</h2>
          <p className="panel-subtitle">Sequence d'evolution</p>
        </div>
        <div className="panel-empty">
          <p>Aucune place definie.</p>
          <p className="help-text">Ajoutez des places pour voir les marquages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="marking-panel">
      <div className="panel-header">
        <h2>Marquages</h2>
        <p className="panel-subtitle">Sequence d'evolution</p>
      </div>

      <div className="panel-section">
        <h3>Marquage Initial M0</h3>
        <div className="marking-vector">
          {initialMarking.length > 0 ? (
            initialMarking.map((p) => (
              <span key={p.id} className="marking-chip">
                <span className="marking-place">{p.label}</span>
                <span className="marking-value">{p.marking}</span>
              </span>
            ))
          ) : (
            <span className="marking-empty">—</span>
          )}
        </div>
        <div className="marking-notation">
          M0 = ({initialMarking.map((p) => p.marking).join(', ') || '—'})
        </div>
      </div>

      <div className="panel-section">
        <h3>Marquage Actuel</h3>
        <div className="marking-vector current">
          {currentMarking.map((p) => {
            const init = initialMarking.find((i) => i.label === p.label);
            const changed = init && init.marking !== p.marking;
            return (
              <span key={p.label} className={`marking-chip ${changed ? 'changed' : ''}`}>
                <span className="marking-place">{p.label}</span>
                <span className="marking-value">{p.marking}</span>
              </span>
            );
          })}
        </div>
        <div className="marking-notation current">
          M = ({currentMarking.map((p) => p.marking).join(', ')})
        </div>
      </div>

      <div className="panel-section sequence-section">
        <h3>Sequence ({markingSequence.length} etats)</h3>
        <div className="sequence-list" ref={listRef}>
          {markingSequence.map((entry, idx) => {
            const isInitial = entry.step === 0;
            const isLast = idx === markingSequence.length - 1;
            return (
              <div key={idx} className="sequence-item">
                <div
                  className={`sequence-entry ${isInitial ? 'initial' : ''} ${isLast ? 'current' : ''}`}
                >
                  <div className="sequence-header">
                    <span className="sequence-step">M{entry.step}</span>
                    {!isInitial && (
                      <span className="sequence-transition">
                        {entry.transition}
                      </span>
                    )}
                    {isInitial && (
                      <span className="sequence-initial-tag">Initial</span>
                    )}
                  </div>
                  <div className="sequence-vector">
                    (
                    {entry.marking.map((p, i) => (
                      <span key={p.id}>
                        <span className="seq-place">{p.label}</span>
                        <span className="seq-val">{p.marking}</span>
                        {i < entry.marking.length - 1 && ', '}
                      </span>
                    ))}
                    )
                  </div>
                </div>
                {idx < markingSequence.length - 1 && (
                  <div className="sequence-arrow">
                    <div className="arrow-line" />
                    <svg className="arrow-head" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <polyline points="19 12 12 19 5 12" />
                    </svg>
                    <span className="arrow-label">{markingSequence[idx + 1]?.transition}</span>
                  </div>
                )}
              </div>
            );
          })}
          {markingSequence.length === 0 && (
            <div className="sequence-empty">
              Aucune evolution. Lancez une simulation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MarkingPanel;
