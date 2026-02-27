import { useState, useCallback, useEffect } from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Input,
  Dropdown,
  Option,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  Badge,
  Divider,
  Tooltip,
} from '@fluentui/react-components';
import {
  Share20Regular,
  Copy20Regular,
  Delete20Regular,
  PersonAdd20Regular,
  Link20Regular,
} from '@fluentui/react-icons';
import { api } from '../../api/client';

const useStyles = makeStyles({
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
  },
  memberInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  linkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 0',
  },
  linkUrl: {
    flex: 1,
    fontSize: '12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    opacity: 0.7,
  },
  section: {
    marginTop: '16px',
  },
  inviteRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end',
  },
});

interface ShareDialogProps {
  threatModelId: string;
  threatModelName: string;
}

export function ShareDialog({ threatModelId, threatModelName }: ShareDialogProps) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [shareLinks, setShareLinks] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EDITOR');
  const [linkRole, setLinkRole] = useState('VIEWER');
  const [copied, setCopied] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [membersRes, linksRes] = await Promise.all([
        api.listMembers(threatModelId),
        api.listShareLinks(threatModelId),
      ]);
      setMembers(membersRes.data || []);
      setShareLinks((linksRes.data || []).filter((l: any) => l.active));
    } catch (err) {
      console.error('Failed to load sharing data:', err);
    }
  }, [threatModelId]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return;
    try {
      await api.addMember(threatModelId, { email: inviteEmail, role: inviteRole });
      setInviteEmail('');
      loadData();
    } catch (err) {
      console.error('Failed to invite:', err);
    }
  }, [threatModelId, inviteEmail, inviteRole, loadData]);

  const handleCreateLink = useCallback(async () => {
    try {
      await api.createShareLink(threatModelId, { role: linkRole });
      loadData();
    } catch (err) {
      console.error('Failed to create share link:', err);
    }
  }, [threatModelId, linkRole, loadData]);

  const handleCopyLink = useCallback((token: string) => {
    const url = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleRemoveMember = useCallback(async (memberId: string) => {
    try {
      await api.removeMember(threatModelId, memberId);
      loadData();
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  }, [threatModelId, loadData]);

  const handleDeleteLink = useCallback(async (linkId: string) => {
    try {
      await api.deleteShareLink(threatModelId, linkId);
      loadData();
    } catch (err) {
      console.error('Failed to delete link:', err);
    }
  }, [threatModelId, loadData]);

  const roleColors: Record<string, 'brand' | 'important' | 'informative' | 'subtle'> = {
    OWNER: 'important',
    EDITOR: 'brand',
    REVIEWER: 'informative',
    VIEWER: 'subtle',
  };

  return (
    <Dialog open={open} onOpenChange={(_e, data) => setOpen(data.open)}>
      <DialogTrigger>
        <Tooltip content="Share" relationship="label">
          <Button icon={<Share20Regular />} appearance="subtle" size="small" aria-label="Share" title="Share this threat model">
            Share
          </Button>
        </Tooltip>
      </DialogTrigger>
      <DialogSurface style={{ maxWidth: '520px' }}>
        <DialogBody>
          <DialogTitle>Share "{threatModelName}"</DialogTitle>
          <DialogContent>
            {/* Invite by email */}
            <div className={styles.inviteRow}>
              <Input
                placeholder="Enter email address"
                value={inviteEmail}
                onChange={(_e, d) => setInviteEmail(d.value)}
                style={{ flex: 1 }}
                aria-label="Email address to invite"
              />
              <Dropdown
                value={inviteRole}
                selectedOptions={[inviteRole]}
                onOptionSelect={(_e, d) => setInviteRole(d.optionValue as string)}
                style={{ minWidth: '110px' }}
              >
                <Option value="EDITOR">Editor</Option>
                <Option value="REVIEWER">Reviewer</Option>
                <Option value="VIEWER">Viewer</Option>
              </Dropdown>
              <Button icon={<PersonAdd20Regular />} appearance="primary" onClick={handleInvite} disabled={!inviteEmail.trim()}>
                Invite
              </Button>
            </div>

            {/* Current members */}
            {members.length > 0 && (
              <div className={styles.section}>
                <Text size={200} weight="semibold" block style={{ marginBottom: '8px' }}>
                  People with access
                </Text>
                {members.map((m: any) => (
                  <div key={m.id} className={styles.memberRow}>
                    <div className={styles.memberInfo}>
                      <Text size={200} weight="semibold">{m.user?.name || 'Unknown'}</Text>
                      <Text size={100} style={{ opacity: 0.6 }}>{m.user?.email}</Text>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <Badge appearance="outline" color={roleColors[m.role] || 'subtle'}>{m.role}</Badge>
                      {m.role !== 'OWNER' && (
                        <Button
                          icon={<Delete20Regular />}
                          appearance="subtle"
                          size="small"
                          onClick={() => handleRemoveMember(m.id)}
                          aria-label="Remove member"
                          title="Remove member"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Divider style={{ margin: '16px 0' }} />

            {/* Share links */}
            <Text size={200} weight="semibold" block style={{ marginBottom: '8px' }}>
              <Link20Regular style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Share links
            </Text>
            <div className={styles.inviteRow} style={{ marginBottom: '8px' }}>
              <Dropdown
                value={linkRole}
                selectedOptions={[linkRole]}
                onOptionSelect={(_e, d) => setLinkRole(d.optionValue as string)}
                style={{ minWidth: '110px' }}
              >
                <Option value="EDITOR">Editor</Option>
                <Option value="REVIEWER">Reviewer</Option>
                <Option value="VIEWER">Viewer</Option>
              </Dropdown>
              <Button icon={<Link20Regular />} appearance="secondary" onClick={handleCreateLink}>
                Create Link
              </Button>
            </div>

            {shareLinks.map((link: any) => (
              <div key={link.id} className={styles.linkRow}>
                <Badge appearance="outline" color={roleColors[link.role] || 'subtle'}>{link.role}</Badge>
                <span className={styles.linkUrl}>
                  {window.location.origin}/join/{link.token}
                </span>
                <Button
                  icon={<Copy20Regular />}
                  appearance="subtle"
                  size="small"
                  onClick={() => handleCopyLink(link.token)}
                  aria-label="Copy link"
                  title="Copy share link"
                >
                  {copied === link.token ? 'Copied!' : ''}
                </Button>
                <Button
                  icon={<Delete20Regular />}
                  appearance="subtle"
                  size="small"
                  onClick={() => handleDeleteLink(link.id)}
                  aria-label="Revoke link"
                  title="Revoke share link"
                />
              </div>
            ))}

            {shareLinks.length === 0 && (
              <Text size={200} style={{ opacity: 0.5 }}>No active share links</Text>
            )}
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
