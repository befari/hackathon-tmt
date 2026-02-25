import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner, Text } from '@fluentui/react-components';
import { api } from '../../api/client';
import { useAuth } from '../../auth/useAuth';

export function ShareJoin() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, login, isAuthEnabled } = useAuth();
  const [status, setStatus] = useState<'loading' | 'login' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    if (isAuthEnabled && !isAuthenticated) {
      setStatus('login');
      login();
      return;
    }

    api.joinShareLink(token)
      .then(({ data }) => {
        navigate(`/model/${data.threatModelId}`);
      })
      .catch((err) => {
        setError(err.message);
        setStatus('error');
      });
  }, [token, isAuthenticated, isAuthEnabled, login, navigate]);

  if (status === 'error') {
    return (
      <div style={{ padding: '64px', textAlign: 'center' }}>
        <Text size={500} block>Failed to join</Text>
        <Text size={300} style={{ opacity: 0.7 }}>{error}</Text>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
      <Spinner size="medium" />
      <Text>{status === 'login' ? 'Please sign in to join...' : 'Joining threat model...'}</Text>
    </div>
  );
}
