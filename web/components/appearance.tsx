'use client';

import { useEffect } from 'react';

export function Appearance() {
  useEffect(() => {
    const restore = () => {
      try { document.documentElement.classList.toggle('dark', localStorage.getItem('reachard-appearance') === 'dark'); }
      catch { /* Keep the default theme if browser storage is blocked. */ }
    };
    restore();
    window.addEventListener('storage', restore);
    return () => window.removeEventListener('storage', restore);
  }, []);
  return null;
}
