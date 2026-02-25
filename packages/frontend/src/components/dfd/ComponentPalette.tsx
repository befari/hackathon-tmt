import { DragEvent } from 'react';
import {
  makeStyles,
  tokens,
  Text,
} from '@fluentui/react-components';
import {
  CircleFilled,
  DatabaseRegular,
  SquareRegular,
  BorderAllRegular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  palette: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px 8px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    width: '150px',
  },
  title: {
    marginBottom: '4px',
    paddingBottom: '4px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'grab',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
});

const PALETTE_ITEMS = [
  { type: 'PROCESS', nodeType: 'process', label: 'Process', icon: <CircleFilled fontSize={18} /> },
  { type: 'DATA_STORE', nodeType: 'dataStore', label: 'Data Store', icon: <DatabaseRegular fontSize={18} /> },
  { type: 'EXTERNAL_ENTITY', nodeType: 'externalEntity', label: 'External Entity', icon: <SquareRegular fontSize={18} /> },
  { type: 'TRUST_BOUNDARY', nodeType: 'trustBoundary', label: 'Trust Boundary', icon: <BorderAllRegular fontSize={18} /> },
] as const;

export function ComponentPalette() {
  const styles = useStyles();

  const onDragStart = (event: DragEvent, item: typeof PALETTE_ITEMS[number]) => {
    event.dataTransfer.setData('application/dfd-component-type', item.type);
    event.dataTransfer.setData('application/dfd-node-type', item.nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className={styles.palette}>
      <Text size={200} weight="semibold" className={styles.title}>
        Components
      </Text>
      {PALETTE_ITEMS.map((item) => (
        <div
          key={item.type}
          className={styles.item}
          draggable
          onDragStart={(e) => onDragStart(e, item)}
        >
          {item.icon}
          <Text size={200}>{item.label}</Text>
        </div>
      ))}
    </div>
  );
}
