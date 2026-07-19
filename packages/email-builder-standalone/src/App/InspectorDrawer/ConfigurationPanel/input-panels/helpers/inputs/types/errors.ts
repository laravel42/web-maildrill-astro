export interface ErrorResponse {
  code: number;
  message: string;
  title?: string;
  action?: string;
}

export interface ImageGenerationError {
  code: number;
  title: string;
  message: string;
  action?: string;
}
