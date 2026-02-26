import { Handle, Position, type NodeProps } from '@xyflow/react';
import { makeStyles, tokens, Text, CounterBadge } from '@fluentui/react-components';

const useStyles = makeStyles({
  wrapper: {
    position: 'relative' as const,
  },
  node: {
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(180, 40, 40, 0.05)',
    border: `2px dashed ${tokens.colorPaletteRedBorder1}`,
    borderRadius: tokens.borderRadiusXLarge,
    color: tokens.colorPaletteRedForeground1,
    minWidth: '200px',
    minHeight: '100px',
    cursor: 'pointer',
  },
  badge: {
    position: 'absolute' as const,
    top: '-6px',
    right: '-6px',
  },
});

export function TrustBoundaryNode({ data }: NodeProps) {
  const styles = useStyles();
  const commentCount = (data as any).commentCount || 0;
  const meta = (data as any).metadata || {};
  const width = meta.width ? `${meta.width}px` : undefined;
  const height = meta.height ? `${meta.height}px` : undefined;

  return (
    <>
      <Handle type="source" position={Position.Top} id="top-src" />
      <Handle type="target" position={Position.Top} id="top-tgt" />
      <Handle type="source" position={Position.Left} id="left-src" />
      <Handle type="target" position={Position.Left} id="left-tgt" />
      <div className={styles.wrapper}>
        <div className={styles.node} style={{ width, height }}>
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
