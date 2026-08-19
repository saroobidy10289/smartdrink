import { useState, useCallback } from 'react';
import usePetriStore from '../store/usePetriStore';

function MarkingModal({ nodeId, marking, onClose }) {
  const [value, setValue] = useState(String(marking));
  const updateMarking = usePetriStore((s) => s.updatePlaceMarking);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const num = parseInt(value);
    if (!isNaN(num) && num >= 0) {
      updateMarking(nodeId, num);
    }
    onClose();
  }, [value, nodeId, updateMarking, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Marquage Initial</h3>
        <form onSubmit={handleSubmit}>
          <label>
            Nombre de jetons :
            <input
              type="number"
              min={0}
              max={99}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              className="modal-input"
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn-confirm">
              Confirmer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MarkingModal;
