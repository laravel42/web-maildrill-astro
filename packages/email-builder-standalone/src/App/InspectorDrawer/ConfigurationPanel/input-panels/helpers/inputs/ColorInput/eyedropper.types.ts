declare global {
  interface EyeDropper {
    open(opts?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
  }
  interface Window {
    EyeDropper?: { new (): EyeDropper };
  }
}
export {};
