'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full px-4 sm:px-0">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 p-4 rounded-xl border shadow-lg text-xs font-semibold transition-all duration-300 transform translate-y-0 opacity-100 ${
              t.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : t.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-indigo-50 border-indigo-200 text-indigo-800'
            }`}
          >
            {t.type === 'success' && <CheckCircle size={16} className="text-green-600 shrink-0" />}
            {t.type === 'error' && <AlertTriangle size={16} className="text-red-600 shrink-0" />}
            {t.type === 'info' && <Info size={16} className="text-indigo-600 shrink-0" />}
            
            <div className="flex-1 leading-normal">{t.message}</div>
            
            <button 
              onClick={() => removeToast(t.id)}
              className="p-0.5 hover:bg-black/5 rounded text-slate-400 hover:text-slate-600 transition"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
