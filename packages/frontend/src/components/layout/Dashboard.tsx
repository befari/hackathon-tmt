import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Card,
  CardHeader,
  Badge,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Input,
  Textarea,
  Checkbox,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Tooltip,
  Divider,
} from '@fluentui/react-components';
import { Add20Regular, Shield20Regular, ArrowUpload20Regular, MoreVertical20Regular, Edit20Regular, Delete20Regular, Info20Regular } from '@fluentui/react-icons';
import type { ThreatModel } from '@superior-tmt/shared';
import { api } from '../../api/client';
import { useToast } from '../shared/ToastContext';

const useStyles = makeStyles({
  page: {
    padding: '32px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  card: {
    cursor: 'pointer',
    position: 'relative' as const,
    height: '140px',
    overflow: 'hidden' as const,
    '&:hover': {
      boxShadow: tokens.shadow8,
    },
  },
  cardMenu: {
    position: 'absolute' as const,
    top: '8px',
    right: '8px',
    zIndex: 1,
  },
  cardMeta: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '64px 32px',
    color: tokens.colorNeutralForeground3,
  },
  detailSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  detailLabel: {
    fontSize: '12px',
    fontWeight: 600 as const,
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase' as const,
  },
  detailValue: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'pre-wrap' as const,
  },
  chipList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
  },
});

