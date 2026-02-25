import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { useCallback } from 'react';
import { loginRequest, isAuthEnabled } from './msalConfig';

export function useAuth() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const user = accounts[0];

  const login = useCallback(async () => {
    try {
      await instance.loginPopup(loginRequest);
    } catch (err) {
      console.error('Login failed:', err);
    }
  }, [instance]);

  const logout = useCallback(async () => {
    try {
      await instance.logoutPopup();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }, [instance]);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!isAuthEnabled) return null;
    if (!user) return null;
    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: user,
      });
      return response.accessToken;
    } catch {
      // Silent failed, try popup
      try {
        const response = await instance.acquireTokenPopup(loginRequest);
        return response.accessToken;
      } catch (err) {
        console.error('Token acquisition failed:', err);
        return null;
      }
    }
  }, [instance, user]);

  return {
    isAuthEnabled,
    isAuthenticated: isAuthEnabled ? isAuthenticated : true,
    user: user ? { name: user.name || '', email: user.username || '' } : null,
    login,
    logout,
    getToken,
  };
}
