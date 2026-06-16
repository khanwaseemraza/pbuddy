import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.ts';
import { loggerOptions, genReqId } from './lib/logging.ts';
import { healthRoutes } from './routes/health.ts';
import { bidRoutes } from './routes/bids.ts';
import { matchingRoutes } from './routes/matching.ts';
import { tripRoutes } from './routes/trips.ts';
import { parcelRoutes } from './routes/parcels.ts';
import { bookingRoutes } from './routes/bookings.ts';
import { pricingRoutes } from './routes/pricing.ts';
import { complianceRoutes } from './routes/compliance.ts';
import { paymentRoutes } from './routes/payments.ts';
import { handoffRoutes } from './routes/handoff.ts';
import { reviewRoutes } from './routes/reviews.ts';
import { kycRoutes } from './routes/kyc.ts';
import { userRoutes } from './routes/users.ts';
import { disputeRoutes } from './routes/disputes.ts';
import { adminRoutes } from './routes/admin.ts';
import { proRoutes } from './routes/pro.ts';

export function buildServer() {
  // trustProxy so req.ip reads the real client from X-Forwarded-For behind
  // Cloud Run's front-end (otherwise every caller looks like the proxy IP and
  // shares one rate-limit bucket). Structured Cloud Logging config + a request
  // id taken from the Cloud Trace header (see lib/logging.ts).
  const app = Fastify({ logger: loggerOptions(), trustProxy: true, genReqId });

  // Re-log unexpected (5xx) errors with their stack as the message so Cloud
  // Error Reporting groups them. Client errors (4xx, 429) are left alone.
  app.addHook('onError', async (req, _reply, err) => {
    if ((err.statusCode ?? 500) >= 500) req.log.error(err.stack ?? err.message);
  });
  // The web app calls the API cross-origin (Firebase Hosting -> Cloud Run). Auth
  // is via Bearer tokens (no cookies), so we just allow the known origins.
  app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  // Abuse / brute-force protection. Bucket per caller: the bearer token when
  // present (≈ per user), else the client IP (covers unauthenticated sign-in
  // traffic). Over the limit -> 429 with a Retry-After header.
  if (config.rateLimitEnabled) {
    app.register(rateLimit, {
      max: config.rateLimitMax,
      timeWindow: config.rateLimitWindowMs,
      keyGenerator: (req) => (req.headers['authorization'] as string | undefined) ?? req.ip,
      errorResponseBuilder: (_req, context) => ({
        statusCode: 429,
        error: 'rate_limited',
        message: `Too many requests — retry in ${Math.ceil(context.ttl / 1000)}s.`,
      }),
    });
  }
  app.register(healthRoutes);
  app.register(tripRoutes);
  app.register(parcelRoutes);
  app.register(bidRoutes);
  app.register(matchingRoutes);
  app.register(bookingRoutes);
  app.register(pricingRoutes);
  app.register(complianceRoutes);
  app.register(paymentRoutes);
  app.register(handoffRoutes);
  app.register(reviewRoutes);
  app.register(kycRoutes);
  app.register(userRoutes);
  app.register(disputeRoutes);
  app.register(adminRoutes);
  app.register(proRoutes);
  return app;
}

// Start only when run directly (not when imported by tests).
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const app = buildServer();
  app
    .listen({ port: config.port, host: '0.0.0.0' })
    .then(() => app.log.info(`PBuddy API listening on :${config.port}`))
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}
