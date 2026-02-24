import { Handle, Position, type NodeProps } from '@xyflow/react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';

const useStyles = makeStyles({
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
});

export function DataStoreNode({ data }: NodeProps) {
  const styles = useStyles();

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} />
      <div className={styles.node}>
        <Text size={200} weight="semibold">
          {(data as any).label}
        </Text>
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} />
    </>
  );
}
