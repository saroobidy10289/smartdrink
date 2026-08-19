import { memo, useState, useCallback, useMemo, useRef } from 'react';
import { EdgeLabelRenderer } from '@xyflow/react';
import usePetriStore from '../store/usePetriStore';

function ControlPoint({ x, y, onDrag }) {
  const dragRef = useRef(null);

  const onPointerDown = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        onDrag(ev.clientX, ev.clientY);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onDrag]
  );

  return (
    <circle
      ref={dragRef}
      cx={x}
      cy={y}
      r={7}
      fill="white"
      stroke="#6366f1"
      strokeWidth={2}
      style={{ cursor: 'grab', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))' }}
      onPointerDown={onPointerDown}
    />
  );
}

function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}) {
  const [editing, setEditing] = useState(false);
  const [weightValue, setWeightValue] = useState(String(data?.weight || 1));
  const updateEdgeWeight = usePetriStore((s) => s.updateEdgeWeight);
  const updateEdgeControlPoints = usePetriStore((s) => s.updateEdgeControlPoints);
  const deleteEdge = usePetriStore((s) => s.deleteEdge);

  const defaultCp1 = useMemo(() => ({
    x: sourceX + (targetX - sourceX) * 0.25,
    y: sourceY + (targetY - sourceY) * 0.25,
  }), [sourceX, sourceY, targetX, targetY]);

  const defaultCp2 = useMemo(() => ({
    x: sourceX + (targetX - sourceX) * 0.75,
    y: sourceY + (targetY - sourceY) * 0.75,
  }), [sourceX, sourceY, targetX, targetY]);

  const cp1 = data?.cp1 || defaultCp1;
  const cp2 = data?.cp2 || defaultCp2;

  const curvedPath = useMemo(() => {
    return `M ${sourceX} ${sourceY} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${targetX} ${targetY}`;
  }, [sourceX, sourceY, cp1.x, cp1.y, cp2.x, cp2.y, targetX, targetY]);

  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const svgRef = useRef(null);

  const screenToSvg = useCallback((clientX, clientY) => {
    const svg = svgRef.current?.closest('.react-flow__pane');
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    const viewport = svg.querySelector('.react-flow__viewport');
    if (!viewport) return { x: clientX, y: clientY };
    const transform = viewport.style.transform;
    const match = transform?.match(/translate\(([^,]+)px,\s*([^)]+)px\)\s*scale\(([^)]+)\)/);
    if (!match) return { x: clientX, y: clientY };
    const tx = parseFloat(match[1]);
    const ty = parseFloat(match[2]);
    const scale = parseFloat(match[3]);
    return {
      x: (clientX - rect.left - tx) / scale,
      y: (clientY - rect.top - ty) / scale,
    };
  }, []);

  const onDragCp1 = useCallback(
    (clientX, clientY) => {
      const pos = screenToSvg(clientX, clientY);
      updateEdgeControlPoints(id, pos, cp2);
    },
    [id, cp2, screenToSvg, updateEdgeControlPoints]
  );

  const onDragCp2 = useCallback(
    (clientX, clientY) => {
      const pos = screenToSvg(clientX, clientY);
      updateEdgeControlPoints(id, cp1, pos);
    },
    [id, cp1, screenToSvg, updateEdgeControlPoints]
  );

  const handleLabelDoubleClick = useCallback((e) => {
    e.stopPropagation();
    setEditing(true);
    setWeightValue(String(data?.weight || 1));
  }, [data?.weight]);

  const handleLabelBlur = useCallback(() => {
    setEditing(false);
    const val = parseInt(weightValue);
    if (val > 0) {
      updateEdgeWeight(id, val);
    }
  }, [weightValue, id, updateEdgeWeight]);

  const handleLabelKeyDown = useCallback((e) => {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') {
      setEditing(false);
      setWeightValue(String(data?.weight || 1));
    }
  }, [data?.weight]);

  const weight = data?.weight || 1;
  const markerId = `arrow-${id}`;

  return (
    <>
      <svg ref={svgRef} style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 12 12"
            refX="11"
            refY="6"
            markerWidth="10"
            markerHeight="10"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 0 L 12 6 L 0 12 z"
              fill={selected ? '#6366f1' : '#94a3b8'}
            />
          </marker>
        </defs>
      </svg>

      <path
        d={curvedPath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
      />
      <path
        d={curvedPath}
        fill="none"
        stroke={selected ? '#6366f1' : '#94a3b8'}
        strokeWidth={selected ? 3 : 2}
        markerEnd={`url(#${markerId})`}
        style={{ pointerEvents: 'none' }}
      />

      {selected && (
        <>
          <path
            d={curvedPath}
            fill="none"
            stroke="#6366f1"
            strokeWidth={1}
            strokeDasharray="5 5"
            opacity={0.4}
            style={{ pointerEvents: 'none' }}
          />
          <line
            x1={sourceX} y1={sourceY}
            x2={cp1.x} y2={cp1.y}
            stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3"
            style={{ pointerEvents: 'none' }}
          />
          <line
            x1={targetX} y1={targetY}
            x2={cp2.x} y2={cp2.y}
            stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3"
            style={{ pointerEvents: 'none' }}
          />
          <ControlPoint x={cp1.x} y={cp1.y} onDrag={onDragCp1} />
          <ControlPoint x={cp2.x} y={cp2.y} onDrag={onDragCp2} />
        </>
      )}

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${midX}px,${midY}px)`,
            pointerEvents: 'all',
          }}
          className="edge-label-wrapper"
        >
          {editing ? (
            <input
              className="edge-weight-editor"
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
              onBlur={handleLabelBlur}
              onKeyDown={handleLabelKeyDown}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              type="number"
              min={1}
            />
          ) : (
            <div
              className={`edge-weight ${selected ? 'selected' : ''}`}
              onDoubleClick={handleLabelDoubleClick}
              title="Double-cliquer pour modifier le poids"
            >
              {weight > 1 ? weight : ''}
            </div>
          )}
          <button
            className="edge-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              deleteEdge(id);
            }}
            title="Supprimer l'arc"
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(CustomEdge);
