// Stripe access layer. Uses the "separate charges and transfers" marketplace
// model: the sender is charged on the platform with manual capture (authorize at
// funding, capture on pickup), then the traveller is paid via an explicit
// Transfer on dropoff. Keeps PBuddy's escrow logic server-side only.
//
// A test seam (setStripeForTests) lets the suite inject a fake so the escrow
// state machine is tested without touching the network.
import Stripe from 'stripe';
import { config } from '../config.ts';

// The subset of the Stripe SDK we depend on — also the shape a test fake mimics.
export interface StripeLike {
  accounts: { create(params: Stripe.AccountCreateParams): Promise<{ id: string }> };
  accountLinks: { create(params: Stripe.AccountLinkCreateParams): Promise<{ url: string }> };
  paymentIntents: {
    create(params: Stripe.PaymentIntentCreateParams): Promise<{ id: string; client_secret: string | null; status: string }>;
    capture(id: string): Promise<{ id: string; status: string }>;
    cancel(id: string): Promise<{ id: string; status: string }>;
  };
  transfers: { create(params: Stripe.TransferCreateParams): Promise<{ id: string }> };
  refunds: { create(params: Stripe.RefundCreateParams): Promise<{ id: string; status: string | null }> };
  webhooks: { constructEvent(payload: string | Buffer, sig: string, secret: string): Stripe.Event };
}

let real: Stripe | null = null;
let fake: StripeLike | null = null;

export function setStripeForTests(client: StripeLike | null): void {
  fake = client;
}

function stripe(): StripeLike {
  if (fake) return fake;
  if (!real) real = new Stripe(config.stripeSecretKey);
  return real as unknown as StripeLike;
}

export async function createConnectAccount(email: string | undefined): Promise<string> {
  const acct = await stripe().accounts.create({
    type: 'express',
    email,
    capabilities: { transfers: { requested: true } },
  });
  return acct.id;
}

export async function createOnboardingLink(accountId: string): Promise<string> {
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: `${config.appBaseUrl}/connect/refresh`,
    return_url: `${config.appBaseUrl}/connect/return`,
  });
  return link.url;
}

export interface EscrowIntentResult { id: string; clientSecret: string | null; status: string }

/** Authorize the full charge on the sender with manual capture (escrow hold). */
export async function createEscrowPaymentIntent(params: {
  amountPennies: number;
  bookingId: string;
  metadata?: Record<string, string>;
}): Promise<EscrowIntentResult> {
  const pi = await stripe().paymentIntents.create({
    amount: params.amountPennies,
    currency: 'gbp',
    capture_method: 'manual',
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    metadata: { booking_id: params.bookingId, ...params.metadata },
  });
  return { id: pi.id, clientSecret: pi.client_secret, status: pi.status };
}

export async function capturePaymentIntent(id: string): Promise<string> {
  return (await stripe().paymentIntents.capture(id)).status;
}

export async function cancelPaymentIntent(id: string): Promise<string> {
  return (await stripe().paymentIntents.cancel(id)).status;
}

/** Pay the traveller their contribution from the platform balance (dropoff). */
export async function createTransfer(params: {
  amountPennies: number;
  destinationAccountId: string;
  bookingId: string;
}): Promise<string> {
  const t = await stripe().transfers.create({
    amount: params.amountPennies,
    currency: 'gbp',
    destination: params.destinationAccountId,
    metadata: { booking_id: params.bookingId },
  });
  return t.id;
}

export async function refundPaymentIntent(id: string): Promise<string | null> {
  return (await stripe().refunds.create({ payment_intent: id })).status;
}

export function constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
  return stripe().webhooks.constructEvent(payload, signature, config.stripeWebhookSecret);
}
