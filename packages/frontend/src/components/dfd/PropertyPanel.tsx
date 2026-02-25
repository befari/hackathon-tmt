import { useState, useEffect, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Input,
  Textarea,
  Dropdown,
  Option,
  Checkbox,
  Button,
  Divider,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
} from '@fluentui/react-components';
import { Delete20Regular, Save20Regular, Dismiss16Regular } from '@fluentui/react-icons';
import { api } from '../../api/client';
import type { Node, Edge } from '@xyflow/react';

const useStyles = makeStyles({
  panel: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: '300px',
    zIndex: 10,
    backgroundColor: tokens.colorNeutralBackground1,
    borderLeft: `1px solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow16,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  body: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
});

const COMPONENT_TYPES = ['PROCESS', 'DATA_STORE', 'EXTERNAL_ENTITY', 'TRUST_BOUNDARY'] as const;
const DATA_CLASSIFICATIONS = ['public', 'internal', 'confidential', 'restricted'] as const;

interface PropertyPanelProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onClose: () => void;
  onNodeUpdated: (id: string, data: Record<string, any>) => void;
  onEdgeUpdated: (id: string, data: Record<string, any>) => void;
  onNodeDeleted: (id: string) => void;
  onEdgeDeleted: (id: string) => void;
}

export function PropertyPanel({
  selectedNode,
  selectedEdge,
  onClose,
  onNodeUpdated,
  onEdgeUpdated,
  onNodeDeleted,
  onEdgeDeleted,
}: PropertyPanelProps) {
  const styles = useStyles();

  // Node fields
  const [name, setName] = useState('');
  const [type, setType] = useState('PROCESS');
  const [description, setDescription] = useState('');
  const [sourceFiles, setSourceFiles] = useState('');

  // Edge fields
  const [label, setLabel] = useState('');
  const [protocol, setProtocol] = useState('');
  const [dataClassification, setDataClassification] = useState('');
  const [crossesTrustBoundary, setCrossesTrustBoundary] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Populate fields when selection changes
  useEffect(() => {
    if (selectedNode) {
      const d = selectedNode.data as Record<string, any>;
      setName(d.label || '');
      setType(d.componentType || 'PROCESS');
      setDescription(d.description || '');
      setSourceFiles((d.sourceFiles || []).join(', '));
    }
  }, [selectedNode]);

  useEffect(() => {
    if (selectedEdge) {
      setLabel((selectedEdge.label as string) || '');
      const d = (selectedEdge.data || {}) as Record<string, any>;
      setProtocol(d.protocol || '');
      setDataClassification(d.dataClassification || '');
      setCrossesTrustBoundary(selectedEdge.animated || false);
    }
  }, [selectedEdge]);

  const handleSaveNode = useCallback(async () => {
    if (!selectedNode) return;
    setSaving(true);
    try {
      const payload = {
        name,
        type,
        description,
        sourceFiles: sourceFiles.split(',').map((s) => s.trim()).filter(Boolean),
      };
      await api.updateComponent(selectedNode.id, payload);
      onNodeUpdated(selectedNode.id, payload);
    } catch (err) {
      console.error('Failed to update component:', err);
    } finally {
      setSaving(false);
    }
  }, [selectedNode, name, type, description, sourceFiles, onNodeUpdated]);

  const handleSaveEdge = useCallback(async () => {
    if (!selectedEdge) return;
    setSaving(true);
    try {
      const payload = {
        label,
        protocol,
        dataClassification,
        crossesTrustBoundary,
      };
      await api.updateDataFlow(selectedEdge.id, payload);
      onEdgeUpdated(selectedEdge.id, payload);
    } catch (err) {
      console.error('Failed to update data flow:', err);
    } finally {
      setSaving(false);
    }
  }, [selectedEdge, label, protocol, dataClassification, crossesTrustBoundary, onEdgeUpdated]);

  const handleDelete = useCallback(async () => {
    try {
      if (selectedNode) {
        await api.deleteComponent(selectedNode.id);
        onNodeDeleted(selectedNode.id);
      } else if (selectedEdge) {
        await api.deleteDataFlow(selectedEdge.id);
        onEdgeDeleted(selectedEdge.id);
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
    setDeleteDialogOpen(false);
  }, [selectedNode, selectedEdge, onNodeDeleted, onEdgeDeleted]);

  const isNode = !!selectedNode;
  const isEdge = !!selectedEdge;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Text weight="semibold" size={300}>
          {isNode ? 'Component Properties' : 'Data Flow Properties'}
        </Text>
        <Button
          appearance="subtle"
          icon={<Dismiss16Regular />}
          size="small"
          onClick={onClose}
        />
      </div>

      <div className={styles.body}>
        {isNode && (
          <>
            <div className={styles.field}>
              <Text size={200} weight="semibold">Name</Text>
              <Input value={name} onChange={(_e, d) => setName(d.value)} />
            </div>
            <div className={styles.field}>
              <Text size={200} weight="semibold">Type</Text>
              <Dropdown
                value={type}
                selectedOptions={[type]}
                onOptionSelect={(_e, d) => setType(d.optionValue || 'PROCESS')}
              >
                {COMPONENT_TYPES.map((t) => (
                  <Option key={t} value={t}>{t.replace(/_/g, ' ')}</Option>
                ))}
              </Dropdown>
            </div>
            <div className={styles.field}>
              <Text size={200} weight="semibold">Description</Text>
              <Textarea
                value={description}
                onChange={(_e, d) => setDescription(d.value)}
                rows={3}
              />
            </div>
            <div className={styles.field}>
              <Text size={200} weight="semibold">Source Files</Text>
              <Input
                value={sourceFiles}
                onChange={(_e, d) => setSourceFiles(d.value)}
                placeholder="file1.ts, file2.ts"
              />
            </div>
          </>
        )}

        {isEdge && (
          <>
            <div className={styles.field}>
              <Text size={200} weight="semibold">Label</Text>
              <Input value={label} onChange={(_e, d) => setLabel(d.value)} />
            </div>
            <div className={styles.field}>
              <Text size={200} weight="semibold">Protocol</Text>
              <Input
                value={protocol}
                onChange={(_e, d) => setProtocol(d.value)}
                placeholder="HTTPS, gRPC, etc."
              />
            </div>
            <div className={styles.field}>
              <Text size={200} weight="semibold">Data Classification</Text>
              <Dropdown
                value={dataClassification}
                selectedOptions={dataClassification ? [dataClassification] : []}
                onOptionSelect={(_e, d) => setDataClassification(d.optionValue || '')}
              >
                {DATA_CLASSIFICATIONS.map((c) => (
                  <Option key={c} value={c}>{c}</Option>
                ))}
              </Dropdown>
            </div>
            <Checkbox
              label="Crosses Trust Boundary"
              checked={crossesTrustBoundary}
              onChange={(_e, d) => setCrossesTrustBoundary(!!d.checked)}
            />
          </>
        )}
      </div>

      <div className={styles.actions}>
        <Button
          appearance="primary"
          icon={<Save20Regular />}
          onClick={isNode ? handleSaveNode : handleSaveEdge}
          disabled={saving}
          style={{ flex: 1 }}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Dialog
          open={deleteDialogOpen}
          onOpenChange={(_e, data) => setDeleteDialogOpen(data.open)}
        >
          <DialogTrigger>
            <Button
              appearance="subtle"
              icon={<Delete20Regular />}
              style={{ color: tokens.colorPaletteRedForeground1 }}
            >
              Delete
            </Button>
          </DialogTrigger>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Confirm Delete</DialogTitle>
              <DialogContent>
                Are you sure you want to delete this {isNode ? 'component' : 'data flow'}?
                {isNode && ' All connected data flows will also be removed.'}
              </DialogContent>
              <DialogActions>
                <DialogTrigger>
                  <Button appearance="secondary">Cancel</Button>
                </DialogTrigger>
                <Button appearance="primary" onClick={handleDelete}>
                  Delete
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      </div>
    </div>
  );
}
