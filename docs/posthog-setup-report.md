# PostHog post-wizard report

> **Two PostHog projects — do not confuse them**
>
> | Project                         | ID         | Use                                                         |
> | ------------------------------- | ---------- | ----------------------------------------------------------- |
> | Site / product UI (this report) | **526240** | Browser SDK + BFF product-analytics events below            |
> | **Maildrill messaging**         | **526344** | Infobip → Hog ingest, HogQL stats, campaign-delivery poller |
>
> Messaging/analytics ops: [`../workers/HANDOFF.md`](../workers/HANDOFF.md),
> [`../workers/docs/posthog-infobip-hog.md`](../workers/docs/posthog-infobip-hog.md).
> Env for HogQL: `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID=526344` in the
> **repo root** `.env` (never put personal keys in `PUBLIC_*`).

The wizard has completed a deep integration of PostHog into the Maildrill Astro hybrid application. Client-side tracking is initialized via `src/components/posthog.astro` injected into the root `BaseLayout.astro`, so every page (marketing, auth, and app) automatically loads the PostHog snippet. A server-side singleton (`src/lib/posthog-server.ts`) using `posthog-node` instruments the BFF API routes for auth and signup events, with `X-PostHog-Session-Id` / `X-PostHog-Distinct-Id` tracing headers ensuring client and server events are correlated to the same session. User identity is established on login via `posthog.identify()` on both the client (AuthForm.tsx) and server (signup-welcome API route).

## Events instrumented

| Event name                      | Description                                                                     | File                                        |
| ------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------- |
| `signup_form_submitted`         | User submits the signup form with name and email to start a free trial.         | `src/components/react/AuthForm.tsx`         |
| `signup_completed`              | User reaches the terminal 'on the waitlist' confirmation state after signup.    | `src/components/react/AuthForm.tsx`         |
| `login_code_requested`          | User submits their email on the login form to receive a magic-link/OTP code.    | `src/components/react/AuthForm.tsx`         |
| `login_succeeded`               | User successfully verifies their 6-digit OTP code and is signed in.             | `src/components/react/AuthForm.tsx`         |
| `signup_welcome_sent`           | Server successfully dispatched the signup welcome email to a new registrant.    | `src/pages/api/signup-welcome.ts`           |
| `login_code_sent`               | Server successfully forwarded the login code request to the auth service.       | `src/pages/api/login-code.ts`               |
| `campaign_wizard_opened`        | User opens the campaign creation wizard.                                        | `src/components/react/CampaignWizard.tsx`   |
| `campaign_wizard_step_advanced` | User clicks Continue and advances from one wizard step to the next.             | `src/components/react/CampaignWizard.tsx`   |
| `campaign_sent`                 | User confirms the review step and submits a campaign for sending or scheduling. | `src/components/react/CampaignWizard.tsx`   |
| `template_deleted`              | User deletes one or more templates from the template library.                   | `src/components/react/AppTemplates.tsx`     |
| `template_duplicated`           | User duplicates one or more templates in the template library.                  | `src/components/react/AppTemplates.tsx`     |
| `pricing_estimate_calculated`   | User interacts with the pricing estimator to calculate their estimated cost.    | `src/components/react/PricingEstimator.tsx` |
| `contact_form_submitted`        | User submits the contact / sales enquiry form on the contact page.              | `src/components/react/ContactForm.tsx`      |

## Next steps

We've built a dashboard and five insights to keep an eye on user behavior based on the events just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/526240/dashboard/1898530)
- [Signup funnel (wizard)](https://us.posthog.com/project/526240/insights/h0aXkiys)
- [Campaign creation funnel (wizard)](https://us.posthog.com/project/526240/insights/tzUpUrSD)
- [Logins over time (wizard)](https://us.posthog.com/project/526240/insights/gQc9cxnN)
- [Campaigns sent by channel (wizard)](https://us.posthog.com/project/526240/insights/7urGrMtf)
- [Pricing estimator engagement (wizard)](https://us.posthog.com/project/526240/insights/dXa7Siin)

## Status

The original post-wizard checklist is done where it mattered: the production build, lint,
and test suite pass with the instrumentation in place, and `PUBLIC_POSTHOG_PROJECT_TOKEN` /
`PUBLIC_POSTHOG_HOST` are documented in [`.env.example`](../.env.example).

Still open:

- [ ] Wire source-map upload (`posthog-cli sourcemap` or a bundler upload step) into a CI/deploy
      step so production stack traces de-minify (no CI pipeline exists yet).
- [ ] Confirm the returning-visitor path also calls `identify` — currently `identify` fires only
      on fresh OTP verification; a returning session that skips the login flow stays on an
      anonymous distinct ID until the next login.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
