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
import { makeStyles, tokens, Text, Spinner, Button } from '@fluentui/react-components';
import { ArrowUpload20Regular } from '@fluentui/react-icons';
import { ProcessNode } from './nodes/ProcessNode';
import { DataStoreNode } from './nodes/DataStoreNode';
import { ExternalEntityNode } from './nodes/ExternalEntityNode';
import { TrustBoundaryNode } from './nodes/TrustBoundaryNode';
import type { Component, DataFlow } from '@superior-tmt/shared';

const nodeTypes = {
  process: ProcessNode,
  dataStore: DataStoreNode,
  externalEntity: ExternalEntityNode,
  trustBoundary: TrustBoundaryNode,
};

const useStyles = makeStyles({
  container: {
    width: '100%',
    height: '100%',
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

  const loadModel = () => {
    if (!id) return;

    fetch(`/api/threat-models/${id}`)
      .then((r) => r.json())
      .then(({ data }) => {
        setModelName(data.name);

        // Convert components to React Flow nodes
        const flowNodes: Node[] = (data.components || []).map((comp: Component) => ({
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

        // Convert data flows to React Flow edges
        const flowEdges: Edge[] = (data.dataFlows || []).map((flow: DataFlow) => ({
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

        setNodes(flowNodes);
        setEdges(flowEdges);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load threat model:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadModel();
  }, [id, setNodes, setEdges]);

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
  );
}
