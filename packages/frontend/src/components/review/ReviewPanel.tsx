import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Card,
  Badge,
  Textarea,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Input,
  Divider,
  Dropdown,
  Option,
  Tooltip,
} from '@fluentui/react-components';
import {
  Add20Regular,
  Checkmark20Regular,
  ArrowReply20Regular,
  Edit20Regular,
  Delete20Regular,
  CheckmarkCircle20Regular,
  DismissCircle20Regular,
} from '@fluentui/react-icons';
import { api } from '../../api/client';
import type { Review, Comment, Threat, Component, DataFlow } from '@hackathon-tmt/shared';

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
  reviewCard: {
    marginBottom: '16px',
    cursor: 'pointer',
    '&:hover': {
      boxShadow: tokens.shadow8,
    },
  },
  commentThread: {
    padding: '16px',
    marginBottom: '12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
  },
  commentBody: {
    marginTop: '8px',
    lineHeight: '1.5',
  },
  commentMeta: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    opacity: 0.7,
  },
  commentLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '4px',
    opacity: 0.8,
  },
  reply: {
    marginLeft: '24px',
    marginTop: '12px',
    paddingLeft: '12px',
    borderLeft: `2px solid ${tokens.colorNeutralStroke2}`,
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  replyInput: {
    marginTop: '12px',
    display: 'flex',
    gap: '8px',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '64px 32px',
    color: tokens.colorNeutralForeground3,
  },
  newCommentForm: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  linkRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
});

interface LinkedEntity {
  type: 'none' | 'threat' | 'component' | 'dataFlow';
  id: string;
}

const CURRENT_USER = 'Current User';

