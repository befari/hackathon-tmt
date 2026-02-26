import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { makeStyles, tokens, Text, CounterBadge } from '@fluentui/react-components';

const useStyles = makeStyles({
  wrapper: {
    position: 'relative' as const,
    width: '100%',
    height: '100%',
  },
  node: {
    padding: '12px 20px',
    borderRadius: '50%',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    backgroundColor: tokens.colorBrandBackground,
    border: `2px solid ${tokens.colorBrandStroke1}`,
    color: tokens.colorNeutralForegroundOnBrand,
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

export function ProcessNode({ data, selected }: NodeProps) {
  const styles = useStyles();
  const commentCount = (data as any).commentCount || 0;

  return (
    <>
      <NodeResizer isVisible={selected} minWidth={60} minHeight={60}
        handleStyle={{ backgroundColor: tokens.colorBrandStroke1, width: 7, height: 7 }} />
      <Handle type="source" position={Position.Top} id="top-src" />
      <Handle type="target" position={Position.Top} id="top-tgt" />
      <Handle type="source" position={Position.Left} id="left-src" />
      <Handle type="target" position={Position.Left} id="left-tgt" />
      <div className={styles.wrapper}>
        <div className={styles.node}>
          <Text size={200} weight="semibold" wrap={false}>
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
