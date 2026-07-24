import { config } from "@maildrill/config";
import type { Channel } from "@maildrill/domain";

export interface ChannelSenderDisplay {
  label: string;
  value: string;
}

export type ChannelSenders = Record<Channel, ChannelSenderDisplay>;

/** Pretty-print E.164 digits for UI (Infobip stores digits without +). */
function formatPhoneDisplay(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return raw.trim();
  if (d.length === 11 && d.startsWith("1")) {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return `+${d}`;
}

function emailDisplay(from: string): string {
  if (from.includes("<")) return from;
  const local = from.split("@")[0] ?? "Maildrill";
  const brand = local
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `${brand} <${from}>`;
}

function smsDisplay(from: string): string {
  const digits = from.replace(/\D/g, "");
  if (digits.length >= 10) return formatPhoneDisplay(from);
  return from;
}

/** Outbound sender labels the campaign wizard should show — mirrors Infobip config. */
export function getChannelSenders(): ChannelSenders {
  const phone = config.infobip.phoneFrom;
  const phoneDisplay = phone ? formatPhoneDisplay(phone) : null;
  const whatsapp = config.infobip.whatsappFrom || phone;
  const voice = config.infobip.voiceFrom || phone;

  return {
    email: { label: "Sender", value: emailDisplay(config.infobip.from) },
    sms: {
      label: "Sender ID",
      value: config.infobip.phoneFrom ? smsDisplay(config.infobip.phoneFrom) : "MAILDRILL",
    },
    whatsapp: {
      label: "Business number",
      value: whatsapp ? formatPhoneDisplay(whatsapp) : (phoneDisplay ?? "Not configured"),
    },
    voice: {
      label: "Caller ID",
      value: voice ? formatPhoneDisplay(voice) : (phoneDisplay ?? "Not configured"),
    },
  };
}
