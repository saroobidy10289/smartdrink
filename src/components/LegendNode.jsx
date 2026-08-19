import { memo, useState, useCallback, useEffect } from 'react';
import usePetriStore from '../store/usePetriStore';

function LegendNode({ id, data, selected }) {
  const [editing, setEditing] = useState(!data.text);
  const [textValue, setTextValue] = useState(data.text || '');
  const updateLegendText = usePetriStore((s) => s.updateLegendText);
  const deleteNode = usePetriStore((s) => s.deleteNode);

  useEffect(() => {
    setTextValue(data.text || '');
  }, [data.text]);

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      setEditing(true);
      setTextValue(data.text || '');
    },
    [data.text]
  );

  const handleLabelBlur = useCallback(() => {
    setEditing(false);
    if (textValue.trim()) {
      updateLegendText(id, textValue.trim());
    }
  }, [textValue, id, updateLegendText]);

  const handleLabelKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.target.blur();
      } else if (e.key === 'Escape') {
        setEditing(false);
        setTextValue(data.text || '');
      }
    },
    [data.text]
  );

  return (
    <div
      className={`legend-node ${selected ? 'selected' : ''} ${editing ? 'nodrag' : ''}`}
      style={{ minWidth: 120, minHeight: 40 }}
    >
      {editing ? (
        <textarea
          className="legend-editor"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={handleLabelBlur}
          onKeyDown={handleLabelKeyDown}
          autoFocus
          placeholder="Saisir votre texte..."
          rows={3}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className="legend-text nodrag nopan"
          onClick={handleClick}
          title="Cliquer pour editer"
        >
          {data.text || 'Legende...'}
        </div>
      )}
      {selected && (
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            deleteNode(id);
          }}
          title="Supprimer"
        >
          x
        </button>
      )}
    </div>
  );
}

export default memo(LegendNode);
