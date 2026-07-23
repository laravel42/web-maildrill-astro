import * as React from 'react';

/**
 * Shared WhatsApp button-row presentation: divider-separated rows in
 * the client's action blue, attached to the bubble bottom. Every
 * ButtonPlugin's Preview renders one of these — the canvas stacks them
 * and applies the >3 "See all options" collapse.
 */
export function WaButtonRow({
  icon,
  label,
  dark,
}: {
  icon: React.ReactNode;
  label: string;
  dark: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-center gap-1.5 border-t py-[10px] text-[14px] font-medium ${
        dark ? 'border-[#e9edef]/10 text-[#53bdeb]' : 'border-[#111b21]/10 text-[#00a5f4]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
