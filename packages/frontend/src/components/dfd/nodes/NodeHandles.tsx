import { Handle, Position } from '@xyflow/react';

const handleStyle = { width: 6, height: 6, background: '#555', border: '1px solid #888' };

const sides = [
  { pos: Position.Top, axis: 'left' as const, id: 'top' },
  { pos: Position.Bottom, axis: 'left' as const, id: 'bottom' },
  { pos: Position.Left, axis: 'top' as const, id: 'left' },
  { pos: Position.Right, axis: 'top' as const, id: 'right' },
];
const offsets = ['25%', '50%', '75%'];

/**
 * Standard connection handles for DFD nodes.
 * 3 handles per side at 25%, 50%, 75% positions.
 * Each handle can be both a connection start and end point.
 */
export function NodeHandles() {
  return (
    <>
      {sides.map(({ pos, axis, id }) =>
        offsets.map((offset, i) => (
          <Handle
            key={`${id}-${i}`}
            type="source"
            position={pos}
            id={`${id}-${i}`}
            isConnectableStart
            isConnectableEnd
            style={{ ...handleStyle, [axis]: offset }}
          />
        ))
      )}
    </>
  );
}
