import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Badge,
  Card,
  CardHeader,
  Dropdown,
  Option,
  Spinner,
} from '@fluentui/react-components';
import type { Threat } from '@superior-tmt/shared';

const useStyles = makeStyles({
  container: {
    padding: '24px 32px',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  filters: {
    display: 'flex',
    gap: '12px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    cursor: 'pointer',
    '&:hover': {
      boxShadow: tokens.shadow8,
    },
  },
  cardBody: {
    padding: '0 16px 16px',
  },
  badges: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    gap: '12px',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '64px 32px',
    color: tokens.colorNeutralForeground3,
  },
});

const severityColors: Record<string, 'danger' | 'important' | 'warning' | 'informative' | 'subtle'> = {
  CRITICAL: 'danger',
  HIGH: 'important',
  MEDIUM: 'warning',
  LOW: 'informative',
  INFO: 'subtle',
};

const strideLabels: Record<string, string> = {
  SPOOFING: 'Spoofing',
  TAMPERING: 'Tampering',
  REPUDIATION: 'Repudiation',
  INFO_DISCLOSURE: 'Info Disclosure',
  DENIAL_OF_SERVICE: 'Denial of Service',
  ELEVATION_OF_PRIVILEGE: 'Elevation of Privilege',
};

export function ThreatList() {
  const styles = useStyles();
  const { id } = useParams<{ id: string }>();
  const [threats, setThreats] = useState<Threat[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    if (!id) return;
    const params = new URLSearchParams({ threatModelId: id });
    if (severityFilter) params.set('severity', severityFilter);
    if (statusFilter) params.set('status', statusFilter);

    fetch(`/api/threats?${params}`)
      .then((r) => r.json())
      .then(({ data }) => {
        setThreats(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id, severityFilter, statusFilter]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size="medium" />
        <Text>Loading threats...</Text>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={600} weight="semibold">
          Threats ({threats.length})
        </Text>
        <div className={styles.filters}>
          <Dropdown
            placeholder="Severity"
            value={severityFilter}
            onOptionSelect={(_e, d) => setSeverityFilter(d.optionValue as string || '')}
          >
            <Option value="">All Severities</Option>
            <Option value="CRITICAL">Critical</Option>
            <Option value="HIGH">High</Option>
            <Option value="MEDIUM">Medium</Option>
            <Option value="LOW">Low</Option>
            <Option value="INFO">Info</Option>
          </Dropdown>
          <Dropdown
            placeholder="Status"
            value={statusFilter}
            onOptionSelect={(_e, d) => setStatusFilter(d.optionValue as string || '')}
          >
            <Option value="">All Statuses</Option>
            <Option value="OPEN">Open</Option>
            <Option value="MITIGATED">Mitigated</Option>
            <Option value="ACCEPTED">Accepted</Option>
            <Option value="OUT_OF_SCOPE">Out of Scope</Option>
          </Dropdown>
        </div>
      </div>

      {threats.length === 0 ? (
        <div className={styles.empty}>
          <Text size={500} block>
            No threats found
          </Text>
          <Text size={300} block>
            Generate threats from the DFD or add them manually
          </Text>
        </div>
      ) : (
        <div className={styles.list}>
          {threats.map((threat) => (
            <Card key={threat.id} className={styles.card}>
              <CardHeader
                header={<Text weight="semibold">{threat.title}</Text>}
                description={threat.description.substring(0, 200)}
              />
              <div className={styles.cardBody}>
                <div className={styles.badges}>
                  <Badge color={severityColors[threat.severity] || 'informative'}>
                    {threat.severity}
                  </Badge>
                  <Badge appearance="outline">
                    {strideLabels[threat.strideCategory] || threat.strideCategory}
                  </Badge>
                  <Badge
                    appearance="outline"
                    color={threat.status === 'OPEN' ? 'danger' : 'success'}
                  >
                    {threat.status.replace('_', ' ')}
                  </Badge>
                  {threat.aiGenerated && (
                    <Badge appearance="outline" color="informative">
                      AI Generated
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
