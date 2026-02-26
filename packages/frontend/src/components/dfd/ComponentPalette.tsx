import { DragEvent, useState, type ReactNode } from 'react';
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
  ChevronDown12Regular,
  ChevronRight12Regular,
  ServerRegular,
  CloudRegular,
  DocumentRegular,
  KeyRegular,
  BookRegular,
  PersonRegular,
  GlobeRegular,
  WindowRegular,
  LockClosedRegular,
  ShieldRegular,
  AppGenericRegular,
  CodeRegular,
  SettingsRegular,
  HardDriveRegular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  palette: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '12px 8px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    width: '180px',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  title: {
    marginBottom: '4px',
    paddingBottom: '4px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 8px',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    fontWeight: 600,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px 6px 24px',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'grab',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
});

interface PaletteSubtype {
  subtype: string;
  label: string;
  icon: ReactNode;
}

interface PaletteCategory {
  type: string;
  nodeType: string;
  label: string;
  icon: ReactNode;
  subtypes: PaletteSubtype[];
}

const PALETTE_CATEGORIES: PaletteCategory[] = [
  {
    type: 'PROCESS',
    nodeType: 'process',
    label: 'Process',
    icon: <CircleFilled fontSize={16} />,
    subtypes: [
      { subtype: 'service', label: 'Service / API', icon: <ServerRegular fontSize={14} /> },
      { subtype: 'daemon', label: 'Daemon / Agent', icon: <SettingsRegular fontSize={14} /> },
      { subtype: 'webapp', label: 'Web Application', icon: <WindowRegular fontSize={14} /> },
      { subtype: 'library', label: 'Library / Module', icon: <CodeRegular fontSize={14} /> },
      { subtype: 'system', label: 'System Process', icon: <AppGenericRegular fontSize={14} /> },
    ],
  },
  {
    type: 'DATA_STORE',
    nodeType: 'dataStore',
    label: 'Data Store',
    icon: <DatabaseRegular fontSize={16} />,
    subtypes: [
      { subtype: 'database', label: 'Database', icon: <DatabaseRegular fontSize={14} /> },
      { subtype: 'filesystem', label: 'File System', icon: <DocumentRegular fontSize={14} /> },
      { subtype: 'cache', label: 'Cache / Memory', icon: <HardDriveRegular fontSize={14} /> },
      { subtype: 'hardware', label: 'Hardware Store (TPM)', icon: <KeyRegular fontSize={14} /> },
      { subtype: 'config', label: 'Config File', icon: <SettingsRegular fontSize={14} /> },
      { subtype: 'log', label: 'Log / Journal', icon: <BookRegular fontSize={14} /> },
    ],
  },
  {
    type: 'EXTERNAL_ENTITY',
    nodeType: 'externalEntity',
    label: 'External Entity',
    icon: <SquareRegular fontSize={16} />,
    subtypes: [
      { subtype: 'user', label: 'Human User', icon: <PersonRegular fontSize={14} /> },
      { subtype: 'api', label: 'External API', icon: <CloudRegular fontSize={14} /> },
      { subtype: 'webservice', label: 'Web Service', icon: <GlobeRegular fontSize={14} /> },
      { subtype: 'browser', label: 'Browser', icon: <WindowRegular fontSize={14} /> },
      { subtype: 'thirdparty', label: 'Third-party Service', icon: <ServerRegular fontSize={14} /> },
    ],
  },
  {
    type: 'TRUST_BOUNDARY',
    nodeType: 'trustBoundary',
    label: 'Trust Boundary',
    icon: <BorderAllRegular fontSize={16} />,
    subtypes: [
      { subtype: 'network', label: 'Network Boundary', icon: <GlobeRegular fontSize={14} /> },
      { subtype: 'session', label: 'User Session', icon: <PersonRegular fontSize={14} /> },
      { subtype: 'system', label: 'System Boundary', icon: <ShieldRegular fontSize={14} /> },
      { subtype: 'process', label: 'Process Space', icon: <LockClosedRegular fontSize={14} /> },
    ],
  },
];

export function ComponentPalette() {
  const styles = useStyles();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleCategory = (type: string) => {
    setExpanded((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const onDragStart = (event: DragEvent, type: string, nodeType: string, subtype?: string) => {
    event.dataTransfer.setData('application/dfd-component-type', type);
    event.dataTransfer.setData('application/dfd-node-type', nodeType);
    if (subtype) {
      event.dataTransfer.setData('application/dfd-component-subtype', subtype);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className={styles.palette}>
      <Text size={200} weight="semibold" className={styles.title}>
        Components
      </Text>
      {PALETTE_CATEGORIES.map((cat) => (
        <div key={cat.type}>
          <div
            className={styles.categoryHeader}
            draggable
            onDragStart={(e) => onDragStart(e, cat.type, cat.nodeType)}
            onClick={() => toggleCategory(cat.type)}
          >
            {expanded[cat.type] ? <ChevronDown12Regular /> : <ChevronRight12Regular />}
            {cat.icon}
            <Text size={200} weight="semibold">{cat.label}</Text>
          </div>
          {expanded[cat.type] &&
            cat.subtypes.map((sub) => (
              <div
                key={sub.subtype}
                className={styles.item}
                draggable
                onDragStart={(e) => onDragStart(e, cat.type, cat.nodeType, sub.subtype)}
              >
                {sub.icon}
                <Text size={200}>{sub.label}</Text>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
