import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { makeStyles, tokens, Text, CounterBadge } from '@fluentui/react-components';
import { useTakeSnapshot } from '../UndoRedoContext';

const useStyles = makeStyles({
  wrapper: {
    position: 'relative' as const,
    width: '100%',
    height: '100%',
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
    width: '100%',
    height: '100%',
    minWidth: '80px',
    minHeight: '40px',
    cursor: 'pointer',
    overflow: 'hidden',
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

export function DataStoreNode({ data, selected }: NodeProps) {
  const styles = useStyles();
  const takeSnapshot = useTakeSnapshot();
  const commentCount = (data as any).commentCount || 0;

  return (
    <>
      <NodeResizer isVisible={selected} minWidth={80} minHeight={40}
        onResizeStart={takeSnapshot}
        handleStyle={{ backgroundColor: tokens.colorPaletteGreenBorder1, width: 7, height: 7 }} />
      <Handle type="source" position={Position.Top} id="top-src" />
      <Handle type="target" position={Position.Top} id="top-tgt" />
      <Handle type="source" position={Position.Left} id="left-src" />
      <Handle type="target" position={Position.Left} id="left-tgt" />
      <div className={styles.wrapper}>
        <div className={styles.node}>
          <Text size={200} weight="semibold" style={{ wordBreak: 'break-word', lineHeight: '1.2', overflow: 'hidden' }}>
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
