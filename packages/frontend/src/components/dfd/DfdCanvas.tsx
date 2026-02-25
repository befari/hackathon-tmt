import { useCallback, useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Panel,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './dfd-dark.css';
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
} from '@fluentui/react-components';
import { ArrowUpload20Regular, Add16Regular } from '@fluentui/react-icons';
import { ProcessNode } from './nodes/ProcessNode';
import { DataStoreNode } from './nodes/DataStoreNode';
import { ExternalEntityNode } from './nodes/ExternalEntityNode';
import { TrustBoundaryNode } from './nodes/TrustBoundaryNode';
import type { Diagram, Component, DataFlow } from '@superior-tmt/shared';

const nodeTypes = {
  process: ProcessNode,
  dataStore: DataStoreNode,
  externalEntity: ExternalEntityNode,
  trustBoundary: TrustBoundaryNode,
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

function diagramToNodesAndEdges(diagram: Diagram | undefined) {
  if (!diagram) return { flowNodes: [] as Node[], flowEdges: [] as Edge[] };

  const flowNodes: Node[] = (diagram.components || []).map((comp: Component) => ({
    id: comp.id,
    type: componentTypeToNodeType(comp.type),
    position: { x: comp.positionX, y: comp.positionY },
    data: {
      label: comp.name,
      description: comp.description,
      sourceFiles: comp.sourceFiles,
      componentType: comp.type,
    },
  }));

  const flowEdges: Edge[] = (diagram.dataFlows || []).map((flow: DataFlow) => ({
    id: flow.id,
    source: flow.sourceId,
    target: flow.targetId,
    label: flow.label,
    animated: flow.crossesTrustBoundary,
    style: {
      stroke: flow.crossesTrustBoundary ? '#e74c3c' : '#6c757d',
      strokeWidth: 2,
    },
    labelStyle: { fontSize: 11 },
  }));

  return { flowNodes, flowEdges };
}

export function DfdCanvas() {
  const styles = useStyles();
  const { id } = useParams<{ id: string }>();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [modelName, setModelName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(null);
  const [newDiagramDialogOpen, setNewDiagramDialogOpen] = useState(false);
  const [newDiagramName, setNewDiagramName] = useState('');

  const selectDiagram = useCallback(
    (diagramId: string | null, allDiagrams: Diagram[]) => {
      setSelectedDiagramId(diagramId);
      const diagram = allDiagrams.find((d) => d.id === diagramId);
      const { flowNodes, flowEdges } = diagramToNodesAndEdges(diagram);
      setNodes(flowNodes);
      setEdges(flowEdges);
    },
    [setNodes, setEdges]
  );

  const loadModel = useCallback(() => {
    if (!id) return;

    fetch(`/api/threat-models/${id}`)
      .then((r) => r.json())
      .then(({ data }) => {
        setModelName(data.name);
        const loadedDiagrams: Diagram[] = data.diagrams || [];
        setDiagrams(loadedDiagrams);

        const firstId = loadedDiagrams.length > 0 ? loadedDiagrams[0].id : null;
        selectDiagram(firstId, loadedDiagrams);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load threat model:', err);
        setLoading(false);
      });
  }, [id, selectDiagram]);

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  const handleTabSelect = (_event: unknown, data: { value: unknown }) => {
    const diagramId = data.value as string;
    selectDiagram(diagramId, diagrams);
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
    selectDiagram(data.id, updated);
    setNewDiagramDialogOpen(false);
    setNewDiagramName('');
  };

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
      // Reload the model to show generated DFD
      loadModel();
    } catch (err: any) {
      setUploadStatus(`Error: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
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
        >
          {diagrams.map((d) => (
            <Tab key={d.id} value={d.id}>
              {d.name}
            </Tab>
          ))}
        </TabList>
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
      <div className={styles.container}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls style={{ backgroundColor: '#2d2d2d', borderColor: '#444', borderRadius: '8px' }} />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            style={{ backgroundColor: '#1e1e1e', borderRadius: '8px' }}
            nodeColor="#4a9eff"
            maskColor="rgba(0, 0, 0, 0.6)"
          />
          <Panel position="top-left" className={styles.panel}>
            <Text weight="semibold" size={400}>
              {modelName || 'Data Flow Diagram'}
            </Text>
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
                />
                <Button
                  appearance="primary"
                  icon={<ArrowUpload20Regular />}
                  onClick={() => fileInputRef.current?.click()}
                  size="small"
                >
                  Upload Source Code (.zip)
                </Button>
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
        </ReactFlow>
      </div>
    </div>
  );
}
