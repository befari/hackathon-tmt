import { Handle, Position, type NodeProps } from '@xyflow/react';
import { makeStyles, tokens, Text, CounterBadge } from '@fluentui/react-components';

const useStyles = makeStyles({
  wrapper: {
    position: 'relative' as const,
  },
  node: {
    padding: '10px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `3px solid ${tokens.colorPaletteGreenBorder1}`,
    borderBottom: `3px solid ${tokens.colorPaletteGreenBorder1}`,
    color: tokens.colorNeutralForeground1,
    minWidth: '120px',
    minHeight: '50px',
    cursor: 'pointer',
    '&:hover': {
      boxShadow: tokens.shadow8,
    },
  },
  badge: {
    position: 'absolute' as const,
    top: '-6px',
    right: '-6px',
  },
});

export function DataStoreNode({ data }: NodeProps) {
  const styles = useStyles();
  const commentCount = (data as any).commentCount || 0;

  return (
    <>
      <Handle type="source" position={Position.Top} id="top-src" />
      <Handle type="target" position={Position.Top} id="top-tgt" />
      <Handle type="source" position={Position.Left} id="left-src" />
      <Handle type="target" position={Position.Left} id="left-tgt" />
      <div className={styles.wrapper}>
        <div className={styles.node}>
          <Text size={200} weight="semibold">
            {(data as any).label}
          </Text>
        </div>
        {commentCount > 0 && (
          <div className={styles.badge}>
            <CounterBadge count={commentCount} size="small" color="informative" />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} id="bottom-src" />
      <Handle type="target" position={Position.Bottom} id="bottom-tgt" />
      <Handle type="source" position={Position.Right} id="right-src" />
      <Handle type="target" position={Position.Right} id="right-tgt" />
    </>
  );
}
