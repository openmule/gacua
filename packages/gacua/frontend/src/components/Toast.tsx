/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';

interface ToastMessage {
  id: string;
  message: string;
  timestamp: number;
  type: 'error' | 'success' | 'info' | 'warning';
}

interface ToastProps {
  onToast: (
    callback: (
      message: string,
      type?: 'error' | 'success' | 'info' | 'warning',
    ) => void,
  ) => void;
}

const Toast: React.FC<ToastProps> = ({ onToast }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (
      message: string,
      type: 'error' | 'success' | 'info' | 'warning' = 'error',
    ) => {
      const id = Math.random().toString(36).substring(2, 11);
      const toast: ToastMessage = {
        id,
        message,
        timestamp: Date.now(),
        type,
      };
      setToasts((prev) => [...prev, toast]);

      if (type !== 'error') {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
      }
    },
    [],
  );

  useEffect(() => {
    onToast(addToast);
  }, [addToast, onToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 md:top-4 top-20 z-10 space-y-2">
      {toasts.map((toast) => {
        const getToastStyle = () => {
          switch (toast.type) {
            case 'error':
              return 'text-red-800 bg-red-50 border-red-200';
            case 'success':
              return 'text-green-800 bg-green-50 border-green-200';
            case 'warning':
              return 'text-amber-800 bg-amber-50 border-amber-200';
            case 'info':
              return 'text-gray-800 bg-gray-50 border-gray-200';
            default:
              return 'text-red-800 bg-red-50 border-red-200';
          }
        };

        return (
          <div
            key={toast.id}
            className={`${getToastStyle()} border px-4 py-3 rounded-lg shadow-lg max-w-sm md:max-w-md lg:max-w-lg animate-slide-in`}
          >
            <div className="flex justify-between items-start">
              <p
                className="text-sm break-all word-break pr-2 hyphens-auto"
                style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
              >
                {toast.message}
              </p>
              <button
                onClick={() =>
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                }
                className="ml-2 font-bold hover:text-gray-500 flex-shrink-0"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Toast;
