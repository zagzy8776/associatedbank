import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'rubicon_hide_balances';

/**
 * Balance visibility preference with session persistence (Req 5.4).
 *
 * The preference lives in `sessionStorage` so it survives navigation between
 * pages during a session but resets when the browser tab is closed — the
 * expected behaviour for a privacy control.
 */
export function useBalanceVisibility() {
  const [hideBalances, setHideBalances] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(hideBalances));
    } catch {
      /* Private browsing modes can block storage — the toggle still works. */
    }
  }, [hideBalances]);

  const toggle = useCallback(() => setHideBalances((v) => !v), []);

  return { hideBalances, toggle, setHideBalances };
}

/** True once the window has scrolled past `threshold` pixels (Req 10.5). */
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return scrolled;
}