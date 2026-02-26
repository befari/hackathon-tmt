import { NodeResizer, type NodeProps } from '@xyflow/react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';

const useStyles = makeStyles({
  wrapper: {
    position: 'relative' as const,
    width: '100%',
    height: '100%',
  },
  line: {
    borderLeft: `3px dashed ${tokens.colorPaletteRedBorder1}`,
    width: '100%',
    height: '100%',
    minHeight: '100px',
    paddingLeft: '8px',
    display: 'flex',
    alignItems: 'flex-start',
  },
  label: {
    transform: 'rotate(-90deg)',
    transformOrigin: 'left top',
    whiteSpace: 'nowrap' as const,
    position: 'absolute' as const,
    left: '12px',
    top: '50%',
    color: tokens.colorPaletteRedForeground1,
  },
});

export function TrustBoundaryLineNode({ data, selected }: NodeProps) {
  const styles = useStyles();

  return (
    <div className={styles.wrapper}>
      <NodeResizer isVisible={selected} minWidth={10} minHeight={60}
        handleStyle={{ backgroundColor: tokens.colorPaletteRedBorder1, width: 7, height: 7 }} />
      <div className={styles.line}>
        <div className={styles.label}>
          <Text size={200} weight="semibold">
            {(data as any).label}
          </Text>
        </div>
      </div>
    </div>
  );
}
