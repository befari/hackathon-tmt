import { Handle, Position, type NodeProps } from '@xyflow/react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';

const useStyles = makeStyles({
  node: {
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    backgroundColor: 'transparent',
    border: `2px dashed ${tokens.colorPaletteRedBorder1}`,
    borderRadius: tokens.borderRadiusXLarge,
    color: tokens.colorPaletteRedForeground1,
    minWidth: '200px',
    minHeight: '100px',
    cursor: 'pointer',
  },
});

export function TrustBoundaryNode({ data }: NodeProps) {
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
