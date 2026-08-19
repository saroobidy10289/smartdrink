import { memo, useState, useCallback, useRef, useMemo, Fragment } from 'react';
import { Handle, Position } from '@xyflow/react';
import usePetriStore from '../store/usePetriStore';
import MarkingModal from './MarkingModal';

const HANDLE_COUNT = 8;
const RADIUS = 30; // distance du centre (cercle a r=27)

function PlaceNode({ id, data, selected }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [labelValue, setLabelValue] = useState(data.label);
  const updateLabel = usePetriStore((s) => s.updateNodeLabel);
  const deleteNode = usePetriStore((s) => s.deleteNode);
  const mode = usePetriStore((s) => s.mode);
  const arcStart = usePetriStore((s) => s.arcStart);
  const selectHandle = usePetriStore((s) => s.selectHandle);
  const edges = usePetriStore((s) => s.edges);

  // 6 points regulierement espaces (tous les 60 degres) autour du cercle.
  // Chaque point sert a la fois de source ET de cible : un seul jeu de
  // points, partage pour les deux sens d'arc.
  const handlePoints = useMemo(() => {
    const pts = [];
    for (let i = 0; i < HANDLE_COUNT; i++) {
      const angle = ((-90 + i * (360 / HANDLE_COUNT)) * Math.PI) / 180;
      pts.push({
        id: `h-${i}`,
        x: 30 + RADIUS * Math.cos(angle),
        y: 30 + RADIUS * Math.sin(angle),
      });
    }
    return pts;
  }, []);

  const isUsed = useCallback(
    (handleId) =>
      edges.some(
        (e) =>
          (e.source === id && e.sourceHandle === handleId) ||
          (e.target === id && e.targetHandle === handleId)
      ),
    [edges, id]
  );

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (mode === 'select') {
        setShowModal(true);
      }
    },
    [mode]
  );

  const lastPointerDown = useRef(0);

  const handleLabelPointerDown = useCallback(
    (e) => {
      const now = Date.now();
      if (now - lastPointerDown.current < 350) {
        e.stopPropagation();
        setEditing(true);
        setLabelValue(data.label);
      }
      lastPointerDown.current = now;
    },
    [data.label]
  );

  const handleLabelBlur = useCallback(() => {
    setEditing(false);
    if (labelValue.trim()) {
      updateLabel(id, labelValue.trim());
    }
  }, [labelValue, id, updateLabel]);

  const handleLabelKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.target.blur();
      } else if (e.key === 'Escape') {
        setEditing(false);
        setLabelValue(data.label);
      }
    },
    [data.label]
  );

  const renderTokens = () => {
    const tokens = [];
    for (let i = 0; i < data.marking; i++) {
      const angle = (2 * Math.PI * i) / Math.max(data.marking, 1);
      const r = data.marking === 1 ? 0 : 14;
      const cx = 30 + r * Math.cos(angle);
      const cy = 30 + r * Math.sin(angle);
      tokens.push(<circle key={i} cx={cx} cy={cy} r={4} fill="#1e293b" />);
    }
    return tokens;
  };

  return (
    <div className={`place-node ${selected ? 'selected' : ''}`}>
      {handlePoints.map((h) => {
        const used = isUsed(h.id);
        const isChosen = arcStart?.nodeId === id && arcStart?.handleId === h.id;
        const cls = [
          'handle-place',
          mode === 'arc' ? 'arc-active' : '',
          used ? 'used' : '',
          isChosen ? 'chosen' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const style = { left: h.x, top: h.y, transform: 'translate(-50%,-50%)' };
        const onPointClick = (e) => {
          e.stopPropagation();
          if (mode !== 'arc' || used) return;
          selectHandle(id, h.id);
        };
        return (
          <Fragment key={h.id}>
            <Handle
              type="source"
              position={Position.Top}
              className={cls}
              id={h.id}
              style={{ ...style, pointerEvents: 'none' }}
              isConnectable={false}
            />
            <Handle
              type="target"
              position={Position.Top}
              className={cls}
              id={h.id}
              style={{ ...style, pointerEvents: 'none' }}
              isConnectable={false}
            />
            <div
              className="handle-click-zone"
              style={{ ...style, position: 'absolute', width: 16, height: 16, cursor: mode === 'arc' && !used ? 'pointer' : 'default', zIndex: 10 }}
              onClick={onPointClick}
            />
          </Fragment>
        );
      })}

      <svg width={60} height={60} onClick={handleClick} style={{ cursor: 'pointer' }}>
        <circle
          cx={30}
          cy={30}
          r={27}
          fill="white"
          stroke={selected ? '#6366f1' : '#475569'}
          strokeWidth={selected ? 3 : 2}
        />
        {renderTokens()}
      </svg>

      {editing ? (
        <input
          className="inline-editor"
          value={labelValue}
          onChange={(e) => setLabelValue(e.target.value)}
          onBlur={handleLabelBlur}
          onKeyDown={handleLabelKeyDown}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className="node-label place-label nodrag nopan"
          onPointerDown={handleLabelPointerDown}
          title="Double-cliquer pour renommer"
        >
          {data.label}
        </div>
      )}

      {mode === 'select' && (
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            deleteNode(id);
          }}
          title="Supprimer"
        >
          ×
        </button>
      )}

      {showModal && (
        <MarkingModal nodeId={id} marking={data.marking} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

export default memo(PlaceNode);