import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/**
 * Back to the page you came from. If the app was opened straight onto this page
 * (no earlier page in this session), goes to `fallback` instead of leaving the app.
 * With `confirmLeave`, asks first (unsaved work).
 */
/** Go to the previous page, or to `fallback` when there is none in this session. */
export function useGoBack(fallback: string): () => void {
  const nav = useNavigate();
  const loc = useLocation();
  return () => {
    if (loc.key === 'default') nav(fallback, { replace: true });
    else nav(-1);
  };
}

export function BackButton({ fallback, confirmLeave }: { fallback: string; confirmLeave?: string | null }) {
  const goBack = useGoBack(fallback);
  return (
    <button type="button" className="back" onClick={() => {
      if (confirmLeave && !window.confirm(confirmLeave)) return;
      goBack();
    }}>
      <ChevronLeft size={18} aria-hidden /> Back
    </button>
  );
}
