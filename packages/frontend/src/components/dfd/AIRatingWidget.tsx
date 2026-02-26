import { useState } from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Textarea,
} from '@fluentui/react-components';
import {
  Star20Filled,
  Star20Regular,
  Dismiss16Regular,
} from '@fluentui/react-icons';
import { api } from '../../api/client';

const useStyles = makeStyles({
  overlay: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 1000,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow16,
    padding: '16px 20px',
    width: '320px',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  stars: {
    display: 'flex',
    gap: '4px',
    marginBottom: '12px',
  },
  star: {
    cursor: 'pointer',
    color: tokens.colorPaletteYellowForeground1,
    fontSize: '24px',
    padding: 0,
    minWidth: 'auto',
    background: 'none',
    border: 'none',
    '&:hover': {
      transform: 'scale(1.2)',
    },
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '12px',
  },
});

interface AIRatingWidgetProps {
  generationId: string;
  onClose: () => void;
}

export function AIRatingWidget({ generationId, onClose }: AIRatingWidgetProps) {
  const styles = useStyles();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await api.submitFeedback(generationId, rating, comment || undefined);
      setSubmitted(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={styles.overlay}>
        <Text size={400} weight="semibold">Thanks for your feedback! 🎉</Text>
      </div>
    );
  }

  const displayRating = hoveredRating || rating;

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <Text size={400} weight="semibold">Rate AI Output</Text>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
        >
          <Dismiss16Regular />
        </button>
      </div>
      <Text size={200} block style={{ marginBottom: '8px', color: tokens.colorNeutralForeground3 }}>
        How well did the AI generate the DFDs and threats?
      </Text>
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className={styles.star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
          >
            {star <= displayRating ? (
              <Star20Filled />
            ) : (
              <Star20Regular />
            )}
          </button>
        ))}
        <Text size={200} style={{ marginLeft: '8px', alignSelf: 'center', color: tokens.colorNeutralForeground3 }}>
          {displayRating > 0 ? ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][displayRating] : ''}
        </Text>
      </div>
      <Textarea
        placeholder="Optional: What could be improved?"
        value={comment}
        onChange={(_e, d) => setComment(d.value)}
        rows={2}
        resize="vertical"
        style={{ width: '100%' }}
      />
      <div className={styles.actions}>
        <Button appearance="secondary" size="small" onClick={onClose}>
          Skip
        </Button>
        <Button
          appearance="primary"
          size="small"
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
        >
          {submitting ? 'Submitting…' : 'Submit'}
        </Button>
      </div>
    </div>
  );
}
