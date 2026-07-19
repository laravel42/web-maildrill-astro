import { ErrorResponse, ImageGenerationError } from '../types/errors';

export const getErrorDetails = (error: ErrorResponse): ImageGenerationError => {
  const errorMap: Record<number, ImageGenerationError> = {
    400: {
      code: 400,
      title: error.title || 'Invalid Request',
      message: error.message || 'The request was invalid. Please check your input and try again.',
      action: error.action || 'Modify your prompt and try again',
    },
    401: {
      code: 401,
      title: error.title || 'Authentication Required',
      message: error.message || 'You need to be authenticated to perform this action.',
      action: error.action || 'Please log in and try again',
    },
    403: {
      code: 403,
      title: error.title || 'Access Denied',
      message: error.message || "You don't have permission to perform this action.",
      action: error.action || 'Contact support if you believe this is a mistake',
    },
    404: {
      code: 404,
      title: error.title || 'Not Found',
      message: error.message || 'The requested resource was not found.',
      action: error.action || 'Try again or use a different prompt',
    },
    422: {
      code: 422,
      title: error.title || 'Invalid Input',
      message: error.message || 'The provided input cannot be processed.',
      action: error.action || 'Modify your prompt and try again',
    },
    429: {
      code: 429,
      title: error.title || 'Too Many Requests',
      message: error.message || "You've made too many requests. Please wait a moment.",
      action: error.action || 'Please wait a few minutes before trying again',
    },
    500: {
      code: 500,
      title: error.title || 'Server Error',
      message: error.message || 'An unexpected error occurred on our servers.',
      action: error.action || 'Please try again later',
    },
    502: {
      code: 502,
      title: error.title || 'Bad Gateway',
      message: error.message || 'The server received an invalid response.',
      action: error.action || 'Please try again later',
    },
    503: {
      code: 503,
      title: error.title || 'Service Unavailable',
      message: error.message || 'The service is temporarily unavailable.',
      action: error.action || 'Please try again later',
    },
  };

  return (
    errorMap[error.code] || {
      code: error.code,
      title: 'Unexpected Error',
      message: 'An unexpected error occurred.',
      action: 'Please try again later',
    }
  );
};
