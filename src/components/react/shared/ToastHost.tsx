import Icon from '../Icon';
import type { ToastTone } from './useToast';

type Props = {
  toast: string | null;
  tone?: ToastTone;
};

/**
 * Single shared render site for the transient bottom-center toast used by
 * every workspace screen. Pair with `useToast()`, which owns the state; this
 * component only renders it. `tone: 'alert'` swaps the icon/shadow to the
 * warning hue and switches to an assertive live region — it flags an
 * unfinished or attention-needing result, not a hard failure.
 */
export default function ToastHost({ toast, tone = 'success' }: Props) {
  if (!toast) return null;
  const isAlert = tone === 'alert';
  return (
    <div
      className={`atoast${isAlert ? ' atoast--alert' : ''}`}
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
    >
      <span className="atoast__ic">
        <Icon name={isAlert ? 'minus' : 'check'} size={13} stroke={3} />
      </span>
      {toast}
    </div>
  );
}
