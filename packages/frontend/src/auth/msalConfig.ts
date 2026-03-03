import { PublicClientApplication, Configuration, LogLevel } from '@azure/msal-browser';

const clientId = (import.meta as any).env?.VITE_AZURE_CLIENT_ID || '';

const msalConfig: Configuration = {
  auth: {
    clientId: clientId || 'placeholder',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
    },
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const loginRequest = {
  scopes: clientId ? [`api://${clientId}/access_as_user`] : [],
};

export const isAuthEnabled = !!clientId;
