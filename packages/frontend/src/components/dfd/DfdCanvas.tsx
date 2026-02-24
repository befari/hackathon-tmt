import { useCallback, useEffect, useState } from 'react';
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
import { makeStyles, tokens, Text, Spinner } from '@fluentui/react-components';
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

  useEffect(() => {
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
  }, [id, setNodes, setEdges]);

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
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
        <Panel position="top-left" className={styles.panel}>
          <Text weight="semibold" size={400}>
            {modelName || 'Data Flow Diagram'}
          </Text>
          {nodes.length === 0 && (
            <Text size={200} block style={{ marginTop: '4px', opacity: 0.7 }}>
              Upload source code to generate DFD, or add components manually
            </Text>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
}
