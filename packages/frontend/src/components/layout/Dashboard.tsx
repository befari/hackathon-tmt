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
} from '@fluentui/react-components';
import { Add20Regular, Shield20Regular, ArrowUpload20Regular, MoreVertical20Regular, Edit20Regular, Delete20Regular } from '@fluentui/react-icons';
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
    '&:hover': {
      boxShadow: tokens.shadow8,
    },
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
  const [editModel, setEditModel] = useState<{ id: string; name: string; description: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteModel, setDeleteModel] = useState<{ id: string; name: string } | null>(null);

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
    await api.updateThreatModel(editModel.id, { name: editModel.name, description: editModel.description });
    setModels(prev => prev.map(m => m.id === editModel.id ? { ...m, name: editModel.name, description: editModel.description } : m));
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
          <Button
            appearance="secondary"
            icon={<ArrowUpload20Regular />}
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            title="Import a Microsoft Threat Modeling Tool file"
          >
            {importing ? 'Importing…' : 'Import .tm7'}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(_e, data) => setDialogOpen(data.open)}>
          <DialogTrigger>
            <Button appearance="primary" icon={<Add20Regular />} title="Create a new threat model">
              New Threat Model
            </Button>
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
              <CardHeader
                header={<Text weight="semibold">{model.name}</Text>}
                description={model.description || 'No description'}
                action={
                  <Menu>
                    <MenuTrigger>
                      <Button
                        appearance="subtle"
                        icon={<MoreVertical20Regular />}
                        size="small"
                        aria-label="Threat model actions"
                        title="More actions"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList>
                        <MenuItem
                          icon={<Edit20Regular />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditModel({ id: model.id, name: model.name, description: model.description || '' });
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
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Edit Threat Model</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <Input
                  placeholder="Threat model name"
                  value={editModel?.name || ''}
                  onChange={(_e, d) => setEditModel(prev => prev ? { ...prev, name: d.value } : null)}
                  aria-label="Threat model name"
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={editModel?.description || ''}
                  onChange={(_e, d) => setEditModel(prev => prev ? { ...prev, description: d.value } : null)}
                  rows={3}
                  aria-label="Threat model description"
                />
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => { setEditDialogOpen(false); setEditModel(null); }}>Cancel</Button>
              <Button appearance="primary" onClick={handleEditModel} disabled={!editModel?.name.trim()}>Save</Button>
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
