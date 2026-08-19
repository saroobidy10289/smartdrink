import { memo, useState, useCallback, useRef, useMemo, Fragment } from 'react';
import { Handle, Position } from '@xyflow/react';
import usePetriStore from '../store/usePetriStore';

const HANDLE_COUNT = 8;

function TransitionNode({ id, data, selected }) {
  const [editing, setEditing] = useState(false);
  const [labelValue, setLabelValue] = useState(data.label);
  const [rotating, setRotating] = useState(false);
  const updateLabel = usePetriStore((s) => s.updateNodeLabel);
  const updateRotation = usePetriStore((s) => s.updateNodeRotation);
  const deleteNode = usePetriStore((s) => s.deleteNode);
  const mode = usePetriStore((s) => s.mode);
  const arcStart = usePetriStore((s) => s.arcStart);
  const selectHandle = usePetriStore((s) => s.selectHandle);
  const fireTransition = usePetriStore((s) => s.fireTransition);
  const firingTransition = usePetriStore((s) => s.firingTransition);
  const nodes = usePetriStore((s) => s.nodes);
  const edges = usePetriStore((s) => s.edges);
  const nodeRef = useRef(null);
  const rotation = data.rotation || 0;

  // 6 points partages (source + cible) repartis 3 a gauche / 3 a droite
  // de la barre, regulierement espaces verticalement.
  const handlePoints = useMemo(() => {
    const pts = [];
    const perSide = HANDLE_COUNT / 2;
    for (let i = 0; i < perSide; i++) {
      const y = 5 + (i + 0.5) * (50 / perSide);
      pts.push({ id: `h-${i}`, x: 24, y });
    }
    for (let i = 0; i < perSide; i++) {
      const y = 5 + (i + 0.5) * (50 / perSide);
      pts.push({ id: `h-${perSide + i}`, x: 36, y });
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

  const enabled = (() => {
    const inputEdges = edges.filter((e) => e.target === id);
    if (inputEdges.length === 0) return true;
    return inputEdges.every((edge) => {
      const place = nodes.find((n) => n.id === edge.source);
      if (!place || place.type !== 'place') return false;
      return place.data.marking >= (edge.data?.weight || 1);
    });
  })();

  const isFiring = firingTransition === id;

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

  const handleRotationStart = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();
      setRotating(true);

      const handleEl = e.currentTarget;
      const handleRect = handleEl.getBoundingClientRect();
      const cx = handleRect.left + handleRect.width / 2;
      const cy = handleRect.top + handleRect.height / 2;
      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
      const startRotation = rotation;

      const onMove = (moveEvent) => {
        const angle = Math.atan2(moveEvent.clientY - cy, moveEvent.clientX - cx);
        const delta = ((angle - startAngle) * 180) / Math.PI;
        updateRotation(id, Math.round(startRotation + delta));
      };

      const onUp = () => {
        setRotating(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [id, rotation, updateRotation]
  );

  const [shaking, setShaking] = useState(false);

  const handleClick = useCallback(
    (e) => {
      if (mode !== 'execute') return;
      e.stopPropagation();
      if (enabled) {
        fireTransition(id);
      } else {
        setShaking(true);
        setTimeout(() => setShaking(false), 500);
      }
    },
    [mode, enabled, id, fireTransition]
  );

  const classes = [
    'transition-node',
    selected ? 'selected' : '',
    rotating ? 'rotating' : '',
    mode === 'execute' ? 'execute-mode' : '',
    enabled ? 'enabled' : '',
    isFiring ? 'firing' : '',
    shaking ? 'shake' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={nodeRef}
      className={classes}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {handlePoints.map((h) => {
        const used = isUsed(h.id);
        const isChosen = arcStart?.nodeId === id && arcStart?.handleId === h.id;
        const cls = [
          'handle-transition',
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

      {selected && mode === 'select' && (
        <div
          className={`rotation-handle nodrag ${rotating ? 'active' : ''}`}
          onMouseDown={handleRotationStart}
          onPointerDown={handleRotationStart}
          title="Glisser pour pivoter"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6" />
            <path d="M21.34 13.5A10 10 0 0 1 12 22a9.96 9.96 0 0 1-7.07-2.93" />
            <path d="M2.66 13.5A10 10 0 0 1 12 2a9.96 9.96 0 0 1 7.07 2.93" />
          </svg>
        </div>
      )}

      <div className="rotation-wrapper" style={{ transform: `rotate(${-rotation}deg)` }}>
        <div className="transition-bar-wrapper" onClick={handleClick}>
          <div
            className="transition-bar"
            style={{ borderColor: selected ? '#6366f1' : '#475569' }}
          />
          {mode === 'execute' && enabled && (
            <div className="enabled-indicator" title="Transition activable - cliquer pour tirer">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
          )}
        </div>

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
            className="node-label transition-label nodrag nopan"
            onPointerDown={handleLabelPointerDown}
            title="Double-cliquer pour renommer"
          >
            {data.label}
          </div>
        )}
      </div>

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
    </div>
  );
}

export default memo(TransitionNode);