/**
 * Image Upload Simulator
 *
 * Simulates the external handlers that normally come from the host/API:
 * - File upload (email-builder-upload-image → email-builder-upload-image-receive)
 */

/// <reference lib="dom" />

interface SimulatorConfig {
  /** Delay in ms to simulate file upload. Default: 1500 */
  uploadDelayMs?: number;
  /** Failure probability (0-1). Default: 0 */
  failRate?: number;
}

interface UploadImageDetail {
  images: string[]; // base64 strings
  id: string;
}

/**
 * Convert a base64 data URL to a local blob URL — mimics a server that
 * receives the file and returns an accessible URL.
 */
const base64ToBlobUrl = (base64: string): string => {
  try {
    const [header, data] = base64.split(',');
    const mimeMatch = header.match(/data:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    return URL.createObjectURL(blob);
  } catch {
    return base64;
  }
};

const shouldFail = (failRate: number): boolean => Math.random() < failRate;

export const initImageUploadSimulator = (config: SimulatorConfig = {}) => {
  const { uploadDelayMs = 1500, failRate = 0 } = config;

  console.log('[ImageSimulator] Initialized — upload:', uploadDelayMs, 'ms, failRate:', failRate);

  /**
   * Handler: file upload
   * Listens: email-builder-upload-image
   * Responds: email-builder-upload-image-receive
   */
  const handleFileUpload = (event: Event) => {
    const { detail } = event as CustomEvent<UploadImageDetail>;
    const { images, id } = detail;

    console.log(`[ImageSimulator] Upload received — blockId: ${id}, files: ${images.length}`);

    setTimeout(() => {
      if (shouldFail(failRate)) {
        console.warn('[ImageSimulator] Upload simulated failure');
        window.dispatchEvent(
          new CustomEvent('email-builder-toggle-upload-file', {
            detail: { uploading: false, id },
          }),
        );
        return;
      }

      const url = images[0]
        ? base64ToBlobUrl(images[0])
        : 'https://placehold.co/600x400/EEE/31343C?text=Upload+Simulado';

      console.log(`[ImageSimulator] Upload complete — blockId: ${id}, url: ${url.substring(0, 60)}...`);

      window.dispatchEvent(
        new CustomEvent('email-builder-upload-image-receive', {
          detail: { id, url, data: null },
        }),
      );
    }, uploadDelayMs);
  };

  window.addEventListener('email-builder-upload-image', handleFileUpload);

  return () => {
    window.removeEventListener('email-builder-upload-image', handleFileUpload);
  };
};
