import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Tooltip,
  Avatar,
  Popover,
  PopoverTrigger,
  PopoverSurface,
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
  PersonAdd20Regular,
  SignOut20Regular,
} from '@fluentui/react-icons';
import { useAuth } from '../../auth/useAuth';

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
  bottomSection: {
    marginTop: 'auto',
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    padding: '8px 6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 6px',
    cursor: 'pointer',
    borderRadius: tokens.borderRadiusMedium,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  popoverContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '8px',
    minWidth: '200px',
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
  const { isAuthEnabled, isAuthenticated, user, login, logout } = useAuth();

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
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(item.path); } }}
              >
                {item.icon}
                {expanded && <Text size={300}>{item.label}</Text>}
              </div>
            </Tooltip>
          );
        })}

        <div className={styles.bottomSection}>
          {isAuthEnabled && !isAuthenticated && (
            <Button
              icon={<PersonAdd20Regular />}
              appearance="primary"
              size="small"
              onClick={login}
            >
              {expanded ? 'Sign In' : ''}
            </Button>
          )}

          {isAuthEnabled && isAuthenticated && user && (
            <Popover>
              <PopoverTrigger>
                <div className={styles.userInfo}>
                  <Avatar name={user.name} size={28} color="brand" />
                  {expanded && (
                    <div style={{ overflow: 'hidden' }}>
                      <Text size={200} weight="semibold" block truncate>{user.name}</Text>
                      <Text size={100} style={{ opacity: 0.6 }} block truncate>{user.email}</Text>
                    </div>
                  )}
                </div>
              </PopoverTrigger>
              <PopoverSurface>
                <div className={styles.popoverContent}>
                  <Text weight="semibold">{user.name}</Text>
                  <Text size={200} style={{ opacity: 0.7 }}>{user.email}</Text>
                  <Button
                    icon={<SignOut20Regular />}
                    appearance="subtle"
                    onClick={logout}
                    size="small"
                  >
                    Sign Out
                  </Button>
                </div>
              </PopoverSurface>
            </Popover>
          )}

          <Button
            icon={expanded ? <ChevronLeft20Regular /> : <ChevronRight20Regular />}
            appearance="subtle"
            onClick={() => setExpanded(!expanded)}
            size="small"
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          />
        </div>
      </nav>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
