import { Handle, Position } from '@xyflow/react';

const handleStyle = {
  width: 8,
  height: 8,
  background: '#4a9eff',
  border: '2px solid #2d2d2d',
  borderRadius: '50%',
};

/**
 * 8 connection handles: 2 per side (at 33% and 66%).
 * All handles are type="source" with Loose connection mode
 * so any handle can connect to any other handle.
 */
export function NodeHandles() {
  return (
    <>
      <Handle type="source" position={Position.Top} id="t1" style={{ ...handleStyle, left: '33%' }} />
      <Handle type="source" position={Position.Top} id="t2" style={{ ...handleStyle, left: '66%' }} />
      <Handle type="source" position={Position.Bottom} id="b1" style={{ ...handleStyle, left: '33%' }} />
      <Handle type="source" position={Position.Bottom} id="b2" style={{ ...handleStyle, left: '66%' }} />
      <Handle type="source" position={Position.Left} id="l1" style={{ ...handleStyle, top: '33%' }} />
      <Handle type="source" position={Position.Left} id="l2" style={{ ...handleStyle, top: '66%' }} />
      <Handle type="source" position={Position.Right} id="r1" style={{ ...handleStyle, top: '33%' }} />
      <Handle type="source" position={Position.Right} id="r2" style={{ ...handleStyle, top: '66%' }} />
    </>
  );
}
