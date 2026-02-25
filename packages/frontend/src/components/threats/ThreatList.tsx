import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Badge,
  Card,
  CardHeader,
  Dropdown,
  Option,
  Spinner,
  Button,
  Textarea,
  CounterBadge,
  Divider,
  Input,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
} from '@fluentui/react-components';
import {
  Comment20Regular,
  ChevronDown20Regular,
  ChevronUp20Regular,
  Add20Regular,
} from '@fluentui/react-icons';
import { api } from '../../api/client';
import type { Threat, Comment as TmtComment } from '@superior-tmt/shared';

const useStyles = makeStyles({
  container: {
    padding: '24px 32px',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  filters: {
    display: 'flex',
    gap: '12px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    '&:hover': {
      boxShadow: tokens.shadow8,
    },
  },
  cardBody: {
    padding: '0 16px 16px',
  },
  badges: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    gap: '12px',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '64px 32px',
    color: tokens.colorNeutralForeground3,
  },
  editRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '12px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  commentSection: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  commentThread: {
    marginBottom: '10px',
    padding: '8px',
    borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
    paddingLeft: '12px',
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
    marginLeft: '16px',
    marginTop: '6px',
    paddingLeft: '8px',
    borderLeft: `2px solid ${tokens.colorNeutralStroke2}`,
  },
  commentInput: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
});

const severityColors: Record<string, 'danger' | 'important' | 'warning' | 'informative' | 'subtle'> = {
  CRITICAL: 'danger',
  HIGH: 'important',
  MEDIUM: 'warning',
  LOW: 'informative',
  INFO: 'subtle',
};

const strideLabels: Record<string, string> = {
  SPOOFING: 'Spoofing',
  TAMPERING: 'Tampering',
  REPUDIATION: 'Repudiation',
  INFO_DISCLOSURE: 'Info Disclosure',
  DENIAL_OF_SERVICE: 'Denial of Service',
  ELEVATION_OF_PRIVILEGE: 'Elevation of Privilege',
};

