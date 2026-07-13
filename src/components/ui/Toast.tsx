"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";

type ToastItem = { id: number; message: string; type: "success" | "error" };

const ToastContext = createContext<{
  toast: (message: string, type?: "success" | "error") => void;
}>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  let counter = 0;

  const toast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now() + counter++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item toast-${t.type}`}>
            {t.type === "success" ? "✓" : "✕"} {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
