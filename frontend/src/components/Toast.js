// =============================================================================
// Toast.js - Reusable Toast Notification System
// =============================================================================
// Provides a global toast notification system using React Context.
// Toasts are small popup messages that appear bottom-right and auto-dismiss.
//
// Usage in any component:
//   const { showToast } = useToast();
//   showToast('Item added to cart!', 'success');
//
// Toast types:
//   - 'success'  Green checkmark - for positive actions
//   - 'error'    Red X - for failures
//   - 'info'     Orange info - for neutral messages
// =============================================================================

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

// Create toast context
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  // toasts: array of active toast objects
  // Each toast: { id, message, type, visible }
  const [toasts, setToasts] = useState([]);

  // showToast: adds a new toast and auto-removes it after 3 seconds
  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now(); // Unique ID based on timestamp

    // Add new toast to the array
    setToasts(prev => [...prev, { id, message, type, visible: true }]);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // dismissToast: manually removes a toast when X is clicked
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Icon and colour mapping based on toast type
  const toastStyles = {
    success: {
      icon: <CheckCircle size={16} className="text-green-500 flex-shrink-0" />,
      bar: 'bg-green-500'
    },
    error: {
      icon: <XCircle size={16} className="text-red-500 flex-shrink-0" />,
      bar: 'bg-red-500'
    },
    info: {
      icon: <Info size={16} className="text-[#FF6B00] flex-shrink-0" />,
      bar: 'bg-[#FF6B00]'
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* ================================================================
          TOAST CONTAINER
          Fixed position bottom-right, stacks multiple toasts vertically.
          z-[99999] ensures toasts appear above everything including modals.
          ================================================================ */}
      <div className="fixed bottom-24 right-6 z-[99999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => {
          const style = toastStyles[toast.type] || toastStyles.info;
          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-center gap-3 bg-white border border-black/10 rounded-xl px-4 py-3 shadow-lg min-w-[260px] max-w-[320px] animate-slide-in-right"
              data-testid="toast-notification"
            >
              {/* Toast type icon */}
              {style.icon}

              {/* Toast message text */}
              <p className="flex-1 text-[#1a1a1a] text-sm font-medium">{toast.message}</p>

              {/* Manual dismiss button */}
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-[#ccc] hover:text-[#999] transition-colors"
              >
                <X size={14} />
              </button>

              {/* Animated progress bar showing time remaining */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden">
                <div className={`h-full ${style.bar} animate-shrink-width`} />
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// Custom hook for using toast in any component
export const useToast = () => useContext(ToastContext);