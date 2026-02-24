import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Tooltip,
} from '@fluentui/react-components';
import {
  Shield20Regular,
  Home20Regular,
  DiagramFilled,
  Warning20Regular,
  Chat20Regular,
  ClipboardCheckmark20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
    transition: 'width 0.2s ease',
    overflow: 'hidden',
  },
  sidebarExpanded: {
    width: '240px',
  },
  sidebarCollapsed: {
    width: '48px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    cursor: 'pointer',
    borderRadius: tokens.borderRadiusMedium,
    margin: '2px 6px',
    color: tokens.colorNeutralForeground2,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground1,
    },
  },
  navItemActive: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
  toggleBtn: {
    marginTop: 'auto',
    padding: '12px',
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
  },
});

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(true);

  // Extract model ID from URL if present
  const modelMatch = location.pathname.match(/\/model\/([^/]+)/);
  const modelId = modelMatch?.[1];

  const navItems = [
    { icon: <Home20Regular />, label: 'Dashboard', path: '/' },
    ...(modelId
      ? [
          { icon: <DiagramFilled />, label: 'DFD Editor', path: `/model/${modelId}` },
          { icon: <Warning20Regular />, label: 'Threats', path: `/model/${modelId}/threats` },
          { icon: <Chat20Regular />, label: 'AI Chat', path: `/model/${modelId}/chat` },
          { icon: <ClipboardCheckmark20Regular />, label: 'Review', path: `/model/${modelId}/review` },
        ]
      : []),
  ];

  return (
    <div className={styles.container}>
      <nav className={`${styles.sidebar} ${expanded ? styles.sidebarExpanded : styles.sidebarCollapsed}`}>
        <div className={styles.logo}>
          <Shield20Regular />
          {expanded && (
            <Text weight="semibold" size={400}>
              Superior TMT
            </Text>
          )}
        </div>

        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Tooltip content={item.label} relationship="label" positioning="after" key={item.path}>
              <div
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onClick={() => navigate(item.path)}
              >
                {item.icon}
                {expanded && <Text size={300}>{item.label}</Text>}
              </div>
            </Tooltip>
          );
        })}

        <div className={styles.toggleBtn}>
          <Button
            icon={expanded ? <ChevronLeft20Regular /> : <ChevronRight20Regular />}
            appearance="subtle"
            onClick={() => setExpanded(!expanded)}
            size="small"
          />
        </div>
      </nav>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
