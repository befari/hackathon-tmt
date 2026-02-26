import { useCallback, useState } from 'react';
import {
  BaseEdge,
  getStraightPath,
  type EdgeProps,
  useReactFlow,
} from '@xyflow/react';
import { useTakeSnapshot } from '../UndoRedoContext';

/**
 * Custom edge with a draggable bend point.
 * The bend creates a quadratic bezier curve through the control point.
 */
export function BendableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  style,
  data,
  selected,
  ...props
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const takeSnapshot = useTakeSnapshot();
  const [dragging, setDragging] = useState(false);

  // Get bend offset from edge data, default to midpoint (0,0 offset)
  const bendOffsetX = (data as any)?.bendOffsetX || 0;
  const bendOffsetY = (data as any)?.bendOffsetY || 0;

  // Control point is midpoint + offset
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const cpX = midX + bendOffsetX;
  const cpY = midY + bendOffsetY;

  // If no bend, use straight path
  const hasBend = Math.abs(bendOffsetX) > 2 || Math.abs(bendOffsetY) > 2;

  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (hasBend) {
    edgePath = `M ${sourceX} ${sourceY} Q ${cpX} ${cpY} ${targetX} ${targetY}`;
    // Label at the curve's midpoint (t=0.5 on quadratic bezier)
    labelX = 0.25 * sourceX + 0.5 * cpX + 0.25 * targetX;
    labelY = 0.25 * sourceY + 0.5 * cpY + 0.25 * targetY;
  } else {
    const [path, lx, ly] = getStraightPath({ sourceX, sourceY, targetX, targetY });
    edgePath = path;
    labelX = lx;
    labelY = ly;
  }

  const onMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      takeSnapshot();
      setDragging(true);

      const startX = event.clientX;
      const startY = event.clientY;
      const startOffsetX = bendOffsetX;
      const startOffsetY = bendOffsetY;

      const onMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        setEdges((eds) =>
          eds.map((edge) =>
            edge.id === id
              ? {
                  ...edge,
                  data: {
                    ...edge.data,
                    bendOffsetX: startOffsetX + dx,
                    bendOffsetY: startOffsetY + dy,
                  },
                }
              : edge,
          ),
        );
      };

      const onMouseUp = () => {
        setDragging(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [id, bendOffsetX, bendOffsetY, setEdges, takeSnapshot],
  );

  // Double-click to reset bend
  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      takeSnapshot();
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === id
            ? { ...edge, data: { ...edge.data, bendOffsetX: 0, bendOffsetY: 0 } }
            : edge,
        ),
      );
    },
    [id, setEdges, takeSnapshot],
  );

  const handleSize = 8;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        interactionWidth={20}
        {...props}
      />
      {/* Label */}
      {label && (
        <foreignObject
          x={labelX - 50}
          y={labelY - 10}
          width={100}
          height={20}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div
            style={{
              fontSize: 11,
              textAlign: 'center',
              color: '#ccc',
              backgroundColor: 'rgba(30,30,30,0.8)',
              padding: '1px 4px',
              borderRadius: 3,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {label as string}
          </div>
        </foreignObject>
      )}
      {/* Draggable bend handle — visible when edge is selected */}
      {selected && (
        <circle
          cx={cpX}
          cy={cpY}
          r={handleSize}
          fill={dragging ? '#ff6b6b' : '#4a9eff'}
          stroke="#fff"
          strokeWidth={2}
          style={{ cursor: 'grab', pointerEvents: 'all' }}
          onMouseDown={onMouseDown}
          onDoubleClick={onDoubleClick}
        />
      )}
    </>
  );
}
