import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Badge,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Tooltip,
} from '@fluentui/react-components';
import { Delete20Regular, Dismiss16Regular, ShieldTask20Regular, Add16Regular, ArrowRight16Regular } from '@fluentui/react-icons';
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
  threatItem: {
    padding: '6px 8px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    borderLeft: `3px solid ${tokens.colorPaletteRedBorderActive}`,
    marginBottom: '4px',
  },
});

const DATA_CLASSIFICATIONS = ['public', 'internal', 'confidential', 'restricted'] as const;

interface PropertyPanelProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  threatModelId?: string;
  onClose: () => void;
  onNodeUpdated: (id: string, data: Record<string, any>) => void;
  onEdgeUpdated: (id: string, data: Record<string, any>) => void;
  onNodeDeleted: (id: string) => void;
  onEdgeDeleted: (id: string) => void;
}

export function PropertyPanel({
  selectedNode,
  selectedEdge,
  threatModelId,
  onClose,
  onNodeUpdated,
  onEdgeUpdated,
  onNodeDeleted,
  onEdgeDeleted,
}: PropertyPanelProps) {
  const styles = useStyles();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

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

  const [saved, setSaved] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [linkedThreats, setLinkedThreats] = useState<any[]>([]);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add threat dialog state
  const [addThreatOpen, setAddThreatOpen] = useState(false);
  const [newThreat, setNewThreat] = useState({ title: '', description: '', strideCategory: 'SPOOFING', severity: 'MEDIUM' });

  // Load linked threats when a node or edge is selected
  useEffect(() => {
    if (selectedNode && threatModelId) {
      api.listThreats({ threatModelId, componentId: selectedNode.id })
        .then(({ data }: any) => setLinkedThreats(data || []))
        .catch(() => setLinkedThreats([]));
    } else if (selectedEdge && threatModelId) {
      api.listThreats({ threatModelId, dataFlowId: selectedEdge.id })
        .then(({ data }: any) => setLinkedThreats(data || []))
        .catch(() => setLinkedThreats([]));
    } else {
      setLinkedThreats([]);
    }
  }, [selectedNode, selectedEdge, threatModelId]);

  // Populate fields when selection changes
  useEffect(() => {
    if (selectedNode) {
      const d = selectedNode.data as Record<string, any>;
      setName(d.label || '');
      setType(d.componentType || 'PROCESS');
      setDescription(d.description || '');
      setSourceFiles((d.sourceFiles || []).join(', '));
      setSaved(false);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (selectedEdge) {
      setLabel((selectedEdge.label as string) || '');
      const d = (selectedEdge.data || {}) as Record<string, any>;
      setProtocol(d.protocol || '');
      setDataClassification(d.dataClassification || '');
      setCrossesTrustBoundary(selectedEdge.animated || false);
      setSaved(false);
    }
  }, [selectedEdge]);

  // Auto-save node properties with debounce
  const saveNodeRef = useRef({ name, type, description, sourceFiles });
  saveNodeRef.current = { name, type, description, sourceFiles };

  useEffect(() => {
    if (!selectedNode) return;
    // Skip the initial population
    const d = selectedNode.data as Record<string, any>;
    const initialName = d.label || '';
    const initialDesc = d.description || '';
    const initialFiles = (d.sourceFiles || []).join(', ');
    if (name === initialName && description === initialDesc && sourceFiles === initialFiles) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const cur = saveNodeRef.current;
      const payload = {
        name: cur.name,
        type: cur.type,
        description: cur.description,
        sourceFiles: cur.sourceFiles.split(',').map((s) => s.trim()).filter(Boolean),
      };
      try {
        await api.updateComponent(selectedNode.id, payload);
        onNodeUpdated(selectedNode.id, payload);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }, 800);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [name, description, sourceFiles, selectedNode, onNodeUpdated]);

  // Auto-save edge properties with debounce
  const saveEdgeRef = useRef({ label, protocol, dataClassification, crossesTrustBoundary });
  saveEdgeRef.current = { label, protocol, dataClassification, crossesTrustBoundary };

  useEffect(() => {
    if (!selectedEdge) return;
    const initialLabel = (selectedEdge.label as string) || '';
    const d = (selectedEdge.data || {}) as Record<string, any>;
    const initialProto = d.protocol || '';
    const initialClass = d.dataClassification || '';
    const initialBoundary = selectedEdge.animated || false;
    if (label === initialLabel && protocol === initialProto && dataClassification === initialClass && crossesTrustBoundary === initialBoundary) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const cur = saveEdgeRef.current;
      const payload = {
        label: cur.label,
        protocol: cur.protocol,
        dataClassification: cur.dataClassification,
        crossesTrustBoundary: cur.crossesTrustBoundary,
      };
      try {
        await api.updateDataFlow(selectedEdge.id, payload);
        onEdgeUpdated(selectedEdge.id, payload);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }, 800);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [label, protocol, dataClassification, crossesTrustBoundary, selectedEdge, onEdgeUpdated]);

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

  const handleAddThreat = useCallback(async () => {
    if (!threatModelId) return;
    const payload: Record<string, any> = {
      ...newThreat,
      threatModelId,
    };
    if (selectedNode) payload.componentId = selectedNode.id;
    if (selectedEdge) payload.dataFlowId = selectedEdge.id;
    try {
      await api.createThreat(payload);
      // Reload linked threats
      const filter: Record<string, string> = { threatModelId };
      if (selectedNode) filter.componentId = selectedNode.id;
      if (selectedEdge) filter.dataFlowId = selectedEdge.id;
      const { data } = await api.listThreats(filter) as any;
      setLinkedThreats(data || []);
      setAddThreatOpen(false);
      setNewThreat({ title: '', description: '', strideCategory: 'SPOOFING', severity: 'MEDIUM' });
    } catch (err) {
      console.error('Failed to create threat:', err);
    }
  }, [threatModelId, selectedNode, selectedEdge, newThreat]);

  const navigateToThreat = useCallback((threatId: string) => {
    if (id) navigate(`/model/${id}/threats?highlight=${threatId}`);
  }, [id, navigate]);

  const isNode = !!selectedNode;
  const isEdge = !!selectedEdge;
  const isAnnotation = selectedNode?.type === 'textAnnotation';

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Text weight="semibold" size={300}>
          {isNode ? (isAnnotation ? 'Annotation Properties' : 'Component Properties') : 'Data Flow Properties'}
        </Text>
        <Tooltip content="Close" relationship="label">
          <Button
            appearance="subtle"
            icon={<Dismiss16Regular />}
            size="small"
            aria-label="Close properties panel"
            onClick={onClose}
          />
        </Tooltip>
      </div>

      <div className={styles.body}>
        {isNode && isAnnotation && (
          <>
            <div className={styles.field}>
              <Text size={200} weight="semibold">Annotation Text</Text>
              <Textarea
                value={name}
                onChange={(_e, d) => setName(d.value)}
                rows={10}
                placeholder="Type your annotation..."
                style={{ width: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              />
            </div>
            <Text size={200} style={{ opacity: 0.5 }}>
              Tip: Double-click the annotation on the canvas to edit inline
            </Text>
          </>
        )}
        {isNode && !isAnnotation && (
          <>
            <div className={styles.field}>
              <Text size={200} weight="semibold">Name</Text>
              <Input value={name} onChange={(_e, d) => setName(d.value)} />
            </div>
            <Text size={200} style={{ opacity: 0.6 }}>Type: {type.replace(/_/g, ' ')}</Text>
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

        {/* Threats section — shared for nodes and edges */}
        <Divider />
        <div className={styles.field}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text size={200} weight="semibold">
              <ShieldTask20Regular style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Threats ({linkedThreats.length})
            </Text>
            <Tooltip content="Add a new threat" relationship="description">
              <Button
                size="small"
                appearance="subtle"
                icon={<Add16Regular />}
                aria-label="Add threat"
                onClick={() => setAddThreatOpen(true)}
              >
                Add
              </Button>
            </Tooltip>
          </div>
          {linkedThreats.map((t: any) => (
            <div
              key={t.id}
              className={styles.threatItem}
              style={{ cursor: 'pointer' }}
              onClick={() => navigateToThreat(t.id)}
              title="Click to view in Threats list"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToThreat(t.id); } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text size={200} weight="semibold" block>{t.title}</Text>
                <ArrowRight16Regular style={{ opacity: 0.5, flexShrink: 0 }} />
              </div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                <Badge size="small" color={
                  t.severity === 'CRITICAL' ? 'danger' :
                  t.severity === 'HIGH' ? 'important' :
                  t.severity === 'MEDIUM' ? 'warning' : 'informative'
                }>{t.severity}</Badge>
                <Badge size="small" appearance="outline">{t.status.replace('_', ' ')}</Badge>
              </div>
            </div>
          ))}
          {linkedThreats.length === 0 && (
            <Text size={200} style={{ opacity: 0.5, fontStyle: 'italic' }}>No threats linked</Text>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        {saved && (
          <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1, alignSelf: 'center', flex: 1 }}>
            ✓ Saved
          </Text>
        )}
        {!saved && <div style={{ flex: 1 }} />}
        <Dialog
          open={deleteDialogOpen}
          onOpenChange={(_e, data) => setDeleteDialogOpen(data.open)}
        >
          <DialogTrigger>
            <Tooltip content="Delete this component or data flow" relationship="description">
              <Button
                appearance="subtle"
                icon={<Delete20Regular />}
                style={{ color: tokens.colorPaletteRedForeground1 }}
              >
                Delete
              </Button>
            </Tooltip>
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

      {/* Add Threat Dialog */}
      <Dialog open={addThreatOpen} onOpenChange={(_e, d) => setAddThreatOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Add Threat</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                <Input
                  placeholder="Threat title"
                  value={newThreat.title}
                  onChange={(_e, d) => setNewThreat({ ...newThreat, title: d.value })}
                />
                <Textarea
                  placeholder="Description"
                  value={newThreat.description}
                  onChange={(_e, d) => setNewThreat({ ...newThreat, description: d.value })}
                  rows={3}
                />
                <Dropdown
                  value={newThreat.strideCategory}
                  selectedOptions={[newThreat.strideCategory]}
                  onOptionSelect={(_e, d) => setNewThreat({ ...newThreat, strideCategory: d.optionValue || 'SPOOFING' })}
                >
                  {['SPOOFING', 'TAMPERING', 'REPUDIATION', 'INFORMATION_DISCLOSURE', 'DENIAL_OF_SERVICE', 'ELEVATION_OF_PRIVILEGE'].map((c) => (
                    <Option key={c} value={c}>{c.replace(/_/g, ' ')}</Option>
                  ))}
                </Dropdown>
                <Dropdown
                  value={newThreat.severity}
                  selectedOptions={[newThreat.severity]}
                  onOptionSelect={(_e, d) => setNewThreat({ ...newThreat, severity: d.optionValue || 'MEDIUM' })}
                >
                  {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((s) => (
                    <Option key={s} value={s}>{s}</Option>
                  ))}
                </Dropdown>
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger>
                <Button appearance="secondary">Cancel</Button>
              </DialogTrigger>
              <Button appearance="primary" onClick={handleAddThreat} disabled={!newThreat.title.trim()}>
                Add Threat
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
