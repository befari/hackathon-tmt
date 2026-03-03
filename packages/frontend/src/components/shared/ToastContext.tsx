import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { tokens } from '@fluentui/react-components';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const bgColor = (type: ToastType) => {
    switch (type) {
      case 'success': return tokens.colorPaletteGreenBackground2;
      case 'error': return tokens.colorPaletteRedBackground2;
      default: return tokens.colorNeutralBackground1;
    }
  };

  const borderColor = (type: ToastType) => {
    switch (type) {
      case 'success': return tokens.colorPaletteGreenBorder2;
      case 'error': return tokens.colorPaletteRedBorder2;
      default: return tokens.colorNeutralStroke1;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              padding: '12px 20px',
              borderRadius: '8px',
              backgroundColor: bgColor(toast.type),
              border: `1px solid ${borderColor(toast.type)}`,
              boxShadow: tokens.shadow16,
              color: tokens.colorNeutralForeground1,
              fontSize: '14px',
              maxWidth: '400px',
              animation: 'toastSlideIn 0.2s ease-out',
              pointerEvents: 'auto',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
