import { NodeResizer, type NodeProps } from '@xyflow/react';
import { tokens, Text } from '@fluentui/react-components';

export function TrustBoundaryLineNode({ data, selected }: NodeProps) {
  const meta = (data as any).metadata || {};
  const lc = meta.lineCoords || {};

  // Absolute coordinates
  const sx = lc.sourceX || 0;
  const sy = lc.sourceY || 0;
  const tx = lc.targetX || 0;
  const ty = lc.targetY || 0;
  const hx = lc.handleX || (sx + tx) / 2;
  const hy = lc.handleY || (sy + ty) / 2;

  // The node is positioned at (posX, posY) by React Flow.
  // We need to compute relative coords within the node's bounding box.
  // posX = handleX (or min of endpoints), posY = min(sy, ty)
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
