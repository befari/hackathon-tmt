import { useState, useRef, useEffect, useCallback } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';
import { useTakeSnapshot } from '../UndoRedoContext';
import { api } from '../../../api/client';

const useStyles = makeStyles({
  node: {
    padding: '8px 12px',
    width: '100%',
    height: '100%',
    color: tokens.colorNeutralForeground2,
    fontSize: '11px',
    lineHeight: '1.4',
    overflow: 'hidden' as const,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  textarea: {
    width: '100%',
    height: '100%',
    padding: '0',
    margin: '0',
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    color: tokens.colorNeutralForeground2,
    fontFamily: 'inherit',
    fontSize: '12px',
    lineHeight: '1.4',
    resize: 'none' as const,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
});

export function TextAnnotationNode({ id, data, selected }: NodeProps) {
  const styles = useStyles();
  const takeSnapshot = useTakeSnapshot();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState((data as any).label || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText((data as any).label || '');
  }, [(data as any).label]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const saveText = useCallback(() => {
    setEditing(false);
    const trimmed = text.trim() || 'Text';
    if (trimmed !== (data as any).label) {
      api.updateComponent(id, { name: trimmed }).catch(console.error);
      // Update node data via the onLabelChange callback passed in data
      if ((data as any).onLabelChange) {
        (data as any).onLabelChange(id, trimmed);
      }
    }
  }, [id, text, data]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    takeSnapshot();
    setEditing(true);
  };

  return (
    <>
      <NodeResizer isVisible={selected} minWidth={100} minHeight={30}
        onResizeStart={takeSnapshot}
        handleStyle={{ backgroundColor: tokens.colorNeutralStroke2, width: 6, height: 6 }} />
      <div
        className={styles.node}
        onDoubleClick={handleDoubleClick}
        style={{ pointerEvents: 'auto', cursor: editing ? 'text' : 'default' }}
      >
        {editing ? (
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={saveText}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setText((data as any).label || ''); setEditing(false); }
              e.stopPropagation();
            }}
          />
        ) : (
          <Text size={200} style={{ wordBreak: 'break-word', lineHeight: '1.2' }}>
            {(data as any).label}
          </Text>
        )}
      </div>
    </>
  );
}
