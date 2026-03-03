import { NodeResizer, type NodeProps } from '@xyflow/react';
import { makeStyles, tokens, Text, CounterBadge } from '@fluentui/react-components';
import { useTakeSnapshot } from '../UndoRedoContext';

const useStyles = makeStyles({
  wrapper: {
    position: 'relative' as const,
    width: '100%',
    height: '100%',
    pointerEvents: 'none' as const,
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
    width: '100%',
    height: '100%',
    minWidth: '200px',
    minHeight: '100px',
    pointerEvents: 'none' as const,
  },
  label: {
    pointerEvents: 'auto' as const,
    cursor: 'pointer',
  },
  badge: {
    position: 'absolute' as const,
    top: '-6px',
    right: '-6px',
    pointerEvents: 'auto' as const,
  },
});

export function TrustBoundaryNode({ data, selected }: NodeProps) {
  const styles = useStyles();
  const takeSnapshot = useTakeSnapshot();
  const commentCount = (data as any).commentCount || 0;

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={100}
        onResizeStart={takeSnapshot}
        lineStyle={{ borderColor: tokens.colorPaletteRedBorder1 }}
        handleStyle={{ backgroundColor: tokens.colorPaletteRedBorder1, width: 8, height: 8 }}
      />
      <div className={styles.wrapper}>
        <div className={styles.node}>
          <Text size={200} weight="semibold" className={styles.label} style={{ wordBreak: 'break-word', lineHeight: '1.2', overflow: 'hidden' }}>
            {(data as any).label}
          </Text>
        </div>
        {commentCount > 0 && (
          <div className={styles.badge}>
            <CounterBadge count={commentCount} size="small" color="informative" />
          </div>
        )}
      </div>
    </>
  );
}