export function ThreatList() {
  const styles = useStyles();
  const { id } = useParams<{ id: string }>();
  const [threats, setThreats] = useState<Threat[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedThreat, setExpandedThreat] = useState<string | null>(null);
  const [threatComments, setThreatComments] = useState<Record<string, TmtComment[]>>({});
  const [newCommentText, setNewCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newThreat, setNewThreat] = useState({ title: '', description: '', strideCategory: 'SPOOFING', severity: 'MEDIUM' });

  const loadThreats = useCallback(() => {
    if (!id) return;
    const params = new URLSearchParams({ threatModelId: id });
    if (severityFilter) params.set('severity', severityFilter);
    if (statusFilter) params.set('status', statusFilter);

    fetch(`/api/threats?${params}`)
      .then((r) => r.json())
      .then(({ data }) => {
        setThreats(data || []);
        // Extract comment counts from _count
        const counts: Record<string, number> = {};
        for (const t of data || []) {
          if (t._count?.comments) counts[t.id] = t._count.comments;
        }
        setCommentCounts(counts);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id, severityFilter, statusFilter]);

  useEffect(() => {
    loadThreats();
  }, [loadThreats]);

  const toggleComments = useCallback(async (threatId: string) => {
    if (expandedThreat === threatId) {
      setExpandedThreat(null);
      return;
    }
    setExpandedThreat(threatId);
    setNewCommentText('');
    try {
      const { data } = await api.getComments({ threatId });
      setThreatComments((prev) => ({ ...prev, [threatId]: data || [] }));
    } catch {
      setThreatComments((prev) => ({ ...prev, [threatId]: [] }));
    }
  }, [expandedThreat]);

  const handleAddComment = useCallback(async (threatId: string) => {
    if (!newCommentText.trim()) return;
    setSubmitting(true);
    try {
      await api.createComment({
        body: newCommentText,
        author: 'Current User',
        threatId,
      });
      setNewCommentText('');
      const { data } = await api.getComments({ threatId });
      setThreatComments((prev) => ({ ...prev, [threatId]: data || [] }));
      setCommentCounts((prev) => ({ ...prev, [threatId]: (prev[threatId] || 0) + 1 }));
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmitting(false);
    }
  }, [newCommentText]);

  const handleStatusChange = useCallback(async (threatId: string, newStatus: string) => {
    try {
      await api.updateThreat(threatId, { status: newStatus });
      setThreats((prev) =>
        prev.map((t) => (t.id === threatId ? { ...t, status: newStatus as Threat['status'] } : t))
      );
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }, []);

  const handleSeverityChange = useCallback(async (threatId: string, newSeverity: string) => {
    try {
      await api.updateThreat(threatId, { severity: newSeverity });
      setThreats((prev) =>
        prev.map((t) => (t.id === threatId ? { ...t, severity: newSeverity as Threat['severity'] } : t))
      );
    } catch (err) {
      console.error('Failed to update severity:', err);
    }
  }, []);

  const handleCreateThreat = useCallback(async () => {
    if (!id || !newThreat.title.trim() || !newThreat.description.trim()) return;
    try {
      await api.createThreat({
        ...newThreat,
        threatModelId: id,
      });
      setCreateOpen(false);
      setNewThreat({ title: '', description: '', strideCategory: 'SPOOFING', severity: 'MEDIUM' });
      loadThreats();
    } catch (err) {
      console.error('Failed to create threat:', err);
    }
  }, [id, newThreat, loadThreats]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size="medium" />
        <Text>Loading threats...</Text>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={600} weight="semibold">
          Threats ({threats.length})
        </Text>
        <div className={styles.filters}>
          <Dropdown
            placeholder="Severity"
            value={severityFilter}
            onOptionSelect={(_e, d) => setSeverityFilter(d.optionValue as string || '')}
          >
            <Option value="">All Severities</Option>
            <Option value="CRITICAL">Critical</Option>
            <Option value="HIGH">High</Option>
            <Option value="MEDIUM">Medium</Option>
            <Option value="LOW">Low</Option>
            <Option value="INFO">Info</Option>
          </Dropdown>
          <Dropdown
            placeholder="Status"
            value={statusFilter}
            onOptionSelect={(_e, d) => setStatusFilter(d.optionValue as string || '')}
          >
            <Option value="">All Statuses</Option>
            <Option value="OPEN">Open</Option>
            <Option value="MITIGATED">Mitigated</Option>
            <Option value="ACCEPTED">Accepted</Option>
            <Option value="OUT_OF_SCOPE">Out of Scope</Option>
          </Dropdown>
          <Dialog open={createOpen} onOpenChange={(_e, data) => setCreateOpen(data.open)}>
            <DialogTrigger>
              <Button appearance="primary" icon={<Add20Regular />}>Add Threat</Button>
            </DialogTrigger>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Add Threat</DialogTitle>
                <DialogContent>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                    <Input
                      placeholder="Threat title"
                      value={newThreat.title}
                      onChange={(_e, d) => setNewThreat((p) => ({ ...p, title: d.value }))}
                    />
                    <Textarea
                      placeholder="Description of the threat..."
                      value={newThreat.description}
                      onChange={(_e, d) => setNewThreat((p) => ({ ...p, description: d.value }))}
                      rows={3}
                    />
                    <Dropdown
                      value={strideLabels[newThreat.strideCategory] || newThreat.strideCategory}
                      selectedOptions={[newThreat.strideCategory]}
                      onOptionSelect={(_e, d) => setNewThreat((p) => ({ ...p, strideCategory: d.optionValue as string }))}
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
      </div>

      {threats.length === 0 ? (
        <div className={styles.empty}>
          <Text size={500} block>
            No threats found
          </Text>
          <Text size={300} block>
            Generate threats from the DFD or add them manually
          </Text>
        </div>
      ) : (
        <div className={styles.list}>
          {threats.map((threat) => (
            <Card key={threat.id} className={styles.card}>
              <CardHeader
                header={<Text weight="semibold">{threat.title}</Text>}
                description={threat.description.substring(0, 200)}
              />
              <div className={styles.cardBody}>
                <div className={styles.badges}>
                  <Badge color={severityColors[threat.severity] || 'informative'}>
                    {threat.severity}
                  </Badge>
                  <Badge appearance="outline">
                    {strideLabels[threat.strideCategory] || threat.strideCategory}
                  </Badge>
                  <Badge
                    appearance="outline"
                    color={threat.status === 'OPEN' ? 'danger' : 'success'}
                  >
                    {threat.status.replace('_', ' ')}
                  </Badge>
                  {threat.aiGenerated && (
                    <Badge appearance="outline" color="informative">
                      AI Generated
                    </Badge>
                  )}
                  {(threat as any).component && (
                    <Badge appearance="outline" color="brand">
                      📦 {(threat as any).component.name}
                    </Badge>
                  )}
                  {(threat as any).dataFlow && (
                    <Badge appearance="outline" color="brand">
                      🔗 {(threat as any).dataFlow.label}
                    </Badge>
                  )}
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={expandedThreat === threat.id ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
                    onClick={() => toggleComments(threat.id)}
                  >
                    <Comment20Regular style={{ marginRight: '4px' }} />
                    {commentCounts[threat.id] || 0}
                  </Button>
                </div>

                {/* Inline status & severity editing */}
                <div className={styles.editRow}>
                  <Text size={200}>Status:</Text>
                  <Dropdown
                    size="small"
                    value={threat.status.replace('_', ' ')}
                    selectedOptions={[threat.status]}
                    onOptionSelect={(_e, d) => handleStatusChange(threat.id, d.optionValue as string)}
                    style={{ minWidth: '140px' }}
                  >
                    <Option value="OPEN">Open</Option>
                    <Option value="MITIGATED">Mitigated</Option>
                    <Option value="ACCEPTED">Accepted</Option>
                    <Option value="OUT_OF_SCOPE">Out of Scope</Option>
                  </Dropdown>
                  <Text size={200}>Severity:</Text>
                  <Dropdown
                    size="small"
                    value={threat.severity}
                    selectedOptions={[threat.severity]}
                    onOptionSelect={(_e, d) => handleSeverityChange(threat.id, d.optionValue as string)}
                    style={{ minWidth: '120px' }}
                  >
                    <Option value="CRITICAL">Critical</Option>
                    <Option value="HIGH">High</Option>
                    <Option value="MEDIUM">Medium</Option>
                    <Option value="LOW">Low</Option>
                    <Option value="INFO">Info</Option>
                  </Dropdown>
                </div>

                {/* Expandable comment section */}
                {expandedThreat === threat.id && (
                  <div className={styles.commentSection}>
                    <Text weight="semibold" size={300} block style={{ marginBottom: '8px' }}>
                      Comments
                    </Text>

                    {(threatComments[threat.id] || []).length === 0 && (
                      <Text size={200} style={{ opacity: 0.6, display: 'block', marginBottom: '8px' }}>
                        No comments yet.
                      </Text>
                    )}

                    {(threatComments[threat.id] || []).map((comment) => (
                      <div key={comment.id} className={styles.commentThread}>
                        <div className={styles.commentMeta}>
                          <Text size={100} weight="semibold">{comment.author}</Text>
                          <Text size={100}>{new Date(comment.createdAt).toLocaleString()}</Text>
                          {comment.resolved && <Badge appearance="outline" color="success" size="small">Resolved</Badge>}
                        </div>
                        <div className={styles.commentBody}>
                          <Text size={200}>{comment.body}</Text>
                        </div>
                        {comment.replies?.map((reply) => (
                          <div key={reply.id} className={styles.reply}>
                            <div className={styles.commentMeta}>
                              <Text size={100} weight="semibold">{reply.author}</Text>
                              <Text size={100}>{new Date(reply.createdAt).toLocaleString()}</Text>
                            </div>
                            <Text size={200}>{reply.body}</Text>
                          </div>
                        ))}
                      </div>
                    ))}

                    <Divider style={{ margin: '8px 0' }} />
                    <div className={styles.commentInput}>
                      <Textarea
                        placeholder="Add a comment on this threat..."
                        value={newCommentText}
                        onChange={(_e, d) => setNewCommentText(d.value)}
                        style={{ flex: 1 }}
                        rows={2}
                      />
                      <Button
                        appearance="primary"
                        size="small"
                        onClick={() => handleAddComment(threat.id)}
                        disabled={!newCommentText.trim() || submitting}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
