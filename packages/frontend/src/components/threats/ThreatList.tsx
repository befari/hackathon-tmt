import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Badge,
  Card,
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
  Edit20Regular,
  Eye20Regular,
  BrainCircuit20Regular,
  Delete20Regular,
} from '@fluentui/react-icons';
import { api } from '../../api/client';
import { useToast } from '../shared/ToastContext';
import { AIRatingWidget } from '../dfd/AIRatingWidget';
import type { Threat, Comment as TmtComment } from '@superior-tmt/shared';

const useStyles = makeStyles({
  container: {
    padding: '24px 32px',
    maxWidth: '1400px',
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
  const { showToast } = useToast();
  const [threats, setThreats] = useState<Threat[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [diagramFilter, setDiagramFilter] = useState<string>('');
  const [expandedThreat, setExpandedThreat] = useState<string | null>(null);
  const [threatComments, setThreatComments] = useState<Record<string, TmtComment[]>>({});
  const [newCommentText, setNewCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newThreat, setNewThreat] = useState({ title: '', description: '', strideCategory: 'SPOOFING', severity: 'MEDIUM' });
  const [editThreatId, setEditThreatId] = useState<string | null>(null);
  const [editThreat, setEditThreat] = useState<{ id: string; title: string; description: string; strideCategory: string; severity: string; mitigationNotes: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiGenerationId, setAiGenerationId] = useState<string | null>(null);
  const [deleteThreatTarget, setDeleteThreatTarget] = useState<{ id: string; title: string } | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const highlightRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to highlighted threat and expand it
  useEffect(() => {
    if (highlightId && !loading && threats.length > 0) {
      setExpandedThreat(highlightId);
      // Scroll after render
      requestAnimationFrame(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      // Clear the highlight param after scrolling
      const timeout = setTimeout(() => {
        setSearchParams((prev) => { prev.delete('highlight'); return prev; }, { replace: true });
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [highlightId, loading, threats]);

  const handleGenerateThreats = useCallback(async () => {
    if (!id || generating) return;
    setGenerating(true);
    try {
      const { data } = await api.generateThreats(id) as any;
      loadThreats();
      showToast(data.message, 'success');
      if (data.generationId) setAiGenerationId(data.generationId);
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate threats';
      showToast(msg, 'error');
    } finally {
      setGenerating(false);
    }
  }, [id, generating, loadThreats]);

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

  const handleEditThreat = useCallback(async () => {
    if (!editThreat) return;
    try {
      await api.updateThreat(editThreat.id, {
        title: editThreat.title,
        description: editThreat.description,
        strideCategory: editThreat.strideCategory,
        severity: editThreat.severity,
        mitigationNotes: editThreat.mitigationNotes,
      });
      setEditThreatId(null);
      setEditThreat(null);
      loadThreats();
    } catch (err) {
      console.error('Failed to update threat:', err);
    }
  }, [editThreat, loadThreats]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size="medium" />
        <Text>Loading threats...</Text>
      </div>
    );
  }

  // Extract unique diagrams from threats for filtering
  const diagrams = Array.from(
    new Map(
      threats
        .map((t: any) => t.dataFlow?.diagram)
        .filter(Boolean)
        .map((d: any) => [d.id, d.name])
    ).entries()
  ).map(([did, dname]) => ({ id: did, name: dname }));

  // Filter threats by diagram if filter is set
  const filteredThreats = diagramFilter
    ? threats.filter((t: any) => t.dataFlow?.diagram?.id === diagramFilter)
    : threats;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={600} weight="semibold">
          Threats ({filteredThreats.length}{diagramFilter ? ` / ${threats.length}` : ''})
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
          {diagrams.length > 0 && (
            <Dropdown
              placeholder="DFD Diagram"
              value={diagramFilter ? diagrams.find(d => d.id === diagramFilter)?.name || '' : ''}
              onOptionSelect={(_e, d) => setDiagramFilter(d.optionValue as string || '')}
            >
              <Option value="">All Diagrams</Option>
              {diagrams.map(d => (
                <Option key={d.id} value={d.id}>{d.name}</Option>
              ))}
            </Dropdown>
          )}
          <Button
            appearance="subtle"
            icon={<BrainCircuit20Regular />}
            onClick={handleGenerateThreats}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Auto-Generate'}
          </Button>
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
                      value={strideLabels[newThreat.strideCategory] || newThreat.strideCategory}
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
      </div>

      {filteredThreats.length === 0 ? (
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
          {filteredThreats.map((threat) => {
            const isEditing = editThreatId === threat.id;
            return (
            <Card
              key={threat.id}
              className={styles.card}
              ref={threat.id === highlightId ? highlightRef : undefined}
              style={threat.id === highlightId ? { outline: `2px solid ${tokens.colorBrandStroke1}`, outlineOffset: '2px' } : undefined}
            >
              <div className={styles.cardBody} style={{ padding: '16px' }}>
                {/* Header row: title + badges + actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <Input
                        value={editThreat?.title || ''}
                        onChange={(_e, d) => setEditThreat(prev => prev ? { ...prev, title: d.value } : null)}
                        style={{ width: '100%', fontWeight: 600 }}
                        aria-label="Threat title"
                      />
                    ) : (
                      <Text weight="semibold" size={400}>{threat.title}</Text>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {((threat as any).dataFlow?.diagramId || (threat as any).component?.diagramId) && (
                      <Button size="small" appearance="subtle" icon={<Eye20Regular />}
                        aria-label={`View ${threat.title} in DFD`} title="View in DFD"
                        onClick={() => {
                          const diagId = (threat as any).dataFlow?.diagramId || (threat as any).component?.diagramId;
                          const focusId = (threat as any).dataFlow?.id || (threat as any).component?.id;
                          navigate(`/model/${id}?diagram=${diagId}${focusId ? `&focus=${focusId}` : ''}`);
                        }}
                      />
                    )}
                    {isEditing ? (
                      <>
                        <Button size="small" appearance="primary" onClick={handleEditThreat} disabled={!editThreat?.title.trim()}>Save</Button>
                        <Button size="small" appearance="secondary" onClick={() => { setEditThreatId(null); setEditThreat(null); }}>Cancel</Button>
                      </>
                    ) : (
                      <Button size="small" appearance="subtle" icon={<Edit20Regular />}
                        aria-label={`Edit ${threat.title}`} title="Edit threat"
                        onClick={() => {
                          setEditThreatId(threat.id);
                          setEditThreat({
                            id: threat.id, title: threat.title, description: threat.description,
                            strideCategory: threat.strideCategory, severity: threat.severity,
                            mitigationNotes: (threat as any).mitigationNotes || '',
                          });
                        }}
                      />
                    )}
                    <Button size="small" appearance="subtle" icon={<Delete20Regular />}
                      style={{ color: tokens.colorPaletteRedForeground1 }}
                      aria-label={`Delete ${threat.title}`} title="Delete threat"
                      onClick={() => setDeleteThreatTarget({ id: threat.id, title: threat.title })}
                    />
                    <Button size="small" appearance="subtle"
                      icon={expandedThreat === threat.id ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
                      aria-label={expandedThreat === threat.id ? 'Collapse comments' : 'Expand comments'}
                      title={expandedThreat === threat.id ? 'Collapse comments' : 'Expand comments'}
                      onClick={() => toggleComments(threat.id)}
                    >
                      <Comment20Regular style={{ marginRight: '4px' }} />
                      {commentCounts[threat.id] || 0}
                    </Button>
                  </div>
                </div>

                {/* Badges row */}
                <div className={styles.badges}>
                  <Badge color={severityColors[threat.severity] || 'informative'}>{threat.severity}</Badge>
                  <Badge appearance="outline">{strideLabels[threat.strideCategory] || threat.strideCategory}</Badge>
                  <Badge appearance="outline" color={threat.status === 'OPEN' ? 'danger' : 'success'}>
                    {threat.status.replace('_', ' ')}
                  </Badge>
                  {threat.aiGenerated && <Badge appearance="outline" color="informative">AI Generated</Badge>}
                  {(threat as any).component && <Badge appearance="outline" color="brand">📦 {(threat as any).component.name}</Badge>}
                  {(threat as any).dataFlow && <Badge appearance="outline" color="brand">🔗 {(threat as any).dataFlow.label}</Badge>}
                  {(threat as any).dataFlow?.diagram && <Badge appearance="outline" color="subtle">📄 {(threat as any).dataFlow.diagram.name}</Badge>}
                </div>

                {/* Description */}
                <div style={{ marginTop: '12px' }}>
                  <Text size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: '4px' }}>
                    Description
                  </Text>
                  {isEditing ? (
                    <Textarea
                      value={editThreat?.description || ''}
                      onChange={(_e, d) => setEditThreat(prev => prev ? { ...prev, description: d.value } : null)}
                      rows={3} style={{ width: '100%' }}
                      aria-label="Threat description"
                    />
                  ) : (
                    <Text size={300} style={{ whiteSpace: 'pre-wrap' }}>{threat.description}</Text>
                  )}
                </div>

                {/* Mitigation */}
                <div style={{ marginTop: '12px' }}>
                  <Text size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: '4px' }}>
                    Mitigation
                  </Text>
                  {isEditing ? (
                    <Textarea
                      value={editThreat?.mitigationNotes || ''}
                      onChange={(_e, d) => setEditThreat(prev => prev ? { ...prev, mitigationNotes: d.value } : null)}
                      placeholder="Describe mitigation steps..."
                      rows={2} style={{ width: '100%' }}
                      aria-label="Mitigation notes"
                    />
                  ) : (
                    <Text size={300} style={{ whiteSpace: 'pre-wrap', fontStyle: (threat as any).mitigationNotes ? 'normal' : 'italic', opacity: (threat as any).mitigationNotes ? 1 : 0.5 }}>
                      {(threat as any).mitigationNotes || 'No mitigation specified'}
                    </Text>
                  )}
                </div>

                {/* Inline dropdowns for status, severity, STRIDE (editing) */}
                <div className={styles.editRow}>
                  <Text size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground3 }}>Status:</Text>
                  <Dropdown
                    size="small"
                    value={isEditing ? (editThreat?.severity ? threat.status.replace('_', ' ') : '') : threat.status.replace('_', ' ')}
                    selectedOptions={[threat.status]}
                    onOptionSelect={(_e, d) => handleStatusChange(threat.id, d.optionValue as string)}
                    style={{ minWidth: '140px' }}
                    aria-label="Threat status"
                  >
                    <Option value="OPEN">Open</Option>
                    <Option value="MITIGATED">Mitigated</Option>
                    <Option value="ACCEPTED">Accepted</Option>
                    <Option value="OUT_OF_SCOPE">Out of Scope</Option>
                  </Dropdown>
                  <Text size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground3 }}>Severity:</Text>
                  <Dropdown
                    size="small"
                    value={threat.severity}
                    selectedOptions={[threat.severity]}
                    onOptionSelect={(_e, d) => handleSeverityChange(threat.id, d.optionValue as string)}
                    style={{ minWidth: '120px' }}
                    aria-label="Threat severity"
                  >
                    <Option value="CRITICAL">Critical</Option>
                    <Option value="HIGH">High</Option>
                    <Option value="MEDIUM">Medium</Option>
                    <Option value="LOW">Low</Option>
                    <Option value="INFO">Info</Option>
                  </Dropdown>
                  {isEditing && (
                    <>
                      <Text size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground3 }}>STRIDE:</Text>
                      <Dropdown
                        size="small"
                        value={strideLabels[editThreat?.strideCategory || ''] || ''}
                        selectedOptions={[editThreat?.strideCategory || '']}
                        onOptionSelect={(_e, d) => setEditThreat(prev => prev ? { ...prev, strideCategory: d.optionValue as string } : null)}
                        style={{ minWidth: '160px' }}
                        aria-label="STRIDE category"
                      >
                        <Option value="SPOOFING">Spoofing</Option>
                        <Option value="TAMPERING">Tampering</Option>
                        <Option value="REPUDIATION">Repudiation</Option>
                        <Option value="INFO_DISCLOSURE">Info Disclosure</Option>
                        <Option value="DENIAL_OF_SERVICE">Denial of Service</Option>
                        <Option value="ELEVATION_OF_PRIVILEGE">Elevation of Privilege</Option>
                      </Dropdown>
                    </>
                  )}
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
                        aria-label="Threat comment"
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
            );
          })}
        </div>
      )}

      <Dialog
        open={!!deleteThreatTarget}
        onOpenChange={(_e, data) => { if (!data.open) setDeleteThreatTarget(null); }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete Threat</DialogTitle>
            <DialogContent>
              Are you sure you want to delete "{deleteThreatTarget?.title}"?
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDeleteThreatTarget(null)}>Cancel</Button>
              <Button
                appearance="primary"
                style={{ backgroundColor: tokens.colorPaletteRedBackground3 }}
                onClick={async () => {
                  if (!deleteThreatTarget) return;
                  try {
                    await api.deleteThreat(deleteThreatTarget.id);
                    loadThreats();
                  } catch (err) {
                    console.error('Failed to delete threat:', err);
                  }
                  setDeleteThreatTarget(null);
                }}
              >
                Delete
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      {aiGenerationId && (
        <AIRatingWidget
          generationId={aiGenerationId}
          onClose={() => setAiGenerationId(null)}
        />
      )}
    </div>
  );
}
