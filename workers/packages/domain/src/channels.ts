import { z } from "zod";

export const channelSchema = z.enum(["email", "sms", "whatsapp", "voice"]);
export type Channel = z.infer<typeof channelSchema>;
export const CHANNELS = channelSchema.options;

export function isChannel(value: unknown): value is Channel {
  return channelSchema.safeParse(value).success;
}