export function Dashboard() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [models, setModels] = useState<(ThreatModel & { _count?: Record<string, number> })[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [contributeAsRef, setContributeAsRef] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editModel, setEditModel] = useState<{
    id: string; name: string; description: string;
    m1Owner: string; devOwners: string[]; assumptions: string; externalDependencies: string;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteModel, setDeleteModel] = useState<{ id: string; name: string } | null>(null);
  const [detailModel, setDetailModel] = useState<ThreatModel | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [devOwnerInput, setDevOwnerInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listThreatModels()
      .then((r: any) => setModels(r.data || []))
      .catch(console.error);
  }, []);

  const handleCreate = async () => {
    const { data } = await api.createThreatModel({ name: newName, description: newDesc });
    setDialogOpen(false);
    setNewName('');
    setNewDesc('');
    navigate(`/model/${data.id}`);
  };

  const handleImportTm7 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportDialogOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const result = await api.importTm7(importFile, contributeAsRef);
      setImportDialogOpen(false);
      setImportFile(null);
      navigate(`/model/${result.threatModel.id}`);
    } catch (err: any) {
      console.error('Import failed:', err);
      showToast(`Import failed: ${err.message}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleEditModel = async () => {
    if (!editModel) return;
    await api.updateThreatModel(editModel.id, {
      name: editModel.name,
      description: editModel.description,
      m1Owner: editModel.m1Owner,
      devOwners: editModel.devOwners,
      assumptions: editModel.assumptions,
      externalDependencies: editModel.externalDependencies,
    });
    setModels(prev => prev.map(m => m.id === editModel.id ? {
      ...m,
      name: editModel.name,
      description: editModel.description,
      m1Owner: editModel.m1Owner,
      devOwners: editModel.devOwners,
      assumptions: editModel.assumptions,
      externalDependencies: editModel.externalDependencies,
    } : m));
    setEditDialogOpen(false);
    setEditModel(null);
  };

  const handleDeleteModel = async () => {
    if (!deleteModel) return;
    await api.deleteThreatModel(deleteModel.id);
    setModels(prev => prev.filter(m => m.id !== deleteModel.id));
    setDeleteDialogOpen(false);
    setDeleteModel(null);
  };

  const statusColor: Record<string, 'informative' | 'warning' | 'success' | 'important'> = {
    DRAFT: 'informative',
    ANALYZING: 'warning',
    READY: 'success',
    REVIEWED: 'important',
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>
          <Shield20Regular />
          <Text size={700} weight="bold">
            Threat Models
          </Text>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".tm7"
            style={{ display: 'none' }}
            onChange={handleImportTm7}
            aria-label="Import TM7 file"
          />
          <Tooltip content="Import a Microsoft Threat Modeling Tool file" relationship="description">
            <Button
              appearance="secondary"
              icon={<ArrowUpload20Regular />}
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? 'Importing…' : 'Import .tm7'}
            </Button>
          </Tooltip>
          <Dialog open={dialogOpen} onOpenChange={(_e, data) => setDialogOpen(data.open)}>
          <DialogTrigger>
            <Tooltip content="Create a new threat model" relationship="description">
              <Button appearance="primary" icon={<Add20Regular />}>
                New Threat Model
              </Button>
            </Tooltip>
          </DialogTrigger>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Create Threat Model</DialogTitle>
              <DialogContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  <Input
                    placeholder="Threat model name"
                    value={newName}
                    onChange={(_e, d) => setNewName(d.value)}
                    aria-label="Threat model name"
                  />
                  <Textarea
                    placeholder="Description (optional)"
                    value={newDesc}
                    onChange={(_e, d) => setNewDesc(d.value)}
                    rows={3}
                    aria-label="Threat model description"
                  />
                </div>
              </DialogContent>
              <DialogActions>
                <DialogTrigger>
                  <Button appearance="secondary">Cancel</Button>
                </DialogTrigger>
                <Button appearance="primary" onClick={handleCreate} disabled={!newName.trim()}>
                  Create
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
        </div>
      </div>

      {models.length === 0 ? (
        <div className={styles.empty}>
          <Shield20Regular style={{ fontSize: '48px', marginBottom: '16px' }} />
          <Text size={500} block>
            No threat models yet
          </Text>
          <Text size={300} block>
            Create your first threat model to get started
          </Text>
        </div>
      ) : (
        <div className={styles.grid}>
          {models.map((model) => (
            <Card key={model.id} className={styles.card} onClick={() => navigate(`/model/${model.id}`)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/model/${model.id}`); }}>
              <div className={styles.cardMenu}>
                <Menu>
                  <MenuTrigger>
                    <Tooltip content="More actions" relationship="label">
                      <Button
                        appearance="subtle"
                        icon={<MoreVertical20Regular />}
                        size="small"
                        aria-label="Threat model actions"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Tooltip>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem
                        icon={<Info20Regular />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailModel(model);
                          setDetailDialogOpen(true);
                        }}
                      >
                        View Details
                      </MenuItem>
                      <MenuItem
                        icon={<Edit20Regular />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditModel({
                            id: model.id, name: model.name, description: model.description || '',
                            m1Owner: model.m1Owner || '', devOwners: model.devOwners || [],
                            assumptions: model.assumptions || '', externalDependencies: model.externalDependencies || '',
                          });
                          setDevOwnerInput('');
                          setEditDialogOpen(true);
                        }}
                      >
                        Edit Details
                      </MenuItem>
                      <MenuItem
                        icon={<Delete20Regular />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteModel({ id: model.id, name: model.name });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        Delete
                      </MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
              </div>
              <CardHeader
                header={<Text weight="semibold">{model.name}</Text>}
                description={
                  <Text size={200} style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const,
                    overflow: 'hidden',
                    color: tokens.colorNeutralForeground3,
                  }}>
                    {model.description || 'No description'}
                  </Text>
                }
              />
              <div className={styles.cardMeta}>
                <Badge appearance="outline" color={statusColor[model.status] || 'informative'}>
                  {model.status}
                </Badge>
                {model._count?.diagrams !== undefined && (
                  <Badge appearance="outline">{model._count.diagrams} diagrams</Badge>
                )}
                {model._count?.threats !== undefined && (
                  <Badge appearance="outline">{model._count.threats} threats</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={importDialogOpen} onOpenChange={(_e, data) => { if (!data.open) { setImportDialogOpen(false); setImportFile(null); } }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Import .tm7 File</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                <Text>
                  Importing <Text weight="semibold">{importFile?.name}</Text> will create a new threat model with all diagrams, components, data flows, and threats.
                </Text>
                <Checkbox
                  checked={contributeAsRef}
                  onChange={(_e, data) => setContributeAsRef(!!data.checked)}
                  label="Use as AI reference example (helps improve future DFD generation)"
                />
                <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
                  If enabled, the structure of this threat model will be used as a few-shot example when the AI generates new DFDs.
                </Text>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => { setImportDialogOpen(false); setImportFile(null); }}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={handleConfirmImport} disabled={importing}>
                {importing ? 'Importing…' : 'Import'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Edit Threat Model Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(_e, data) => { if (!data.open) { setEditDialogOpen(false); setEditModel(null); } }}>
        <DialogSurface style={{ maxWidth: '560px', width: '100%' }}>
          <DialogBody>
            <DialogTitle>Edit Threat Model</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <div>
                  <Text size={200} weight="semibold" style={{ marginBottom: '4px', display: 'block' }}>Name</Text>
                  <Input
                    placeholder="Threat model name"
                    value={editModel?.name || ''}
                    onChange={(_e, d) => setEditModel(prev => prev ? { ...prev, name: d.value } : null)}
                    aria-label="Threat model name"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <Text size={200} weight="semibold" style={{ marginBottom: '4px', display: 'block' }}>Description</Text>
                  <Textarea
                    placeholder="Description (optional)"
                    value={editModel?.description || ''}
                    onChange={(_e, d) => setEditModel(prev => prev ? { ...prev, description: d.value } : null)}
                    rows={3}
                    aria-label="Threat model description"
                    style={{ width: '100%' }}
                  />
                </div>
                <Divider />
                <div>
                  <Text size={200} weight="semibold" style={{ marginBottom: '4px', display: 'block' }}>M1 Owner</Text>
                  <Input
                    placeholder="e.g. John Smith"
                    value={editModel?.m1Owner || ''}
                    onChange={(_e, d) => setEditModel(prev => prev ? { ...prev, m1Owner: d.value } : null)}
                    aria-label="M1 Owner"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <Text size={200} weight="semibold" style={{ marginBottom: '4px', display: 'block' }}>Dev Owners</Text>
                  <div className={styles.chipList}>
                    {editModel?.devOwners?.map((owner, i) => (
                      <Badge key={i} appearance="filled" color="brand" style={{ cursor: 'pointer' }}
                        onClick={() => setEditModel(prev => prev ? { ...prev, devOwners: prev.devOwners.filter((_, idx) => idx !== i) } : null)}
                      >
                        {owner} ✕
                      </Badge>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    <Input
                      placeholder="Add dev owner..."
                      value={devOwnerInput}
                      onChange={(_e, d) => setDevOwnerInput(d.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && devOwnerInput.trim()) {
                          e.preventDefault();
                          setEditModel(prev => prev ? { ...prev, devOwners: [...prev.devOwners, devOwnerInput.trim()] } : null);
                          setDevOwnerInput('');
                        }
                      }}
                      style={{ flex: 1 }}
                      aria-label="Add dev owner"
                    />
                    <Button
                      appearance="subtle"
                      size="small"
                      disabled={!devOwnerInput.trim()}
                      onClick={() => {
                        if (devOwnerInput.trim()) {
                          setEditModel(prev => prev ? { ...prev, devOwners: [...prev.devOwners, devOwnerInput.trim()] } : null);
                          setDevOwnerInput('');
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
                <Divider />
                <div>
                  <Text size={200} weight="semibold" style={{ marginBottom: '4px', display: 'block' }}>Assumptions</Text>
                  <Textarea
                    placeholder="Document key assumptions about the system"
                    value={editModel?.assumptions || ''}
                    onChange={(_e, d) => setEditModel(prev => prev ? { ...prev, assumptions: d.value } : null)}
                    rows={3}
                    aria-label="Assumptions"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <Text size={200} weight="semibold" style={{ marginBottom: '4px', display: 'block' }}>External Dependencies</Text>
                  <Textarea
                    placeholder="Third-party services, libraries, APIs"
                    value={editModel?.externalDependencies || ''}
                    onChange={(_e, d) => setEditModel(prev => prev ? { ...prev, externalDependencies: d.value } : null)}
                    rows={3}
                    aria-label="External Dependencies"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => { setEditDialogOpen(false); setEditModel(null); }}>Cancel</Button>
              <Button appearance="primary" onClick={handleEditModel} disabled={!editModel?.name.trim()}>Save</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={(_e, data) => { if (!data.open) { setDetailDialogOpen(false); setDetailModel(null); } }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{detailModel?.name || 'Threat Model Details'}</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <div className={styles.detailSection}>
                  <span className={styles.detailLabel}>Description</span>
                  <span className={styles.detailValue}>{detailModel?.description || 'No description'}</span>
                </div>
                <div className={styles.detailSection}>
                  <span className={styles.detailLabel}>Status</span>
                  <div>
                    <Badge appearance="outline" color={statusColor[detailModel?.status || ''] || 'informative'}>
                      {detailModel?.status}
                    </Badge>
                  </div>
                </div>
                <Divider />
                <div className={styles.detailSection}>
                  <span className={styles.detailLabel}>M1 Owner</span>
                  <span className={styles.detailValue}>{detailModel?.m1Owner || 'Not assigned'}</span>
                </div>
                <div className={styles.detailSection}>
                  <span className={styles.detailLabel}>Dev Owners</span>
                  {detailModel?.devOwners?.length ? (
                    <div className={styles.chipList}>
                      {detailModel.devOwners.map((owner, i) => (
                        <Badge key={i} appearance="filled" color="brand">{owner}</Badge>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.detailValue}>None assigned</span>
                  )}
                </div>
                <Divider />
                <div className={styles.detailSection}>
                  <span className={styles.detailLabel}>Assumptions</span>
                  <span className={styles.detailValue}>{detailModel?.assumptions || 'None documented'}</span>
                </div>
                <div className={styles.detailSection}>
                  <span className={styles.detailLabel}>External Dependencies</span>
                  <span className={styles.detailValue}>{detailModel?.externalDependencies || 'None documented'}</span>
                </div>
                <Divider />
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className={styles.detailSection} style={{ flex: 1 }}>
                    <span className={styles.detailLabel}>Created</span>
                    <span className={styles.detailValue}>{detailModel ? new Date(detailModel.createdAt).toLocaleDateString() : ''}</span>
                  </div>
                  <div className={styles.detailSection} style={{ flex: 1 }}>
                    <span className={styles.detailLabel}>Updated</span>
                    <span className={styles.detailValue}>{detailModel ? new Date(detailModel.updatedAt).toLocaleDateString() : ''}</span>
                  </div>
                  <div className={styles.detailSection} style={{ flex: 1 }}>
                    <span className={styles.detailLabel}>Version</span>
                    <span className={styles.detailValue}>{detailModel?.version}</span>
                  </div>
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => { setDetailDialogOpen(false); setDetailModel(null); }}>Close</Button>
              <Button appearance="primary" onClick={() => {
                setDetailDialogOpen(false);
                if (detailModel) {
                  setEditModel({
                    id: detailModel.id, name: detailModel.name, description: detailModel.description || '',
                    m1Owner: detailModel.m1Owner || '', devOwners: detailModel.devOwners || [],
                    assumptions: detailModel.assumptions || '', externalDependencies: detailModel.externalDependencies || '',
                  });
                  setDevOwnerInput('');
                  setEditDialogOpen(true);
                }
                setDetailModel(null);
              }}>Edit</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Delete Threat Model Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(_e, data) => { if (!data.open) { setDeleteDialogOpen(false); setDeleteModel(null); } }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete Threat Model</DialogTitle>
            <DialogContent>
              <Text>
                Are you sure you want to delete <Text weight="semibold">{deleteModel?.name}</Text>? This will permanently remove all diagrams, components, data flows, and threats. This action cannot be undone.
              </Text>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => { setDeleteDialogOpen(false); setDeleteModel(null); }}>Cancel</Button>
              <Button appearance="primary" style={{ backgroundColor: tokens.colorPaletteRedBackground3 }} onClick={handleDeleteModel}>Delete</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
