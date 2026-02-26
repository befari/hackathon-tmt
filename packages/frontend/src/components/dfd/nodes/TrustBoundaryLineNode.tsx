import { useCallback, useState } from 'react';
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react';
import { tokens, Text } from '@fluentui/react-components';

export function TrustBoundaryLineNode({ id, data, selected }: NodeProps) {
  const { setNodes } = useReactFlow();
  const [dragging, setDragging] = useState(false);
  const meta = (data as any).metadata || {};
  const lc = meta.lineCoords || {};

  // Absolute coordinates
  const sx = lc.sourceX || 0;
  const sy = lc.sourceY || 0;
  const tx = lc.targetX || 0;
  const ty = lc.targetY || 0;
  const hx = lc.handleX ?? (sx + tx) / 2;
  const hy = lc.handleY ?? (sy + ty) / 2;

  // The node is positioned at (posX, posY) by React Flow.
  const posX = hx || Math.min(sx, tx);
  const posY = Math.min(sy, ty);

  // Relative coordinates within the SVG
  const allX = [sx - posX, tx - posX, hx - posX, 0];
  const minRx = Math.min(...allX);
  const padding = 20;
  const offsetX = -minRx + padding;

  const rsx = sx - posX + offsetX;
  const rsy = sy - posY;
  const rtx = tx - posX + offsetX;
  const rty = ty - posY;
  const rhx = hx - posX + offsetX;
  const rhy = hy - posY;

  // Label position at the midpoint of the curve
  const labelX = rhx;
  const labelY = rhy;

  const color = tokens.colorPaletteRedBorder1;

  // Draggable bend handle
  const onHandleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      setDragging(true);

      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const startHx = hx;
      const startHy = hy;

      const onMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startClientX;
        const dy = e.clientY - startClientY;
        const newHx = startHx + dx;
        const newHy = startHy + dy;
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    metadata: {
                      ...(n.data as any).metadata,
                      lineCoords: {
                        ...(n.data as any).metadata?.lineCoords,
                        handleX: newHx,
                        handleY: newHy,
                      },
                    },
                  },
                }
              : n,
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
    [id, hx, hy, setNodes],
  );

  // Double-click to reset handle to midpoint
  const onHandleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      const midX = (sx + tx) / 2;
      const midY = (sy + ty) / 2;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  metadata: {
                    ...(n.data as any).metadata,
                    lineCoords: {
                      ...(n.data as any).metadata?.lineCoords,
                      handleX: midX,
                      handleY: midY,
                    },
                  },
                },
              }
            : n,
        ),
      );
    },
    [id, sx, sy, tx, ty, setNodes],
  );

  const handleSize = 8;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <NodeResizer isVisible={selected} minWidth={20} minHeight={60}
        handleStyle={{ backgroundColor: color, width: 7, height: 7 }} />
      <svg width="100%" height="100%" style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0 }}>
        <path
          d={`M ${rsx} ${rsy} Q ${rhx} ${rhy} ${rtx} ${rty}`}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeDasharray="8 5"
        />
        {/* Draggable bend handle — visible when selected */}
        {selected && (
          <circle
            cx={rhx}
            cy={rhy}
            r={handleSize}
            fill={dragging ? '#ff6b6b' : '#4a9eff'}
            stroke="#fff"
            strokeWidth={2}
            style={{ cursor: 'grab', pointerEvents: 'all' }}
            onMouseDown={onHandleMouseDown}
            onDoubleClick={onHandleDoubleClick}
          />
        )}
      </svg>
      <div style={{
        position: 'absolute',
        left: labelX,
        top: labelY,
        transform: 'rotate(-90deg)',
        transformOrigin: 'left top',
        whiteSpace: 'nowrap',
        color: tokens.colorPaletteRedForeground1,
      }}>
        <Text size={200} weight="semibold">
          {(data as any).label}
        </Text>
      </div>
    </div>
  );
}
