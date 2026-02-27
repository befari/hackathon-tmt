import { Handle, Position } from '@xyflow/react';

const handleStyle = { width: 6, height: 6, background: '#555', border: '1px solid #888' };

/**
 * Standard connection handles for DFD nodes.
 * 4 handles per side (2 source + 2 target) at 30% and 70% offsets,
 * plus center handles for backward compatibility.
 */
export function NodeHandles() {
  return (
    <>
      {/* Top side */}
      <Handle type="source" position={Position.Top} id="top-src" style={{ ...handleStyle, left: '30%' }} />
      <Handle type="target" position={Position.Top} id="top-tgt" style={{ ...handleStyle, left: '70%' }} />
      <Handle type="source" position={Position.Top} id="top-src-2" style={{ ...handleStyle, left: '50%' }} />
      <Handle type="target" position={Position.Top} id="top-tgt-2" style={{ ...handleStyle, left: '50%' }} />

      {/* Bottom side */}
      <Handle type="source" position={Position.Bottom} id="bottom-src" style={{ ...handleStyle, left: '30%' }} />
      <Handle type="target" position={Position.Bottom} id="bottom-tgt" style={{ ...handleStyle, left: '70%' }} />
      <Handle type="source" position={Position.Bottom} id="bottom-src-2" style={{ ...handleStyle, left: '50%' }} />
      <Handle type="target" position={Position.Bottom} id="bottom-tgt-2" style={{ ...handleStyle, left: '50%' }} />

      {/* Left side */}
      <Handle type="source" position={Position.Left} id="left-src" style={{ ...handleStyle, top: '30%' }} />
      <Handle type="target" position={Position.Left} id="left-tgt" style={{ ...handleStyle, top: '70%' }} />
      <Handle type="source" position={Position.Left} id="left-src-2" style={{ ...handleStyle, top: '50%' }} />
      <Handle type="target" position={Position.Left} id="left-tgt-2" style={{ ...handleStyle, top: '50%' }} />

      {/* Right side */}
      <Handle type="source" position={Position.Right} id="right-src" style={{ ...handleStyle, top: '30%' }} />
      <Handle type="target" position={Position.Right} id="right-tgt" style={{ ...handleStyle, top: '70%' }} />
      <Handle type="source" position={Position.Right} id="right-src-2" style={{ ...handleStyle, top: '50%' }} />
      <Handle type="target" position={Position.Right} id="right-tgt-2" style={{ ...handleStyle, top: '50%' }} />
    </>
  );
}
