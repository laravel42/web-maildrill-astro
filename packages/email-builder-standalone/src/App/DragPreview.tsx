import { usePreview } from 'react-dnd-preview';

import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

export default function DragPreview() {
  const preview = usePreview<unknown, HTMLDivElement>();
  if (!preview.display) return null;

  const { ref, style } = preview;

  return (
    <div
      ref={ref}
      style={{
        ...style,
        zIndex: 9999,
        background: '#1976d2',
        color: '#fff',
        borderRadius: 4,
        padding: '6px 12px',
        opacity: 0.85,
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <DragIndicatorIcon fontSize="small" />
    </div>
  );
}