export function ReviewPanel() {
  const styles = useStyles();
  const { id } = useParams<{ id: string }>();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newReviewName, setNewReviewName] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editReviewName, setEditReviewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  // New comment form
  const [newCommentBody, setNewCommentBody] = useState('');
  const [linkedEntity, setLinkedEntity] = useState<LinkedEntity>({ type: 'none', id: '' });
  const [submittingNew, setSubmittingNew] = useState(false);

  // Available targets
  const [threats, setThreats] = useState<Threat[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [dataFlows, setDataFlows] = useState<DataFlow[]>([]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/reviews?threatModelId=${id}`)
      .then((r) => r.json())
      .then(({ data }) => setReviews(data || []))
      .catch(console.error);

    // Load available targets for linking
    fetch(`/api/threat-models/${id}`)
      .then((r) => r.json())
      .then(({ data }) => {
        const allComponents: Component[] = [];
        const allFlows: DataFlow[] = [];
        for (const d of data.diagrams || []) {
          allComponents.push(...(d.components || []));
          allFlows.push(...(d.dataFlows || []));
        }
        setComponents(allComponents);
        setDataFlows(allFlows);
        setThreats(data.threats || []);
      })
      .catch(console.error);
  }, [id]);

  const loadReviewComments = useCallback(async (reviewId: string) => {
    const res = await fetch(`/api/reviews/${reviewId}`);
    const { data } = await res.json();
    setSelectedReview(data);
    setComments(data.comments || []);
  }, []);

  const handleCreateReview = async () => {
    if (!id) return;
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newReviewName, threatModelId: id }),
    });
    const { data } = await res.json();
    setReviews((prev) => [data, ...prev]);
    setDialogOpen(false);
    setNewReviewName('');
    loadReviewComments(data.id);
  };

  const handleReply = async (parentId: string) => {
    if (!replyText.trim() || !selectedReview) return;
    await api.createComment({
      body: replyText,
      author: 'Current User',
      parentId,
      reviewId: selectedReview.id,
    });
    setReplyText('');
    setReplyingTo(null);
    loadReviewComments(selectedReview.id);
  };

  const handleResolve = async (commentId: string) => {
    await api.resolveComment(commentId);
    if (selectedReview) loadReviewComments(selectedReview.id);
  };

  const handleEditComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    await fetch(`/api/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editCommentText }),
    });
    setEditingCommentId(null);
    setEditCommentText('');
    if (selectedReview) loadReviewComments(selectedReview.id);
  };

  const handleDeleteComment = async (commentId: string) => {
    await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
    if (selectedReview) loadReviewComments(selectedReview.id);
  };

  const handleAddNewComment = async () => {
    if (!newCommentBody.trim() || !selectedReview) return;
    setSubmittingNew(true);
    try {
      const payload: Record<string, any> = {
        body: newCommentBody,
        author: 'Current User',
        reviewId: selectedReview.id,
      };
      if (linkedEntity.type === 'threat' && linkedEntity.id) payload.threatId = linkedEntity.id;
      if (linkedEntity.type === 'component' && linkedEntity.id) payload.componentId = linkedEntity.id;
      if (linkedEntity.type === 'dataFlow' && linkedEntity.id) payload.dataFlowId = linkedEntity.id;

      await api.createComment(payload);
      setNewCommentBody('');
      setLinkedEntity({ type: 'none', id: '' });
      loadReviewComments(selectedReview.id);
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmittingNew(false);
    }
  };

  const getLinkLabel = (comment: any): string | null => {
    if (comment.threat) return `On threat T-${comment.threat.number || '?'}: ${comment.threat.title}`;
    if (comment.component) return `On component: ${comment.component.name}`;
    if (comment.dataFlow) return `On data flow: ${comment.dataFlow.label}`;
    return null;
  };

  const handleRenameReview = async (reviewId: string) => {
    if (!editReviewName.trim()) return;
    const res = await fetch(`/api/reviews/${reviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editReviewName }),
    });
    const { data } = await res.json();
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, name: data.name } : r)));
    setEditingReviewId(null);
  };

  const handleDeleteReview = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/reviews/${deleteTarget.id}`, { method: 'DELETE' });
    setReviews((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleCompleteReview = async (reviewId: string) => {
    const res = await fetch(`/api/reviews/${reviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    const { data } = await res.json();
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, ...data } : r)));
  };

  const handleCancelReview = async (reviewId: string) => {
    const res = await fetch(`/api/reviews/${reviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    const { data } = await res.json();
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, ...data } : r)));
  };

  const statusColor: Record<string, 'warning' | 'success' | 'informative'> = {
    IN_PROGRESS: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'informative',
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={600} weight="semibold">
          Security Reviews
        </Text>
        <Dialog open={dialogOpen} onOpenChange={(_e, data) => setDialogOpen(data.open)}>
          <DialogTrigger>
            <Tooltip content="Start a new review" relationship="description">
              <Button appearance="primary" icon={<Add20Regular />}>
                New Review
              </Button>
            </Tooltip>
          </DialogTrigger>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Start New Review</DialogTitle>
              <DialogContent>
                <Input
                  placeholder="e.g., 2026 Annual Security Review"
                  value={newReviewName}
                  onChange={(_e, d) => setNewReviewName(d.value)}
                  style={{ width: '100%', marginTop: '16px' }}
                  aria-label="Review name"
                />
              </DialogContent>
              <DialogActions>
                <DialogTrigger>
                  <Button appearance="secondary">Cancel</Button>
                </DialogTrigger>
                <Button appearance="primary" onClick={handleCreateReview} disabled={!newReviewName.trim()}>
                  Create
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      </div>

      {!selectedReview ? (
        <>
          {reviews.length === 0 ? (
            <div className={styles.empty}>
              <Text size={500} block>
                No reviews yet
              </Text>
              <Text size={300} block>
                Start a security review to begin leaving comments on threats and DFD elements
              </Text>
            </div>
          ) : (
            reviews.map((review) => (
              <Card
                key={review.id}
                className={styles.reviewCard}
                style={{ padding: '16px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => loadReviewComments(review.id)}>
                    {editingReviewId === review.id ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Input
                          value={editReviewName}
                          onChange={(_e, d) => setEditReviewName(d.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameReview(review.id); if (e.key === 'Escape') setEditingReviewId(null); }}
                          size="small"
                          style={{ flex: 1 }}
                          aria-label="Review name"
                          autoFocus
                        />
                        <Button size="small" appearance="primary" onClick={(e) => { e.stopPropagation(); handleRenameReview(review.id); }}>Save</Button>
                        <Button size="small" appearance="secondary" onClick={(e) => { e.stopPropagation(); setEditingReviewId(null); }}>Cancel</Button>
                      </div>
                    ) : (
                      <Text weight="semibold" size={400}>{review.name}</Text>
                    )}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                      <Text size={200} style={{ opacity: 0.7 }}>Started {new Date(review.startedAt).toLocaleDateString()}</Text>
                      {(review as any).completedAt && (
                        <Text size={200} style={{ opacity: 0.7 }}>Completed {new Date((review as any).completedAt).toLocaleDateString()}</Text>
                      )}
                      <Text size={200} style={{ opacity: 0.7 }}>{(review as any)._count?.comments ?? 0} comments</Text>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0, marginLeft: '12px' }}>
                    <Badge color={statusColor[review.status] || 'informative'} style={{ whiteSpace: 'nowrap' }}>
                      {review.status.replace('_', ' ')}
                    </Badge>
                    {review.status === 'IN_PROGRESS' && (
                      <>
                        <Tooltip content="Complete review" relationship="label">
                          <Button size="small" appearance="subtle" icon={<CheckmarkCircle20Regular />}
                            aria-label="Complete review"
                            onClick={(e) => { e.stopPropagation(); handleCompleteReview(review.id); }}
                          />
                        </Tooltip>
                        <Tooltip content="Cancel review" relationship="label">
                          <Button size="small" appearance="subtle" icon={<DismissCircle20Regular />}
                            aria-label="Cancel review"
                            onClick={(e) => { e.stopPropagation(); handleCancelReview(review.id); }}
                          />
                        </Tooltip>
                      </>
                    )}
                    <Tooltip content="Rename review" relationship="label">
                      <Button size="small" appearance="subtle" icon={<Edit20Regular />}
                        aria-label="Rename review"
                        onClick={(e) => { e.stopPropagation(); setEditingReviewId(review.id); setEditReviewName(review.name); }}
                      />
                    </Tooltip>
                    <Tooltip content="Delete review" relationship="label">
                      <Button size="small" appearance="subtle" icon={<Delete20Regular />}
                        aria-label="Delete review"
                        style={{ color: tokens.colorPaletteRedForeground1 }}
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: review.id, name: review.name }); }}
                      />
                    </Tooltip>
                  </div>
                </div>
              </Card>
            ))
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <Button appearance="subtle" onClick={() => setSelectedReview(null)}>
                ← Back to Reviews
              </Button>
              <Text size={500} weight="semibold" style={{ marginLeft: '12px' }}>
                {selectedReview.name}
              </Text>
            </div>
            <Badge color={statusColor[selectedReview.status] || 'informative'}>
              {selectedReview.status.replace('_', ' ')}
            </Badge>
          </div>
          <Divider style={{ marginBottom: '24px' }} />

          {/* New comment form */}
          <div className={styles.newCommentForm}>
            <Text weight="semibold" size={300}>Add a Comment</Text>
            <Textarea
              placeholder="Write a comment..."
              value={newCommentBody}
              onChange={(_e, d) => setNewCommentBody(d.value)}
              rows={3}
              aria-label="Review comment"
            />
            <div className={styles.linkRow}>
              <Text size={200}>Link to:</Text>
              <Dropdown
                size="small"
                value={linkedEntity.type === 'none' ? 'None' : linkedEntity.type === 'threat' ? 'Threat' : linkedEntity.type === 'component' ? 'Component' : 'Data Flow'}
                selectedOptions={[linkedEntity.type]}
                onOptionSelect={(_e, d) => setLinkedEntity({ type: d.optionValue as LinkedEntity['type'], id: '' })}
                style={{ minWidth: '130px' }}
              >
                <Option value="none">None</Option>
                <Option value="threat">Threat</Option>
                <Option value="component">Component</Option>
                <Option value="dataFlow">Data Flow</Option>
              </Dropdown>
              {linkedEntity.type === 'threat' && (
                <Dropdown
                  size="small"
                  placeholder="Select threat"
                  selectedOptions={linkedEntity.id ? [linkedEntity.id] : []}
                  onOptionSelect={(_e, d) => setLinkedEntity((prev) => ({ ...prev, id: d.optionValue as string }))}
                  style={{ minWidth: '200px' }}
                >
                  {threats.map((t) => (
                    <Option key={t.id} value={t.id} text={`T-${(t as any).number || '?'}: ${t.title}`}>T-{(t as any).number || '?'}: {t.title}</Option>
                  ))}
                </Dropdown>
              )}
              {linkedEntity.type === 'component' && (
                <Dropdown
                  size="small"
                  placeholder="Select component"
                  selectedOptions={linkedEntity.id ? [linkedEntity.id] : []}
                  onOptionSelect={(_e, d) => setLinkedEntity((prev) => ({ ...prev, id: d.optionValue as string }))}
                  style={{ minWidth: '200px' }}
                >
                  {components.map((c) => (
                    <Option key={c.id} value={c.id}>{c.name}</Option>
                  ))}
                </Dropdown>
              )}
              {linkedEntity.type === 'dataFlow' && (
                <Dropdown
                  size="small"
                  placeholder="Select data flow"
                  selectedOptions={linkedEntity.id ? [linkedEntity.id] : []}
                  onOptionSelect={(_e, d) => setLinkedEntity((prev) => ({ ...prev, id: d.optionValue as string }))}
                  style={{ minWidth: '200px' }}
                >
                  {dataFlows.map((f) => (
                    <Option key={f.id} value={f.id}>{f.label}</Option>
                  ))}
                </Dropdown>
              )}
            </div>
            <Button
              appearance="primary"
              onClick={handleAddNewComment}
              disabled={!newCommentBody.trim() || submittingNew}
              style={{ alignSelf: 'flex-start' }}
            >
              {submittingNew ? 'Adding...' : 'Add Comment'}
            </Button>
          </div>

          {comments.length === 0 ? (
            <div className={styles.empty}>
              <Text>No comments yet. Use the form above to add the first comment.</Text>
            </div>
          ) : (
            comments.map((comment: any) => (
              <div key={comment.id} className={styles.commentThread}>
                <div className={styles.commentMeta}>
                  <Text size={200} weight="semibold">
                    {comment.author}
                  </Text>
                  <Text size={100}>
                    {new Date(comment.createdAt).toLocaleString()}
                  </Text>
                  {comment.resolved && (
                    <Badge appearance="outline" color="success">
                      Resolved
                    </Badge>
                  )}
                  {comment.author === CURRENT_USER && editingCommentId !== comment.id && (
                    <>
                      <Tooltip content="Edit comment" relationship="label">
                        <Button size="small" appearance="subtle" icon={<Edit20Regular />}
                          aria-label="Edit comment"
                          style={{ minWidth: 'auto', padding: '2px' }}
                          onClick={() => { setEditingCommentId(comment.id); setEditCommentText(comment.body); }}
                        />
                      </Tooltip>
                      <Tooltip content="Delete comment" relationship="label">
                        <Button size="small" appearance="subtle" icon={<Delete20Regular />}
                          aria-label="Delete comment"
                          style={{ minWidth: 'auto', padding: '2px', color: tokens.colorPaletteRedForeground1 }}
                          onClick={() => handleDeleteComment(comment.id)}
                        />
                      </Tooltip>
                    </>
                  )}
                </div>
                {getLinkLabel(comment) && (
                  <div className={styles.commentLink}>
                    <Badge appearance="tint" size="small" color="brand">
                      {getLinkLabel(comment)}
                    </Badge>
                  </div>
                )}
                <div className={styles.commentBody}>
                  {editingCommentId === comment.id ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <Textarea
                        value={editCommentText}
                        onChange={(_e, d) => setEditCommentText(d.value)}
                        style={{ flex: 1 }}
                        rows={3}
                        aria-label="Edit comment"
                        autoFocus
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <Button size="small" appearance="primary" onClick={() => handleEditComment(comment.id)} disabled={!editCommentText.trim()}>Save</Button>
                        <Button size="small" appearance="secondary" onClick={() => setEditingCommentId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Text>{comment.body}</Text>
                  )}
                </div>

                {/* Replies */}
                {comment.replies?.map((reply: any) => (
                  <div key={reply.id} className={styles.reply}>
                    <div className={styles.commentMeta}>
                      <Text size={200} weight="semibold">
                        {reply.author}
                      </Text>
                      <Text size={100}>
                        {new Date(reply.createdAt).toLocaleString()}
                      </Text>
                      {reply.author === CURRENT_USER && editingCommentId !== reply.id && (
                        <>
                          <Tooltip content="Edit reply" relationship="label">
                            <Button size="small" appearance="subtle" icon={<Edit20Regular />}
                              aria-label="Edit reply"
                              style={{ minWidth: 'auto', padding: '2px' }}
                              onClick={() => { setEditingCommentId(reply.id); setEditCommentText(reply.body); }}
                            />
                          </Tooltip>
                          <Tooltip content="Delete reply" relationship="label">
                            <Button size="small" appearance="subtle" icon={<Delete20Regular />}
                              aria-label="Delete reply"
                              style={{ minWidth: 'auto', padding: '2px', color: tokens.colorPaletteRedForeground1 }}
                              onClick={() => handleDeleteComment(reply.id)}
                            />
                          </Tooltip>
                        </>
                      )}
                    </div>
                    <div className={styles.commentBody}>
                      {editingCommentId === reply.id ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <Textarea
                            value={editCommentText}
                            onChange={(_e, d) => setEditCommentText(d.value)}
                            style={{ flex: 1 }}
                            rows={2}
                            aria-label="Edit reply"
                            autoFocus
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <Button size="small" appearance="primary" onClick={() => handleEditComment(reply.id)} disabled={!editCommentText.trim()}>Save</Button>
                            <Button size="small" appearance="secondary" onClick={() => setEditingCommentId(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <Text>{reply.body}</Text>
                      )}
                    </div>
                  </div>
                ))}

                <div className={styles.actions}>
                  {!comment.resolved && (
                    <Tooltip content="Mark as resolved" relationship="description">
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<Checkmark20Regular />}
                        onClick={() => handleResolve(comment.id)}
                      >
                        Resolve
                      </Button>
                    </Tooltip>
                  )}
                  <Tooltip content="Reply to this comment" relationship="description">
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={<ArrowReply20Regular />}
                      onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    >
                      Reply
                    </Button>
                  </Tooltip>
                </div>

                {replyingTo === comment.id && (
                  <div className={styles.replyInput}>
                    <Textarea
                      placeholder="Write a reply..."
                      value={replyText}
                      onChange={(_e, d) => setReplyText(d.value)}
                      style={{ flex: 1 }}
                      rows={2}
                    />
                    <Button
                      appearance="primary"
                      onClick={() => handleReply(comment.id)}
                      disabled={!replyText.trim()}
                    >
                      Reply
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(_e, data) => { if (!data.open) setDeleteTarget(null); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete Review</DialogTitle>
            <DialogContent>
              <Text>Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? All comments in this review will be permanently removed.</Text>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button appearance="primary" style={{ backgroundColor: tokens.colorPaletteRedBackground3 }} onClick={handleDeleteReview}>Delete</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
