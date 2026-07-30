/**
 * Vision-powered name + tag suggestions for media uploads.
 * Uses OpenAI gpt-4o against a base64 image the browser stages before confirm.
 */
import OpenAI from "openai";
import { ConflictError, ValidationError } from "@maildrill/domain";

const MODEL = process.env.MEDIA_SUGGEST_MODEL?.trim() || "gpt-4o";
const MAX_BASE64_CHARS = 6_000_000; // ~4.5MB raw — client should shrink first
const MAX_TAGS = 3;

/** Color names, meta noise, and other tags that don't help library search. */
const DROP_TAGS = new Set([
  "abstract",
  "aesthetic",
  "background",
  "backgrounds",
  "beautiful",
  "beauty",
  "beige",
  "black",
  "blue",
  "blur",
  "bokeh",
  "brown",
  "closeup",
  "close-up",
  "color",
  "colorful",
  "colors",
  "colour",
  "colours",
  "cool",
  "cyan",
  "dark",
  "desktop",
  "detail",
  "editorial",
  "file",
  "gold",
  "gray",
  "grey",
  "green",
  "hd",
  "image",
  "indigo",
  "jpg",
  "jpeg",
  "light",
  "magenta",
  "media",
  "minimal",
  "modern",
  "none",
  "orange",
  "pastel",
  "photo",
  "photograph",
  "photography",
  "picture",
  "pink",
  "png",
  "pretty",
  "purple",
  "red",
  "silver",
  "stock",
  "style",
  "teal",
  "texture",
  "vibrant",
  "violet",
  "wallpaper",
  "wallpapers",
  "webp",
  "white",
  "yellow",
]);

export type MediaSuggestInput = {
  /** Raw base64 (no data: URL prefix). */
  imageBase64: string;
  contentType: string;
};

export type MediaSuggestResult = {
  name: string;
  tags: string[];
  /** Optional short topic folder slug, e.g. "nature" or "street photography". */
  folder: string | null;
};

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
]);

const SYSTEM = `You label images for a marketing media library.
Return ONLY a JSON object (no markdown) with:
- "name": short descriptive kebab-case id, 2–8 words joined by hyphens (e.g. "fox-in-snow"), no file extension, no spaces
- "tags": at most 3 lowercase searchable tags — only the strongest subjects (what/where/activity). Prefer nouns like "fox", "airport", "laptop"
- "folder": optional short topic folder (lowercase, spaces ok), or null

Never tag with: color names (red, blue, green, …), numbers, file types, or generic words (image, photo, background, beautiful, aesthetic, wallpaper, stock).
If unsure, return fewer than 3 tags rather than padding with weak ones.`;

function stripDataUrl(raw: string): { base64: string; contentType?: string } {
  const m = raw.match(/^data:([^;]+);base64,(.+)$/s);
  if (m) return { contentType: m[1], base64: m[2]! };
  return { base64: raw };
}

function toKebabCase(value: string): string {
  return value
    .trim()
    .replace(/['’]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 120);
}

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = toKebabCase(raw.replace(/\.[a-z0-9]+$/i, ""));
  if (name.length < 2) return null;
  return name;
}

function isWeakTag(tag: string): boolean {
  if (DROP_TAGS.has(tag)) return true;
  if (/^\d+$/.test(tag)) return true; // pure numbers
  if (/\d/.test(tag) && tag.length <= 4) return true; // "4k", "1080", "v2"
  // Single color-ish tokens often slip through as "navy blue" etc.
  const parts = tag.split(/\s+/);
  if (parts.length > 0 && parts.every((p) => DROP_TAGS.has(p))) return true;
  return false;
}

function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = item
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (tag.length < 2 || tag.length > 40 || seen.has(tag)) continue;
    if (isWeakTag(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

function sanitizeFolder(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const folder = raw
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (folder.length < 2 || folder.length > 48) return null;
  return folder;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1]!.trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ValidationError("AI returned no JSON object");
  try {
    return JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new ValidationError("AI returned invalid JSON");
  }
}

/** Whether OPENAI_API_KEY is set so the UI can skip the round-trip when offline. */
export function mediaSuggestConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Ask a vision model for a descriptive name + tags for an uploaded image.
 * Throws ConflictError when OpenAI is not configured; ValidationError on bad input.
 */
export async function suggestMediaMetadata(
  input: MediaSuggestInput,
): Promise<MediaSuggestResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ConflictError("OPENAI_API_KEY is not configured");
  }

  const stripped = stripDataUrl(input.imageBase64.trim());
  const contentType = (input.contentType || stripped.contentType || "").toLowerCase();
  if (!IMAGE_TYPES.has(contentType)) {
    throw new ValidationError(`unsupported image type: ${contentType || "(empty)"}`);
  }
  const imageBase64 = stripped.base64.replace(/\s+/g, "");
  if (!imageBase64 || imageBase64.length > MAX_BASE64_CHARS) {
    throw new ValidationError("image payload is empty or too large");
  }

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 400,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe this image for a media library. JSON only.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${contentType};base64,${imageBase64}`,
              detail: "low",
            },
          },
        ],
      },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? "";
  const json = parseJsonObject(text);
  const name = sanitizeName(json.name);
  const tags = sanitizeTags(json.tags);
  const folder = sanitizeFolder(json.folder);

  if (!name) throw new ValidationError("AI did not return a usable name");

  return { name, tags, folder };
}
