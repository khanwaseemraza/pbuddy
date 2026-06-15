import Fastify from 'fastify';
import { config } from './config.ts';
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

export function buildServer() {
  const app = Fastify({ logger: true });
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
