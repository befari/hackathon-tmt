import { useCallback, useEffect, useState, useRef, type DragEvent, type KeyboardEvent } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  Panel,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './dfd-dark.css';
import { useUndoRedo } from './useUndoRedo';
import { UndoRedoContext } from './UndoRedoContext';
import {
  makeStyles,
  tokens,
  Text,
  Spinner,
  Button,
  TabList,
  Tab,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Input,
  Textarea,
  Badge,
  Divider,
  Dropdown,
  Option,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Tooltip,
} from '@fluentui/react-components';
import {
  ArrowUpload20Regular,
  Add16Regular,
  Comment20Regular,
  Dismiss16Regular,
  ShieldTask20Regular,
  ArrowUndo20Regular,
  ArrowRedo20Regular,
  Save20Regular,
  Checkmark20Regular,
  Delete16Regular,
  MoreHorizontal20Regular,
  ZoomIn20Regular,
  ZoomOut20Regular,
  ZoomFitRegular,
  LockClosed20Regular,
  LockOpen20Regular,
} from '@fluentui/react-icons';
import { ProcessNode } from './nodes/ProcessNode';
import { DataStoreNode } from './nodes/DataStoreNode';
import { ExternalEntityNode } from './nodes/ExternalEntityNode';
import { TrustBoundaryNode } from './nodes/TrustBoundaryNode';
import { TrustBoundaryLineNode } from './nodes/TrustBoundaryLineNode';
import { TextAnnotationNode } from './nodes/TextAnnotationNode';
import { ComponentPalette } from './ComponentPalette';
import { PropertyPanel } from './PropertyPanel';
import { AIRatingWidget } from './AIRatingWidget';
import { ShareDialog } from '../sharing/ShareDialog';
import { BendableEdge } from './edges/BendableEdge';
import { api } from '../../api/client';
import type { Diagram, Component, DataFlow, Comment as TmtComment } from '@superior-tmt/shared';

const nodeTypes = {
  process: ProcessNode,
  dataStore: DataStoreNode,
  externalEntity: ExternalEntityNode,
  trustBoundary: TrustBoundaryNode,
  trustBoundaryLine: TrustBoundaryLineNode,
  textAnnotation: TextAnnotationNode,
};

const edgeTypes = {
  bendable: BendableEdge,
};

const useStyles = makeStyles({
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
    overflow: 'hidden' as const,
  },
  container: {
    width: '100%',
    flex: 1,
    minHeight: 0,
  },
  panel: {
    backgroundColor: tokens.colorNeutralBackground3,
    padding: '12px 16px',
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '12px',
  },
  nodeActionBar: {
    position: 'absolute' as const,
    zIndex: 10,
    display: 'flex',
    gap: '4px',
    padding: '4px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow16,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    pointerEvents: 'auto' as const,
  },
  nodeActionBarWrapper: {
    position: 'absolute' as const,
    zIndex: 10,
    pointerEvents: 'none' as const,
  },
  commentPanel: {
    position: 'absolute' as const,
    zIndex: 10,
    width: '340px',
    maxHeight: '420px',
    overflowY: 'auto' as const,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow16,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    padding: '16px',
  },
  commentThread: {
    marginBottom: '10px',
    padding: '8px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
  },
  commentMeta: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    opacity: 0.7,
  },
  commentBody: {
    marginTop: '4px',
  },
  reply: {
    marginLeft: '12px',
    marginTop: '6px',
    paddingLeft: '8px',
    borderLeft: `2px solid ${tokens.colorNeutralStroke2}`,
  },
});

function componentTypeToNodeType(type: string): string {
  const map: Record<string, string> = {
    PROCESS: 'process',
    DATA_STORE: 'dataStore',
    EXTERNAL_ENTITY: 'externalEntity',
    TRUST_BOUNDARY: 'trustBoundary',
  };
  return map[type] || 'process';
}

/**
 * Maps TMT PortSource/PortTarget names to React Flow handle IDs.
 * TMT ports: East, West, North, South, NorthWest, SouthWest, NorthEast, SouthEast, Auto
 */
function portToHandle(port: string, suffix: 'src' | 'tgt'): string | undefined {
  if (!port || port === 'Auto' || port === 'AutoFix') return undefined;
  const p = port.toLowerCase();
  if (p.includes('east') && !p.includes('north') && !p.includes('south')) return `right-${suffix}`;
  if (p.includes('west') && !p.includes('north') && !p.includes('south')) return `left-${suffix}`;
  if (p.includes('north')) return `top-${suffix}`;
  if (p.includes('south')) return `bottom-${suffix}`;
  return undefined;
}

