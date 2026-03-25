import { useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

// --- Toast Context & Provider ---
import { createContext, useContext } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

const ICONS = {
  success: <CheckCircle size={16} className="text-green-400 shrink-0" />,
  error:   <XCircle    size={16} className="text-red-400 shrink-0" />,
  info:    <AlertCircle size={16} className="text-blue-400 shrink-0" />,
};

const BORDERS = {
  success: 'border-green-500/30',
  error:   'border-red-500/30',
  info:    'border-blue-500/30',
};

function ToastItem({ toast, onDismiss }) {
  return (
    <div
      className={`slide-in-right flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-2xl min-w-[260px] max-w-[360px] ${BORDERS[toast.type] || BORDERS.info}`}
      style={{ background: 'rgba(11,18,36,0.95)' }}
    >
      {ICONS[toast.type]}
      <span className="text-sm text-gray-200 flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-600 hover:text-gray-300 transition-colors mt-0.5"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const toast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-[200]">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
