import { useCallback, useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

function cloneState(nodes: Node[], edges: Edge[]): Snapshot {
  return {
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
  };
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
    past.current.push(cloneState(nodes, edges));
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
