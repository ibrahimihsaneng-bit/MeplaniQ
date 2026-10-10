import React, { useEffect } from 'react';

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isError = toast.type === 'error';
  const isSuccess = toast.type === 'success';

  return (
    <div className={`cad-toast ${toast.type || 'info'}`}>
      <div className="toast-icon">
        {isSuccess && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {isError && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        )}
        {!isSuccess && !isError && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        )}
      </div>
      <div className="toast-content">
        <span className="toast-title">
          {isSuccess ? 'Plan Imported' : isError ? 'Upload Error' : 'Notice'}
        </span>
        <span className="toast-message">{toast.message}</span>
      </div>
      <button className="toast-close-btn" onClick={onClose} aria-label="Close notification">
        &times;
      </button>
    </div>
  );
}