function diagramToNodesAndEdges(
  diagram: Diagram | undefined,
  commentCounts: Record<string, number>,
) {
  if (!diagram) return { flowNodes: [] as Node[], flowEdges: [] as Edge[] };

  const flowNodes: Node[] = (diagram.components || []).map((comp: Component) => {
    const isBoundary = comp.type === 'TRUST_BOUNDARY';
    const meta = (comp as any).metadata || {};
    const isLineBoundary = meta.boundaryStyle === 'line';
    // Detect text annotations: External Entities with long names (>100 chars) or marked as annotation
    const isAnnotation = meta.isAnnotation || (comp.type === 'EXTERNAL_ENTITY' && comp.name.length > 100);

    let nodeType: string;
    if (isAnnotation) {
      nodeType = 'textAnnotation';
    } else if (isBoundary && isLineBoundary) {
      nodeType = 'trustBoundaryLine';
    } else {
      nodeType = componentTypeToNodeType(comp.type);
    }

    // Apply stored width/height to all nodes that have metadata
    const nodeStyle: Record<string, any> = {};
    if (isLineBoundary && meta.lineCoords) {
      const lc = meta.lineCoords;
      const sx = lc.sourceX || 0;
      const sy = lc.sourceY || 0;
      const tx = lc.targetX || 0;
      const ty = lc.targetY || 0;
      const hx = lc.handleX || (sx + tx) / 2;
      // Node is positioned at (posX, posY) = (handleX or min(sx,tx), min(sy,ty))
      const posX = comp.positionX;
      const posY = comp.positionY;
      // Width must contain all three x-coords relative to posX
      const allX = [sx - posX, tx - posX, hx - posX, 0];
      const minRx = Math.min(...allX);
      const maxRx = Math.max(...allX);
      nodeStyle.width = Math.max(maxRx - minRx + 40, 40);
      nodeStyle.height = Math.abs(ty - sy) || 400;
    } else if (meta.width && meta.height) {
      nodeStyle.width = meta.width;
      nodeStyle.height = meta.height;
    }

    // Smaller boundaries get higher zIndex so nested ones are clickable
    let zIndex = 1;
    if (isBoundary) {
      const area = (meta.width || 200) * (meta.height || 100);
      // Invert: smaller area → higher (less negative) zIndex, range roughly -100 to -1
      zIndex = -Math.max(1, Math.min(100, Math.round(area / 5000)));
    } else if (isAnnotation) {
      zIndex = -1;
    }

    return {
      id: comp.id,
      type: nodeType,
      position: { x: comp.positionX, y: comp.positionY },
      zIndex,
      ...(Object.keys(nodeStyle).length > 0 ? { style: nodeStyle } : {}),
      data: {
        label: comp.name,
        description: comp.description,
        sourceFiles: comp.sourceFiles,
        componentType: comp.type,
        metadata: meta,
        commentCount: commentCounts[comp.id] || 0,
      },
    };
  });

  const flowEdges: Edge[] = (diagram.dataFlows || []).map((flow: DataFlow) => {
    const meta = (flow as any).metadata || {};
    const sourceHandle = portToHandle(meta.portSource, 'src');
    const targetHandle = portToHandle(meta.portTarget, 'tgt');
    return {
      id: flow.id,
      type: 'bendable',
      source: flow.sourceId,
      target: flow.targetId,
      ...(sourceHandle ? { sourceHandle } : {}),
      ...(targetHandle ? { targetHandle } : {}),
      label: flow.label,
      animated: flow.crossesTrustBoundary,
      style: {
        stroke: flow.crossesTrustBoundary ? '#e74c3c' : '#6c757d',
        strokeWidth: 2,
      },
      labelStyle: { fontSize: 11 },
      data: {
        protocol: flow.protocol || '',
        dataClassification: flow.dataClassification || '',
      },
    };
  });

  return { flowNodes, flowEdges };
}

