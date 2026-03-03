import React from 'react';
import ReactDOM from 'react-dom/client';
import { FluentProvider, webDarkTheme } from '@fluentui/react-components';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance, isAuthEnabled } from './auth/msalConfig';
import { ToastProvider } from './components/shared/ToastContext';
import App from './App';

function Root() {
  return (
    <MsalProvider instance={msalInstance}>
      <FluentProvider theme={webDarkTheme}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </FluentProvider>
    </MsalProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
