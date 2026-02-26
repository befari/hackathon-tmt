import { type NodeProps } from '@xyflow/react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';

const useStyles = makeStyles({
  wrapper: {
    position: 'relative' as const,
  },
  line: {
    borderLeft: `3px dashed ${tokens.colorPaletteRedBorder1}`,
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

export function TrustBoundaryLineNode({ data }: NodeProps) {
  const styles = useStyles();
  const meta = (data as any).metadata || {};
  const height = meta.height ? `${meta.height}px` : '400px';

  return (
    <div className={styles.wrapper}>
      <div className={styles.line} style={{ height }}>
        <div className={styles.label}>
          <Text size={200} weight="semibold">
            {(data as any).label}
          </Text>
        </div>
      </div>
    </div>
  );
}
