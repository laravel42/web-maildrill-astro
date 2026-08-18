export * from './core';
export { MockProvider } from './mock';
export { InfobipProvider, resolvePlatformFields } from './infobip';
export { CloudflareProvider, type CloudflareEmailSettings } from './cloudflare';
export { getProvider } from './registry';
export {
  createTransactionalMailer,
  sendTransactionalEmail,
  type TransactionalEmail,
  type TransactionalSendResult,
} from './transactional';
export { setProviderHttpSink, type ProviderHttpEvent } from './http-observer';
export { setProviderSendSink, type ProviderSendEvent } from './send-observer';
