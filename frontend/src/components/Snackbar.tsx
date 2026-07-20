import { createContext, useContext, useState, useCallback, useRef } from 'react';

type Kind = 'error' | 'success' | 'info';
interface Toast {
  id: number;
  kind: Kind;
  message: string;
}

interface SnackbarApi {
  notify: (message: string, kind?: Kind) => void;
}

const SnackbarContext = createContext<SnackbarApi>({ notify: () => {} });

// eslint-disable-next-line react-refresh/only-export-components
export const useSnackbar = () => useContext(SnackbarContext);

const AUTO_HIDE_MS = 10000;

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, kind: Kind = 'error') => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, kind, message }]);
      setTimeout(() => remove(id), AUTO_HIDE_MS);
    },
    [remove]
  );

  return (
    <SnackbarContext.Provider value={{ notify }}>
      {children}
      <div className="snackbar-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`snackbar snackbar-${t.kind}`}>
            <span className="snackbar-msg">{t.message}</span>
            <button className="snackbar-close" onClick={() => remove(t.id)} aria-label="Закрыть">
              ×
            </button>
          </div>
        ))}
      </div>
    </SnackbarContext.Provider>
  );
}
