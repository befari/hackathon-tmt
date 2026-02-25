import { useState, useEffect } from 'react';
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
} from '@fluentui/react-components';
import { Add20Regular, Shield20Regular } from '@fluentui/react-icons';
import type { ThreatModel } from '@superior-tmt/shared';

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
  const [models, setModels] = useState<(ThreatModel & { _count?: Record<string, number> })[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    fetch('/api/threat-models')
      .then((r) => r.json())
      .then((r) => setModels(r.data || []))
      .catch(console.error);
  }, []);

  const handleCreate = async () => {
    const res = await fetch('/api/threat-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, description: newDesc }),
    });
    const { data } = await res.json();
    setDialogOpen(false);
    setNewName('');
    setNewDesc('');
    navigate(`/model/${data.id}`);
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
        <Dialog open={dialogOpen} onOpenChange={(_e, data) => setDialogOpen(data.open)}>
          <DialogTrigger>
            <Button appearance="primary" icon={<Add20Regular />}>
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
                  />
                  <Textarea
                    placeholder="Description (optional)"
                    value={newDesc}
                    onChange={(_e, d) => setNewDesc(d.value)}
                    rows={3}
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
            <Card key={model.id} className={styles.card} onClick={() => navigate(`/model/${model.id}`)}>
              <CardHeader
                header={<Text weight="semibold">{model.name}</Text>}
                description={model.description || 'No description'}
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
    </div>
  );
}
