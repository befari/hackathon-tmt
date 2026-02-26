import { useCallback, useState } from 'react';
import { useReactFlow, type NodeProps } from '@xyflow/react';
import { tokens, Text } from '@fluentui/react-components';

type DragTarget = 'source' | 'target' | 'handle';

export function TrustBoundaryLineNode({ id, data, selected }: NodeProps) {
  const { setNodes } = useReactFlow();
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
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

  const labelX = rhx;
  const labelY = rhy;

  const color = tokens.colorPaletteRedBorder1;

  const startDrag = useCallback(
    (target: DragTarget, event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      setDragTarget(target);

      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const startVals = { sx, sy, tx, ty, hx, hy };

      const onMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startClientX;
        const dy = e.clientY - startClientY;
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== id) return n;
            const curLc = (n.data as any).metadata?.lineCoords || {};
            const updated = { ...curLc };
            if (target === 'source') {
              updated.sourceX = startVals.sx + dx;
              updated.sourceY = startVals.sy + dy;
            } else if (target === 'target') {
              updated.targetX = startVals.tx + dx;
              updated.targetY = startVals.ty + dy;
            } else {
              updated.handleX = startVals.hx + dx;
              updated.handleY = startVals.hy + dy;
            }
            // Recompute node position and size from new coords
            const nsx = updated.sourceX || 0, nsy = updated.sourceY || 0;
            const ntx = updated.targetX || 0, nty = updated.targetY || 0;
            const nhx = updated.handleX ?? (nsx + ntx) / 2;
            const newPosX = nhx || Math.min(nsx, ntx);
            const newPosY = Math.min(nsy, nty);
            const nAllX = [nsx - newPosX, ntx - newPosX, nhx - newPosX, 0];
            const nMinRx = Math.min(...nAllX);
            const nMaxRx = Math.max(...nAllX);
            return {
              ...n,
              position: { x: newPosX, y: newPosY },
              style: {
                ...(n.style || {}),
                width: Math.max(nMaxRx - nMinRx + 40, 40),
                height: Math.abs(nty - nsy) || 400,
              },
              data: {
                ...n.data,
                metadata: { ...(n.data as any).metadata, lineCoords: updated },
              },
            };
          }),
        );
      };

      const onMouseUp = () => {
        setDragTarget(null);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [id, sx, sy, tx, ty, hx, hy, setNodes],
  );

  // Double-click bend handle to reset to midpoint
  const onHandleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const curLc = (n.data as any).metadata?.lineCoords || {};
          const midX = ((curLc.sourceX || 0) + (curLc.targetX || 0)) / 2;
          const midY = ((curLc.sourceY || 0) + (curLc.targetY || 0)) / 2;
          const updated = { ...curLc, handleX: midX, handleY: midY };
          const nsx = updated.sourceX || 0, nsy = updated.sourceY || 0;
          const ntx = updated.targetX || 0, nty = updated.targetY || 0;
          const newPosX = midX || Math.min(nsx, ntx);
          const newPosY = Math.min(nsy, nty);
          const nAllX = [nsx - newPosX, ntx - newPosX, midX - newPosX, 0];
          const nMinRx = Math.min(...nAllX);
          const nMaxRx = Math.max(...nAllX);
          return {
            ...n,
            position: { x: newPosX, y: newPosY },
            style: {
              ...(n.style || {}),
              width: Math.max(nMaxRx - nMinRx + 40, 40),
              height: Math.abs(nty - nsy) || 400,
            },
            data: { ...n.data, metadata: { ...(n.data as any).metadata, lineCoords: updated } },
          };
        }),
      );
    },
    [id, setNodes],
  );

  const ptSize = 6;
  const bendSize = 8;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg width="100%" height="100%" style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0 }}>
        <path
          d={`M ${rsx} ${rsy} Q ${rhx} ${rhy} ${rtx} ${rty}`}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeDasharray="8 5"
        />
        {/* Endpoint and bend handles — visible when selected */}
        {selected && (
          <>
            {/* Source endpoint */}
            <circle
              cx={rsx} cy={rsy} r={ptSize}
              fill={dragTarget === 'source' ? '#ff6b6b' : color}
              stroke="#fff" strokeWidth={2}
              style={{ cursor: 'grab', pointerEvents: 'all' }}
              onMouseDown={(e) => startDrag('source', e)}
            />
            {/* Target endpoint */}
            <circle
              cx={rtx} cy={rty} r={ptSize}
              fill={dragTarget === 'target' ? '#ff6b6b' : color}
              stroke="#fff" strokeWidth={2}
              style={{ cursor: 'grab', pointerEvents: 'all' }}
              onMouseDown={(e) => startDrag('target', e)}
            />
            {/* Bend control point */}
            <circle
              cx={rhx} cy={rhy} r={bendSize}
              fill={dragTarget === 'handle' ? '#ff6b6b' : '#4a9eff'}
              stroke="#fff" strokeWidth={2}
              style={{ cursor: 'grab', pointerEvents: 'all' }}
              onMouseDown={(e) => startDrag('handle', e)}
              onDoubleClick={onHandleDoubleClick}
            />
          </>
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
        pointerEvents: 'none',
      }}>
        <Text size={200} weight="semibold">
          {(data as any).label}
        </Text>
      </div>
    </div>
  );
}
