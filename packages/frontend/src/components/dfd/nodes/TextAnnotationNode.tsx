import { NodeResizer, type NodeProps } from '@xyflow/react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';

const useStyles = makeStyles({
  node: {
    padding: '8px 12px',
    width: '100%',
    height: '100%',
    color: tokens.colorNeutralForeground2,
    fontSize: '11px',
    lineHeight: '1.4',
    overflow: 'hidden',
    cursor: 'pointer',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
});

export function TextAnnotationNode({ data, selected }: NodeProps) {
  const styles = useStyles();

  return (
    <>
      <NodeResizer isVisible={selected} minWidth={100} minHeight={30}
        handleStyle={{ backgroundColor: tokens.colorNeutralStroke2, width: 6, height: 6 }} />
      <div className={styles.node}>
        <Text size={200}>
          {(data as any).label}
        </Text>
      </div>
    </>
  );
}
