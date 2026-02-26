import { useCallback, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

export function useUndoRedo() {
  const history = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const skipNextRef = useRef(false);

  const takeSnapshot = useCallback((nodes: Node[], edges: Edge[]) => {
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }
    history.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
    if (history.current.length > MAX_HISTORY) {
      history.current.shift();
    }
    // Any new action clears the redo stack
    future.current = [];
  }, []);

  const undo = useCallback(
    (
      currentNodes: Node[],
      currentEdges: Edge[],
      setNodes: (nodes: Node[]) => void,
      setEdges: (edges: Edge[]) => void,
    ) => {
      const prev = history.current.pop();
      if (!prev) return;
      // Save current state to future for redo
      future.current.push({
        nodes: JSON.parse(JSON.stringify(currentNodes)),
        edges: JSON.parse(JSON.stringify(currentEdges)),
      });
      skipNextRef.current = true;
      setNodes(prev.nodes);
      setEdges(prev.edges);
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
      const next = future.current.pop();
      if (!next) return;
      // Save current state to history for undo
      history.current.push({
        nodes: JSON.parse(JSON.stringify(currentNodes)),
        edges: JSON.parse(JSON.stringify(currentEdges)),
      });
      skipNextRef.current = true;
      setNodes(next.nodes);
      setEdges(next.edges);
    },
    [],
  );

  const canUndo = useCallback(() => history.current.length > 0, []);
  const canRedo = useCallback(() => future.current.length > 0, []);

  return { takeSnapshot, undo, redo, canUndo, canRedo };
}
