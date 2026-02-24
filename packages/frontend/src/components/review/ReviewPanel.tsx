import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Card,
  CardHeader,
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
} from '@fluentui/react-components';
import {
  Add20Regular,
  Checkmark20Regular,
  ArrowReply20Regular,
} from '@fluentui/react-icons';
import type { Review, Comment } from '@superior-tmt/shared';

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
});

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

  useEffect(() => {
    if (!id) return;
    fetch(`/api/reviews?threatModelId=${id}`)
      .then((r) => r.json())
      .then(({ data }) => setReviews(data || []))
      .catch(console.error);
  }, [id]);

  const loadReviewComments = async (reviewId: string) => {
    const res = await fetch(`/api/reviews/${reviewId}`);
    const { data } = await res.json();
    setSelectedReview(data);
    setComments(data.comments || []);
  };

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
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: replyText,
        author: 'Current User',
        parentId,
        reviewId: selectedReview.id,
      }),
    });
    setReplyText('');
    setReplyingTo(null);
    loadReviewComments(selectedReview.id);
  };

  const handleResolve = async (commentId: string) => {
    await fetch(`/api/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: true }),
    });
    if (selectedReview) loadReviewComments(selectedReview.id);
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
            <Button appearance="primary" icon={<Add20Regular />}>
              New Review
            </Button>
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
                onClick={() => loadReviewComments(review.id)}
              >
                <CardHeader
                  header={<Text weight="semibold">{review.name}</Text>}
                  description={`Started ${new Date(review.startedAt).toLocaleDateString()}`}
                  action={
                    <Badge color={statusColor[review.status] || 'informative'}>
                      {review.status.replace('_', ' ')}
                    </Badge>
                  }
                />
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

          {comments.length === 0 ? (
            <div className={styles.empty}>
              <Text>No comments yet. Add comments from the DFD or threat views.</Text>
            </div>
          ) : (
            comments.map((comment) => (
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
                </div>
                <div className={styles.commentBody}>
                  <Text>{comment.body}</Text>
                </div>

                {/* Replies */}
                {comment.replies?.map((reply) => (
                  <div key={reply.id} className={styles.reply}>
                    <div className={styles.commentMeta}>
                      <Text size={200} weight="semibold">
                        {reply.author}
                      </Text>
                      <Text size={100}>
                        {new Date(reply.createdAt).toLocaleString()}
                      </Text>
                    </div>
                    <div className={styles.commentBody}>
                      <Text>{reply.body}</Text>
                    </div>
                  </div>
                ))}

                <div className={styles.actions}>
                  {!comment.resolved && (
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={<Checkmark20Regular />}
                      onClick={() => handleResolve(comment.id)}
                    >
                      Resolve
                    </Button>
                  )}
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<ArrowReply20Regular />}
                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  >
                    Reply
                  </Button>
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
    </div>
  );
}