export function DfdCanvas() {
  const styles = useStyles();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [modelName, setModelName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [aiGenerationId, setAiGenerationId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(null);
  const [newDiagramDialogOpen, setNewDiagramDialogOpen] = useState(false);
  const [newDiagramName, setNewDiagramName] = useState('');
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const { takeSnapshot, undo, redo, canUndo, canRedo } = useUndoRedo();
  const reactFlowRef = useRef<any>(null);
  const [locked, setLocked] = useState(false);
  const MAX_VISIBLE_TABS = 8;

  // Refs to always have latest state (avoids stale closures in callbacks)
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  // Stable snapshot function for child components via context
  const takeSnapshotNow = useCallback(() => {
    takeSnapshot(nodesRef.current, edgesRef.current);
  }, [takeSnapshot]);

  // Node action bar / comment panel state
  const [actionNode, setActionNode] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [commentPanelNode, setCommentPanelNode] = useState<{ nodeId: string; label: string; x: number; y: number } | null>(null);
  const [nodeComments, setNodeComments] = useState<TmtComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Selection & property panel state
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [threatDialogOpen, setThreatDialogOpen] = useState(false);
  const [threatComponentId, setThreatComponentId] = useState<string | null>(null);
  const [threatComponentName, setThreatComponentName] = useState('');
  const [newThreat, setNewThreat] = useState({ title: '', description: '', strideCategory: 'SPOOFING', severity: 'MEDIUM' });
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showDiagramPanel, setShowDiagramPanel] = useState(false);
  const [deleteDiagramDialogOpen, setDeleteDiagramDialogOpen] = useState(false);

  // Save all node positions to DB
  const handleSaveAll = useCallback(async () => {
    setSaveStatus('saving');
    try {
      await Promise.all(
        nodesRef.current
          .filter((n) => n.type !== 'textAnnotation')
          .map((n) => api.updateComponent(n.id, { positionX: n.position.x, positionY: n.position.y }))
      );
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('idle');
    }
  }, []);

  const loadCommentCounts = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.getCommentCounts(id);
      setCommentCounts(data.componentCounts || {});
    } catch {
      // ignore
    }
  }, [id]);

  const selectDiagram = useCallback(
    (diagramId: string | null, allDiagrams: Diagram[], counts: Record<string, number>) => {
      setSelectedDiagramId(diagramId);
      const diagram = allDiagrams.find((d) => d.id === diagramId);
      const { flowNodes, flowEdges } = diagramToNodesAndEdges(diagram, counts);
      setNodes(flowNodes);
      setEdges(flowEdges);
    },
    [setNodes, setEdges]
  );

  const loadModel = useCallback(() => {
    if (!id) return;

    Promise.all([
      fetch(`/api/threat-models/${id}`).then((r) => r.json()),
      api.getCommentCounts(id).catch(() => ({ data: { componentCounts: {} } })),
    ]).then(([{ data }, countsRes]) => {
      setModelName(data.name);
      const loadedDiagrams: Diagram[] = data.diagrams || [];
      setDiagrams(loadedDiagrams);
      const counts = countsRes.data?.componentCounts || {};
      setCommentCounts(counts);

      // Use diagram from query param if provided, otherwise first diagram
      const queryDiagramId = searchParams.get('diagram');
      const targetId = (queryDiagramId && loadedDiagrams.some(d => d.id === queryDiagramId))
        ? queryDiagramId
        : (loadedDiagrams.length > 0 ? loadedDiagrams[0].id : null);
      selectDiagram(targetId, loadedDiagrams, counts);
      setLoading(false);
    }).catch((err) => {
      console.error('Failed to load threat model:', err);
      setLoading(false);
    });
  }, [id, selectDiagram, searchParams]);

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // Auto-focus a component or edge from ?focus= query param (once)
  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (!focusId || loading) return;

    // Try to find as a node first, then as an edge
    const node = nodes.find((n) => n.id === focusId);
    if (node) {
      setSelectedNode(node);
      setSelectedEdge(null);
      setActionNode({ nodeId: node.id, x: 100, y: 100 });
    } else {
      const edge = edges.find((e) => e.id === focusId);
      if (edge) {
        setSelectedEdge(edge);
        setSelectedNode(null);
        setActionNode(null);
      }
    }

    // Clear focus param so it doesn't re-trigger on every state change
    setSearchParams((prev) => { prev.delete('focus'); return prev; }, { replace: true });
  }, [searchParams, loading, nodes.length, edges.length]);

  const handleTabSelect = (_event: unknown, data: { value: unknown }) => {
    const diagramId = data.value as string;
    selectDiagram(diagramId, diagrams, commentCounts);
    setSelectedNode(null);
    setSelectedEdge(null);
    setShowDiagramPanel(true);
  };

  const handleCreateDiagram = async () => {
    if (!id || !newDiagramName.trim()) return;

    const res = await fetch(`/api/threat-models/${id}/diagrams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newDiagramName }),
    });
    const { data } = await res.json();
    const updated = [...diagrams, data as Diagram];
    setDiagrams(updated);
    selectDiagram(data.id, updated, commentCounts);
    setNewDiagramDialogOpen(false);
    setNewDiagramName('');
  };

  const handleRenameDiagram = useCallback(async (newName: string) => {
    if (!selectedDiagramId || !newName.trim()) return;
    try {
      await api.updateDiagram(selectedDiagramId, { name: newName });
      setDiagrams((prev) => prev.map((d) => d.id === selectedDiagramId ? { ...d, name: newName } : d));
    } catch (err) {
      console.error('Failed to rename diagram:', err);
    }
  }, [selectedDiagramId]);

  const handleDeleteDiagram = useCallback(async () => {
    if (!selectedDiagramId) return;
    try {
      await api.deleteDiagram(selectedDiagramId);
      const remaining = diagrams.filter((d) => d.id !== selectedDiagramId);
      setDiagrams(remaining);
      setDeleteDiagramDialogOpen(false);
      setShowDiagramPanel(false);
      if (remaining.length > 0) {
        selectDiagram(remaining[0].id, remaining, commentCounts);
      } else {
        setSelectedDiagramId(null);
        setNodes([]);
        setEdges([]);
      }
    } catch (err) {
      console.error('Failed to delete diagram:', err);
    }
  }, [selectedDiagramId, diagrams, commentCounts, selectDiagram, setNodes, setEdges]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    setUploadStatus('Uploading and analyzing code...');

    const formData = new FormData();
    formData.append('code', file);

    try {
      const res = await fetch(`/api/upload/${id}/upload`, {
        method: 'POST',
        body: formData,
      });
      const { data, error } = await res.json();
      if (error) throw new Error(error);
      setUploadStatus(data.message);
      if (data.generationId) setAiGenerationId(data.generationId);
      // Reload the model to show generated DFD
      loadModel();
    } catch (err: any) {
      setUploadStatus(`Error: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    const rect = (_event.target as HTMLElement).getBoundingClientRect();
    setActionNode({ nodeId: node.id, x: rect.right + 8, y: rect.top });
    setCommentPanelNode(null);
    setSelectedNode(node);
    setSelectedEdge(null);
    setShowDiagramPanel(false);
  }, []);

  const onEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    setActionNode(null);
    setCommentPanelNode(null);
    setShowDiagramPanel(false);
  }, []);

  const openCommentPanel = useCallback(async (nodeId: string, label: string, x: number, y: number) => {
    setActionNode(null);
    setCommentPanelNode({ nodeId, label, x, y });
    setNewCommentText('');
    try {
      const { data } = await api.getComments({ componentId: nodeId });
      setNodeComments(data || []);
    } catch {
      setNodeComments([]);
    }
  }, []);

  const handleSubmitNodeComment = useCallback(async () => {
    if (!commentPanelNode || !newCommentText.trim()) return;
    setSubmittingComment(true);
    try {
      await api.createComment({
        body: newCommentText,
        author: 'Current User',
        componentId: commentPanelNode.nodeId,
      });
      setNewCommentText('');
      const { data } = await api.getComments({ componentId: commentPanelNode.nodeId });
      setNodeComments(data || []);
      await loadCommentCounts();
      // Update badge on nodes
      const updated = { ...commentCounts };
      updated[commentPanelNode.nodeId] = (updated[commentPanelNode.nodeId] || 0) + 1;
      setCommentCounts(updated);
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  }, [commentPanelNode, newCommentText, commentCounts, loadCommentCounts]);

  const handlePaneClick = useCallback(() => {
    setActionNode(null);
    setCommentPanelNode(null);
    setSelectedNode(null);
    setSelectedEdge(null);
    setShowDiagramPanel(false);
  }, []);

  // Drag-and-drop from palette
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    async (event: DragEvent) => {
      event.preventDefault();
      const componentType = event.dataTransfer.getData('application/dfd-component-type');
      const nodeType = event.dataTransfer.getData('application/dfd-node-type');
      const subtype = event.dataTransfer.getData('application/dfd-component-subtype') || '';
      if (!componentType || !nodeType || !id || !selectedDiagramId) return;

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const positionX = event.clientX - bounds.left;
      const positionY = event.clientY - bounds.top;

      // Generate a more descriptive default name based on subtype
      const subtypeLabels: Record<string, string> = {
        service: 'Service', daemon: 'Daemon', webapp: 'Web App', library: 'Library', system: 'System Process',
        database: 'Database', filesystem: 'File Store', cache: 'Cache', hardware: 'Hardware Store', config: 'Config File', log: 'Log Store',
        user: 'User', api: 'External API', webservice: 'Web Service', browser: 'Browser', thirdparty: 'Third-party Service',
        network: 'Network Boundary', session: 'User Session', process: 'Process Boundary',
      };
      const defaultName = subtype
        ? subtypeLabels[subtype] || componentType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : componentType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      try {
        takeSnapshot(nodesRef.current, edgesRef.current);
        const metadata = subtype ? { subtype } : undefined;
        const { data } = await api.addComponent(id, selectedDiagramId, {
          name: defaultName,
          type: componentType,
          positionX,
          positionY,
          metadata,
        });
        const newNode: Node = {
          id: data.id,
          type: nodeType,
          position: { x: positionX, y: positionY },
          data: {
            label: data.name,
            description: data.description || '',
            sourceFiles: data.sourceFiles || [],
            componentType: data.type,
            commentCount: 0,
          },
        };
        setNodes((nds) => [...nds, newNode]);
      } catch (err) {
        console.error('Failed to add component:', err);
      }
    },
    [id, selectedDiagramId, setNodes, takeSnapshot]
  );

  // Capture pre-drag state for undo (before React Flow moves the node)
  const onNodeDragStart: NodeMouseHandler = useCallback((_event, _node) => {
    takeSnapshot(nodesRef.current, edgesRef.current);
  }, [takeSnapshot]);

  // Persist node position after drag
  const onNodeDragStop: NodeMouseHandler = useCallback((_event, node) => {
    api.updateComponent(node.id, {
      positionX: node.position.x,
      positionY: node.position.y,
    }).catch((err) => console.error('Failed to persist position:', err));
  }, []);

  // Delete selected element
  const handleDeleteSelected = useCallback(async () => {
    takeSnapshot(nodesRef.current, edgesRef.current);
    try {
      if (selectedNode) {
        await api.deleteComponent(selectedNode.id);
        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
        setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
        setSelectedNode(null);
      } else if (selectedEdge) {
        await api.deleteDataFlow(selectedEdge.id);
        setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
        setSelectedEdge(null);
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
    setDeleteDialogOpen(false);
  }, [selectedNode, selectedEdge, setNodes, setEdges, takeSnapshot]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't intercept keys when user is typing in an input/textarea
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (event.target as HTMLElement)?.isContentEditable) return;

      if (event.key === 'Delete' && (selectedNode || selectedEdge)) {
        event.preventDefault();
        setDeleteDialogOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo(nodesRef.current, edgesRef.current, setNodes, setEdges);
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        redo(nodesRef.current, edgesRef.current, setNodes, setEdges);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleSaveAll();
      }
    },
    [selectedNode, selectedEdge, setNodes, setEdges, undo, redo, handleSaveAll]
  );

  const openThreatDialog = useCallback((componentId: string, componentName: string) => {
    setThreatComponentId(componentId);
    setThreatComponentName(componentName);
    setNewThreat({ title: '', description: '', strideCategory: 'SPOOFING', severity: 'MEDIUM' });
    setThreatDialogOpen(true);
    setActionNode(null);
  }, []);

  const handleCreateThreat = useCallback(async () => {
    if (!id || !newThreat.title.trim() || !newThreat.description.trim()) return;
    try {
      await api.createThreat({
        ...newThreat,
        threatModelId: id,
        componentId: threatComponentId,
      });
      setThreatDialogOpen(false);
    } catch (err) {
      console.error('Failed to create threat:', err);
    }
  }, [id, newThreat, threatComponentId]);

  // Property panel callbacks
  const handleNodeUpdated = useCallback(
    (nodeId: string, data: Record<string, any>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const nodeType = componentTypeToNodeType(data.type || (n.data as any).componentType);
          return {
            ...n,
            type: nodeType,
            data: {
              ...n.data,
              label: data.name ?? (n.data as any).label,
              description: data.description ?? (n.data as any).description,
              sourceFiles: data.sourceFiles ?? (n.data as any).sourceFiles,
              componentType: data.type ?? (n.data as any).componentType,
            },
          };
        })
      );
      setSelectedNode(null);
    },
    [setNodes]
  );

  const handleEdgeUpdated = useCallback(
    (edgeId: string, data: Record<string, any>) => {
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId) return e;
          return {
            ...e,
            label: data.label ?? e.label,
            animated: data.crossesTrustBoundary ?? e.animated,
            style: {
              stroke: data.crossesTrustBoundary ? '#e74c3c' : '#6c757d',
              strokeWidth: 2,
            },
            data: {
              ...e.data,
              protocol: data.protocol ?? (e.data as any)?.protocol,
              dataClassification: data.dataClassification ?? (e.data as any)?.dataClassification,
            },
          };
        })
      );
      setSelectedEdge(null);
    },
    [setEdges]
  );

  const handleNodeDeleted = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
    },
    [setNodes, setEdges]
  );

  const handleEdgeDeleted = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdge(null);
    },
    [setEdges]
  );

  const closePropertyPanel = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!id || !selectedDiagramId || !connection.source || !connection.target) return;
      try {
        takeSnapshot(nodesRef.current, edgesRef.current);
        const { data } = await api.addDataFlow(id, selectedDiagramId, {
          label: 'New Flow',
          sourceId: connection.source,
          targetId: connection.target,
        });
        // Use the DB-generated ID so delete works
        const newEdge: Edge = {
          id: data.id,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
          label: data.label,
          style: { stroke: '#6c757d', strokeWidth: 2 },
          labelStyle: { fontSize: 11 },
          data: { protocol: '', dataClassification: '' },
        };
        setEdges((eds) => [...eds, newEdge]);
      } catch (err) {
        console.error('Failed to create data flow:', err);
      }
    },
    [id, selectedDiagramId, setEdges, takeSnapshot]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      takeSnapshot(nodesRef.current, edgesRef.current);
      setEdges((eds) =>
        eds.map((e) =>
          e.id === oldEdge.id
            ? {
                ...e,
                source: newConnection.source || e.source,
                target: newConnection.target || e.target,
                sourceHandle: newConnection.sourceHandle ?? e.sourceHandle,
                targetHandle: newConnection.targetHandle ?? e.targetHandle,
              }
            : e,
        ),
      );
    },
    [setEdges, takeSnapshot],
  );

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size="medium" />
        <Text>Loading threat model...</Text>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabBar}>
        <TabList
          selectedValue={selectedDiagramId ?? undefined}
          onTabSelect={handleTabSelect}
          size="small"
          style={{ flexShrink: 1, minWidth: 0 }}
        >
          {diagrams.slice(0, MAX_VISIBLE_TABS).map((d) => (
            <Tab key={d.id} value={d.id} aria-label={`Diagram: ${d.name}`} style={{ whiteSpace: 'nowrap' }}>
              {d.name}
            </Tab>
          ))}
        </TabList>
        {diagrams.length > MAX_VISIBLE_TABS && (
          <Menu>
            <MenuTrigger>
              <Button
                appearance="subtle"
                icon={<MoreHorizontal20Regular />}
                size="small"
                aria-label={`${diagrams.length - MAX_VISIBLE_TABS} more diagrams`}
                title="More diagrams"
              />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {diagrams.slice(MAX_VISIBLE_TABS).map((d) => (
                  <MenuItem
                    key={d.id}
                    onClick={() => {
                      selectDiagram(d.id, diagrams, commentCounts);
                      setSelectedNode(null);
                      setSelectedEdge(null);
                      setShowDiagramPanel(true);
                    }}
                  >
                    {d.name}
                    {d.id === selectedDiagramId && ' ✓'}
                  </MenuItem>
                ))}
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
        <Dialog
          open={newDiagramDialogOpen}
          onOpenChange={(_e, data) => setNewDiagramDialogOpen(data.open)}
        >
          <DialogTrigger>
            <Button
              appearance="subtle"
              icon={<Add16Regular />}
              size="small"
              title="Add diagram"
            />
          </DialogTrigger>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>New Diagram</DialogTitle>
              <DialogContent>
                <Input
                  placeholder="Diagram name"
                  value={newDiagramName}
                  onChange={(_e, d) => setNewDiagramName(d.value)}
                  style={{ width: '100%', marginTop: '8px' }}
                  aria-label="New diagram name"
                />
              </DialogContent>
              <DialogActions>
                <DialogTrigger>
                  <Button appearance="secondary">Cancel</Button>
                </DialogTrigger>
                <Button
                  appearance="primary"
                  onClick={handleCreateDiagram}
                  disabled={!newDiagramName.trim()}
                >
                  Create
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      </div>
      <div className={styles.container} ref={reactFlowWrapper} onKeyDown={handleKeyDown} tabIndex={-1}>
        <UndoRedoContext.Provider value={takeSnapshotNow}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={handlePaneClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: 'bendable' }}
          fitView
          snapToGrid={false}
          selectNodesOnDrag={false}
          onInit={(instance) => { reactFlowRef.current = instance; }}
          nodesDraggable={!locked}
          nodesConnectable={!locked}
          elementsSelectable={!locked}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Panel position="bottom-left" style={{ bottom: '10px' }}>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <Tooltip content="Zoom in" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<ZoomIn20Regular />}
                  size="small"
                  onClick={() => reactFlowRef.current?.zoomIn()}
                  aria-label="Zoom in"
                  style={{ backgroundColor: tokens.colorNeutralBackground4, color: tokens.colorNeutralForeground2, minWidth: 'auto' }}
                />
              </Tooltip>
              <Tooltip content="Zoom out" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<ZoomOut20Regular />}
                  size="small"
                  onClick={() => reactFlowRef.current?.zoomOut()}
                  aria-label="Zoom out"
                  style={{ backgroundColor: tokens.colorNeutralBackground4, color: tokens.colorNeutralForeground2, minWidth: 'auto' }}
                />
              </Tooltip>
              <Tooltip content="Fit to view" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<ZoomFitRegular />}
                  size="small"
                  onClick={() => reactFlowRef.current?.fitView()}
                  aria-label="Fit to view"
                  style={{ backgroundColor: tokens.colorNeutralBackground4, color: tokens.colorNeutralForeground2, minWidth: 'auto' }}
                />
              </Tooltip>
              <div style={{ width: '1px', height: '20px', backgroundColor: tokens.colorNeutralStroke2 }} />
              <Tooltip content="Undo (Ctrl+Z)" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<ArrowUndo20Regular />}
                  size="small"
                  disabled={!canUndo}
                  onClick={() => undo(nodesRef.current, edgesRef.current, setNodes, setEdges)}
                  aria-label="Undo"
                  style={{ backgroundColor: tokens.colorNeutralBackground4, color: tokens.colorNeutralForeground2, minWidth: 'auto' }}
                />
              </Tooltip>
              <Tooltip content="Redo (Ctrl+Y)" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<ArrowRedo20Regular />}
                  size="small"
                  disabled={!canRedo}
                  onClick={() => redo(nodesRef.current, edgesRef.current, setNodes, setEdges)}
                  aria-label="Redo"
                  style={{ backgroundColor: tokens.colorNeutralBackground4, color: tokens.colorNeutralForeground2, minWidth: 'auto' }}
                />
              </Tooltip>
              <div style={{ width: '1px', height: '20px', backgroundColor: tokens.colorNeutralStroke2 }} />
              <Tooltip content="Save All (Ctrl+S)" relationship="label">
                <Button
                  appearance="subtle"
                  icon={saveStatus === 'saved' ? <Checkmark20Regular /> : <Save20Regular />}
                  size="small"
                  disabled={saveStatus === 'saving'}
                  onClick={handleSaveAll}
                  aria-label="Save all changes"
                  style={{ backgroundColor: tokens.colorNeutralBackground4, color: saveStatus === 'saved' ? tokens.colorPaletteGreenForeground1 : tokens.colorNeutralForeground2, minWidth: 'auto' }}
                />
              </Tooltip>
              <div style={{ width: '1px', height: '20px', backgroundColor: tokens.colorNeutralStroke2 }} />
              <Tooltip content={locked ? 'Unlock canvas — allow editing' : 'Lock canvas — prevent changes'} relationship="label">
                <Button
                  appearance="subtle"
                  icon={locked ? <LockClosed20Regular /> : <LockOpen20Regular />}
                  size="small"
                  onClick={() => setLocked((l) => !l)}
                  aria-label={locked ? 'Unlock canvas' : 'Lock canvas'}
                  style={{ backgroundColor: tokens.colorNeutralBackground4, color: locked ? tokens.colorPaletteRedForeground1 : tokens.colorNeutralForeground2, minWidth: 'auto' }}
                />
              </Tooltip>
            </div>
          </Panel>
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            style={{ backgroundColor: '#1e1e1e', borderRadius: '8px' }}
            nodeColor="#4a9eff"
            maskColor="rgba(0, 0, 0, 0.6)"
          />
          <Panel position="top-left" className={styles.panel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Text weight="semibold" size={400}>
                {modelName || 'Data Flow Diagram'}
              </Text>
              {id && <ShareDialog threatModelId={id} threatModelName={modelName} />}
            </div>
            {nodes.length === 0 && !uploading && (
              <div style={{ marginTop: '8px' }}>
                <Text size={200} block style={{ opacity: 0.7, marginBottom: '8px' }}>
                  Upload source code to auto-generate the DFD
                </Text>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".zip"
                  onChange={handleUpload}
                  style={{ display: 'none' }}
                  aria-label="Upload source code zip file"
                />
                <Tooltip content="Upload source code to auto-generate DFD" relationship="description">
                  <Button
                    appearance="primary"
                    icon={<ArrowUpload20Regular />}
                    onClick={() => fileInputRef.current?.click()}
                    size="small"
                  >
                    Upload Source Code (.zip)
                  </Button>
                </Tooltip>
              </div>
            )}
            {uploading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <Spinner size="tiny" />
                <Text size={200}>{uploadStatus}</Text>
              </div>
            )}
            {!uploading && uploadStatus && nodes.length > 0 && (
              <Text size={200} block style={{ marginTop: '4px', opacity: 0.7 }}>
                {uploadStatus}
              </Text>
            )}
          </Panel>
          <Panel position="top-right" style={{ top: '10px', right: (selectedNode || selectedEdge || showDiagramPanel) ? '310px' : '10px', transition: 'right 0.2s ease' }}>
            <ComponentPalette />
          </Panel>
        </ReactFlow>
        </UndoRedoContext.Provider>

        {/* Node action bar */}
        {actionNode && (
          <div
            className={styles.nodeActionBarWrapper}
            style={{ top: actionNode.y, left: actionNode.x }}
          >
            <div className={styles.nodeActionBar}>
            <Tooltip content="Add a comment on this component" relationship="description">
              <Button
                size="small"
                appearance="subtle"
                icon={<Comment20Regular />}
                onClick={() => {
                  const node = nodes.find((n) => n.id === actionNode.nodeId);
                  const label = (node?.data as any)?.label || 'Component';
                  openCommentPanel(actionNode.nodeId, label, actionNode.x, actionNode.y);
                }}
              >
                Comment
              </Button>
            </Tooltip>
            <Tooltip content="Add a threat linked to this component" relationship="description">
              <Button
                size="small"
                appearance="subtle"
                icon={<ShieldTask20Regular />}
                onClick={() => {
                  const node = nodes.find((n) => n.id === actionNode.nodeId);
                  const label = (node?.data as any)?.label || 'Component';
                  openThreatDialog(actionNode.nodeId, label);
              }}
            >
              Add Threat
            </Button>
            </Tooltip>
            </div>
          </div>
        )}

        {/* Comment panel for a node */}
        {commentPanelNode && (
          <div
            className={styles.commentPanel}
            style={{ top: commentPanelNode.y, left: commentPanelNode.x }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <Text weight="semibold" size={300}>
                Comments on {commentPanelNode.label}
              </Text>
              <Tooltip content="Close comments" relationship="label">
                <Button
                  size="small"
                  appearance="subtle"
                  icon={<Dismiss16Regular />}
                  aria-label="Close comments"
                  onClick={() => setCommentPanelNode(null)}
                />
              </Tooltip>
            </div>

            {nodeComments.length === 0 && (
              <Text size={200} style={{ opacity: 0.6, display: 'block', marginBottom: '12px' }}>
                No comments yet.
              </Text>
            )}

            {nodeComments.map((c) => (
              <div key={c.id} className={styles.commentThread}>
                <div className={styles.commentMeta}>
                  <Text size={100} weight="semibold">{c.author}</Text>
                  <Text size={100}>{new Date(c.createdAt).toLocaleString()}</Text>
                  {c.resolved && <Badge appearance="outline" color="success" size="small">Resolved</Badge>}
                </div>
                <div className={styles.commentBody}>
                  <Text size={200}>{c.body}</Text>
                </div>
                {c.replies?.map((r) => (
                  <div key={r.id} className={styles.reply}>
                    <div className={styles.commentMeta}>
                      <Text size={100} weight="semibold">{r.author}</Text>
                      <Text size={100}>{new Date(r.createdAt).toLocaleString()}</Text>
                    </div>
                    <Text size={200}>{r.body}</Text>
                  </div>
                ))}
              </div>
            ))}

            <Divider style={{ margin: '8px 0' }} />
            <Textarea
              placeholder="Add a comment..."
              value={newCommentText}
              onChange={(_e, d) => setNewCommentText(d.value)}
              style={{ width: '100%' }}
              rows={2}
              aria-label="Add comment"
            />
            <Button
              appearance="primary"
              size="small"
              onClick={handleSubmitNodeComment}
              disabled={!newCommentText.trim() || submittingComment}
              style={{ marginTop: '8px' }}
            >
              {submittingComment ? 'Submitting...' : 'Add Comment'}
            </Button>
          </div>
        )}
        {/* Property panel */}
        {(selectedNode || selectedEdge) && (
          <PropertyPanel
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            threatModelId={id}
            onClose={closePropertyPanel}
            onNodeUpdated={handleNodeUpdated}
            onEdgeUpdated={handleEdgeUpdated}
            onNodeDeleted={handleNodeDeleted}
            onEdgeDeleted={handleEdgeDeleted}
          />
        )}

        {/* Diagram properties panel */}
        {showDiagramPanel && !selectedNode && !selectedEdge && selectedDiagramId && (() => {
          const currentDiagram = diagrams.find((d) => d.id === selectedDiagramId);
          if (!currentDiagram) return null;
          return (
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: '300px', zIndex: 10,
              backgroundColor: 'var(--colorNeutralBackground1)', borderLeft: '1px solid var(--colorNeutralStroke1)',
              boxShadow: 'var(--shadow16)', display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
                <Text weight="semibold">Diagram Properties</Text>
                <Button appearance="subtle" size="small" icon={<Dismiss16Regular />} aria-label="Close diagram properties" title="Close" onClick={() => setShowDiagramPanel(false)} />
              </div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <Text size={200} weight="semibold">Name</Text>
                  <Input
                    value={currentDiagram.name}
                    onChange={(_e, d) => {
                      setDiagrams((prev) => prev.map((dia) => dia.id === selectedDiagramId ? { ...dia, name: d.value } : dia));
                    }}
                    onBlur={(e) => handleRenameDiagram(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <Text size={200} weight="semibold">Components</Text>
                  <Text size={200}>{nodes.filter((n) => n.type !== 'textAnnotation').length} components</Text>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <Text size={200} weight="semibold">Data Flows</Text>
                  <Text size={200}>{edges.length} flows</Text>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderTop: '1px solid var(--colorNeutralStroke2)' }}>
                <div style={{ flex: 1 }} />
                <Dialog open={deleteDiagramDialogOpen} onOpenChange={(_e, data) => setDeleteDiagramDialogOpen(data.open)}>
                  <DialogTrigger>
                    <Button
                      appearance="subtle"
                      icon={<Delete16Regular />}
                      style={{ color: tokens.colorPaletteRedForeground1 }}
                      disabled={diagrams.length <= 1}
                      title={diagrams.length <= 1 ? 'Cannot delete the last diagram' : 'Delete this diagram'}
                    >
                      Delete Diagram
                    </Button>
                  </DialogTrigger>
                  <DialogSurface>
                    <DialogBody>
                      <DialogTitle>Delete Diagram</DialogTitle>
                      <DialogContent>
                        Are you sure you want to delete "{currentDiagram.name}"? All components and data flows in this diagram will be permanently removed.
                      </DialogContent>
                      <DialogActions>
                        <DialogTrigger>
                          <Button appearance="secondary">Cancel</Button>
                        </DialogTrigger>
                        <Button appearance="primary" style={{ backgroundColor: tokens.colorPaletteRedBackground3 }} onClick={handleDeleteDiagram}>
                          Delete
                        </Button>
                      </DialogActions>
                    </DialogBody>
                  </DialogSurface>
                </Dialog>
              </div>
            </div>
          );
        })()}

        {/* Keyboard delete confirmation */}
        <Dialog
          open={deleteDialogOpen}
          onOpenChange={(_e, data) => setDeleteDialogOpen(data.open)}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Confirm Delete</DialogTitle>
              <DialogContent>
                Are you sure you want to delete this {selectedNode ? 'component' : 'data flow'}?
                {selectedNode && ' All connected data flows will also be removed.'}
              </DialogContent>
              <DialogActions>
                <DialogTrigger>
                  <Button appearance="secondary">Cancel</Button>
                </DialogTrigger>
                <Button appearance="primary" onClick={handleDeleteSelected}>
                  Delete
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>

        {/* Add threat from DFD dialog */}
        <Dialog
          open={threatDialogOpen}
          onOpenChange={(_e, data) => setThreatDialogOpen(data.open)}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Add Threat to {threatComponentName}</DialogTitle>
              <DialogContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                  <Input
                    placeholder="Threat title"
                    value={newThreat.title}
                    onChange={(_e, d) => setNewThreat((p) => ({ ...p, title: d.value }))}
                    aria-label="Threat title"
                  />
                  <Textarea
                    placeholder="Description of the threat..."
                    value={newThreat.description}
                    onChange={(_e, d) => setNewThreat((p) => ({ ...p, description: d.value }))}
                    rows={3}
                    aria-label="Threat description"
                  />
                  <Dropdown
                    value={newThreat.strideCategory}
                    selectedOptions={[newThreat.strideCategory]}
                    onOptionSelect={(_e, d) => setNewThreat((p) => ({ ...p, strideCategory: d.optionValue as string }))}
                    aria-label="STRIDE category"
                  >
                    <Option value="SPOOFING">Spoofing</Option>
                    <Option value="TAMPERING">Tampering</Option>
                    <Option value="REPUDIATION">Repudiation</Option>
                    <Option value="INFO_DISCLOSURE">Info Disclosure</Option>
                    <Option value="DENIAL_OF_SERVICE">Denial of Service</Option>
                    <Option value="ELEVATION_OF_PRIVILEGE">Elevation of Privilege</Option>
                  </Dropdown>
                  <Dropdown
                    value={newThreat.severity}
                    selectedOptions={[newThreat.severity]}
                    onOptionSelect={(_e, d) => setNewThreat((p) => ({ ...p, severity: d.optionValue as string }))}
                    aria-label="Threat severity"
                  >
                    <Option value="CRITICAL">Critical</Option>
                    <Option value="HIGH">High</Option>
                    <Option value="MEDIUM">Medium</Option>
                    <Option value="LOW">Low</Option>
                    <Option value="INFO">Info</Option>
                  </Dropdown>
                </div>
              </DialogContent>
              <DialogActions>
                <DialogTrigger><Button appearance="secondary">Cancel</Button></DialogTrigger>
                <Button appearance="primary" onClick={handleCreateThreat} disabled={!newThreat.title.trim() || !newThreat.description.trim()}>
                  Create
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      </div>

      {aiGenerationId && (
        <AIRatingWidget
          generationId={aiGenerationId}
          onClose={() => setAiGenerationId(null)}
        />
      )}
    </div>
  );
}
