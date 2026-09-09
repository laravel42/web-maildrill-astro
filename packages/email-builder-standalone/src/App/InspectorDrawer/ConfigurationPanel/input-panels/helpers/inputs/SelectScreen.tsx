import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MonitorOutlined, PhoneIphoneOutlined } from '@mui/icons-material';

import {
  setSelectedScreenSize,
  useSelectedScreenSize,
} from '../../../../../../documents/editor/EditorContext';

const OPTIONS = [
  { value: 'desktop' as const, Icon: MonitorOutlined, labelKey: 'header.desktop' },
  { value: 'mobile' as const, Icon: PhoneIphoneOutlined, labelKey: 'header.mobile' },
];

const ScreenSizeSelector = () => {
  const selectedScreenSize = useSelectedScreenSize();
  const { t } = useTranslation('inspector');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.value === selectedScreenSize) ?? OPTIONS[0];
  const ActiveIcon = current.Icon;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="eb-viewport" ref={wrapRef}>
      <div className="eb-view-tabs">
        <button
          type="button"
          className="eb-view-tabs__btn eb-view-tabs__btn--active"
          title={t(current.labelKey)}
          aria-label={t(current.labelKey)}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <ActiveIcon fontSize="small" aria-hidden="true" sx={{ fontSize: 16 }} />
          <span>{t(current.labelKey)}</span>
        </button>
      </div>
      {open ? (
        <div className="eb-viewport__menu" role="listbox">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={selectedScreenSize === opt.value}
              className={
                'eb-viewport__item' +
                (selectedScreenSize === opt.value ? ' eb-viewport__item--active' : '')
              }
              onClick={() => {
                setSelectedScreenSize(opt.value);
                setOpen(false);
              }}
            >
              <opt.Icon fontSize="small" aria-hidden="true" />
              <span>{t(opt.labelKey)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default ScreenSizeSelector;
