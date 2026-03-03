import { useCallback, useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

/** Clone state without selection/focus properties so undo only tracks real changes */
function cloneState(nodes: Node[], edges: Edge[]): Snapshot {
  return {
    nodes: nodes.map(({ selected, dragging, ...rest }) => ({ ...rest })) as Node[],
    edges: edges.map(({ selected, ...rest }) => ({ ...rest })) as Edge[],
  };
}

/** Check if two snapshots represent the same meaningful state */
function snapshotsEqual(a: Snapshot, b: Snapshot): boolean {
  if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false;
  // Quick check: compare positions and count
  for (let i = 0; i < a.nodes.length; i++) {
    const an = a.nodes[i], bn = b.nodes[i];
    if (an.id !== bn.id || an.position.x !== bn.position.x || an.position.y !== bn.position.y) return false;
    if (an.width !== bn.width || an.height !== bn.height) return false;
  }
  for (let i = 0; i < a.edges.length; i++) {
    const ae = a.edges[i], be = b.edges[i];
    if (ae.id !== be.id || ae.source !== be.source || ae.target !== be.target) return false;
    if ((ae.data as any)?.bendOffsetX !== (be.data as any)?.bendOffsetX) return false;
    if ((ae.data as any)?.bendOffsetY !== (be.data as any)?.bendOffsetY) return false;
  }
  return true;
}

/**
 * Simple undo/redo that works by saving snapshots of the full
 * nodes + edges state. Call `takeSnapshot` with current state
 * BEFORE making a mutation. Then `undo`/`redo` restore from history.
 *
 * Uses a version counter to force React re-renders when history changes.
 */
export function useUndoRedo() {
  const past = useRef<Snapshot[]>([]);
  const futur = useRef<Snapshot[]>([]);
  const isUndoRedoing = useRef(false);
  // Version counter forces re-render so canUndo/canRedo update
  const [, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  /** Call BEFORE a mutation with the current nodes/edges */
  const takeSnapshot = useCallback((nodes: Node[], edges: Edge[]) => {
    if (isUndoRedoing.current) return;
    const snap = cloneState(nodes, edges);
    // Don't record if nothing meaningful changed
    const last = past.current[past.current.length - 1];
    if (last && snapshotsEqual(last, snap)) return;
    past.current.push(snap);
    if (past.current.length > MAX_HISTORY) past.current.shift();
    futur.current = [];
    bump();
  }, []);

  const undo = useCallback(
    (
      currentNodes: Node[],
      currentEdges: Edge[],
      setNodes: (nodes: Node[]) => void,
      setEdges: (edges: Edge[]) => void,
    ) => {
      const prev = past.current.pop();
      if (!prev) return;
      isUndoRedoing.current = true;
      futur.current.push(cloneState(currentNodes, currentEdges));
      setNodes(prev.nodes);
      setEdges(prev.edges);
      // Reset flag after React processes the state update
      requestAnimationFrame(() => { isUndoRedoing.current = false; });
      bump();
    },
    [],
  );

  const redo = useCallback(
    (
      currentNodes: Node[],
      currentEdges: Edge[],
      setNodes: (nodes: Node[]) => void,
      setEdges: (edges: Edge[]) => void,
    ) => {
      const next = futur.current.pop();
      if (!next) return;
      isUndoRedoing.current = true;
      past.current.push(cloneState(currentNodes, currentEdges));
      setNodes(next.nodes);
      setEdges(next.edges);
      requestAnimationFrame(() => { isUndoRedoing.current = false; });
      bump();
    },
    [],
  );

  const canUndo = past.current.length > 0;
  const canRedo = futur.current.length > 0;

  return { takeSnapshot, undo, redo, canUndo, canRedo };
}
