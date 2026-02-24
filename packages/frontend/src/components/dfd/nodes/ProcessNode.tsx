import { Handle, Position, type NodeProps } from '@xyflow/react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';

const useStyles = makeStyles({
  node: {
    padding: '12px 20px',
    borderRadius: '50%',
    width: '120px',
    height: '120px',
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
});

export function ProcessNode({ data }: NodeProps) {
  const styles = useStyles();

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} />
      <div className={styles.node}>
        <Text size={200} weight="semibold" wrap={false}>
          {(data as any).label}
        </Text>
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} />
    </>
  );
}
