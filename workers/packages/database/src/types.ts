import type {
  apiKeys,
  billingUsageLines,
  billingUsageRequests,
  creditRecharges,
  emailDomains,
  campaigns,
  customFieldDefs,
  deadLetters,
  lists,
  magicLinkTokens,
  mediaAssets,
  memberships,
  messageAttempts,
  messageEvents,
  messages,
  outboxEvents,
  providerAccounts,
  segments,
  subscribers,
  suppressions,
  tags,
  templates,
  tenants,
  usageRecords,
  users,
  webhookEvents,
  authSessions,
  passkeys,
  webauthnChallenges,
  userTotp,
  recoveryCodes,
  trustedDevices,
  authTickets,
  securityEvents,
  wallets,
  walletTransactions,
  creditReservations,
  creditPackages,
  pricingTiers,
  channelPricing,
  stripeEvents,
  paymentAttempts,
  paymentCustomers,
} from './schema';

export type { SegmentRule } from './schema';

export type Tenant = typeof tenants.$inferSelect;
export type ProviderAccount = typeof providerAccounts.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;

export type MessageRow = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type MessageAttemptRow = typeof messageAttempts.$inferSelect;
export type NewMessageAttempt = typeof messageAttempts.$inferInsert;

export type MessageEventRow = typeof messageEvents.$inferSelect;
export type NewMessageEvent = typeof messageEvents.$inferInsert;

export type WebhookEventRow = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;

export type OutboxEventRow = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;

export type UsageRecordRow = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;

export type DeadLetterRow = typeof deadLetters.$inferSelect;
export type NewDeadLetter = typeof deadLetters.$inferInsert;

// --- product data model ---

export type Subscriber = typeof subscribers.$inferSelect;
export type NewSubscriber = typeof subscribers.$inferInsert;

export type ListRow = typeof lists.$inferSelect;
export type NewList = typeof lists.$inferInsert;

export type SegmentRow = typeof segments.$inferSelect;
export type NewSegment = typeof segments.$inferInsert;

export type TagRow = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

export type TemplateRow = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;

export type SuppressionRow = typeof suppressions.$inferSelect;
export type NewSuppression = typeof suppressions.$inferInsert;

export type MediaAssetRow = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;

export type CustomFieldDefRow = typeof customFieldDefs.$inferSelect;
export type NewCustomFieldDef = typeof customFieldDefs.$inferInsert;

// --- identity ---

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;

export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
export type NewMagicLinkToken = typeof magicLinkTokens.$inferInsert;

export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type EmailDomainRow = typeof emailDomains.$inferSelect;
export type NewEmailDomain = typeof emailDomains.$inferInsert;

// --- account security ---

export type AuthSessionRow = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;

export type PasskeyRow = typeof passkeys.$inferSelect;
export type NewPasskey = typeof passkeys.$inferInsert;

export type WebauthnChallengeRow = typeof webauthnChallenges.$inferSelect;
export type NewWebauthnChallenge = typeof webauthnChallenges.$inferInsert;

export type UserTotpRow = typeof userTotp.$inferSelect;
export type NewUserTotp = typeof userTotp.$inferInsert;

export type RecoveryCodeRow = typeof recoveryCodes.$inferSelect;
export type NewRecoveryCode = typeof recoveryCodes.$inferInsert;

export type TrustedDeviceRow = typeof trustedDevices.$inferSelect;
export type NewTrustedDevice = typeof trustedDevices.$inferInsert;

export type AuthTicketRow = typeof authTickets.$inferSelect;
export type NewAuthTicket = typeof authTickets.$inferInsert;

export type SecurityEventRow = typeof securityEvents.$inferSelect;
export type NewSecurityEvent = typeof securityEvents.$inferInsert;

// --- billing ---

export type WalletRow = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;

export type WalletTransactionRow = typeof walletTransactions.$inferSelect;
export type NewWalletTransaction = typeof walletTransactions.$inferInsert;

export type CreditReservationRow = typeof creditReservations.$inferSelect;
export type NewCreditReservation = typeof creditReservations.$inferInsert;

export type CreditPackageRow = typeof creditPackages.$inferSelect;
export type NewCreditPackage = typeof creditPackages.$inferInsert;

export type PricingTierRow = typeof pricingTiers.$inferSelect;
export type NewPricingTier = typeof pricingTiers.$inferInsert;

export type ChannelPricingRow = typeof channelPricing.$inferSelect;
export type NewChannelPricing = typeof channelPricing.$inferInsert;

export type StripeEventRow = typeof stripeEvents.$inferSelect;
export type NewStripeEvent = typeof stripeEvents.$inferInsert;

export type PaymentAttemptRow = typeof paymentAttempts.$inferSelect;
export type NewPaymentAttempt = typeof paymentAttempts.$inferInsert;

export type PaymentCustomerRow = typeof paymentCustomers.$inferSelect;
export type NewPaymentCustomer = typeof paymentCustomers.$inferInsert;

// --- provider-billed usage + recharge history ---

export type BillingUsageRequestRow = typeof billingUsageRequests.$inferSelect;
export type NewBillingUsageRequest = typeof billingUsageRequests.$inferInsert;

export type BillingUsageLineRow = typeof billingUsageLines.$inferSelect;
export type NewBillingUsageLine = typeof billingUsageLines.$inferInsert;

export type CreditRechargeRow = typeof creditRecharges.$inferSelect;
export type NewCreditRecharge = typeof creditRecharges.$inferInsert;
