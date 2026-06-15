// Price-suggestion endpoint. Surfaces a fair contribution for the sender's
// post-parcel form before bidding liquidity exists.
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.ts';
import { deriveSizeBand, suggestContribution, type SizeBand } from '../services/pricing.ts';
import { haversineKm } from '../services/matching.ts';
import { lookupPostcode } from '../lib/postcodes.ts';

interface Query {
  size_band?: SizeBand;
  max_dimension_cm?: string;
  distance_km?: string;
  pickup_postcode?: string;
  dropoff_postcode?: string;
}

export async function pricingRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: Query }>(
    '/price-suggestion',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const q = req.query;
      const sizeBand: SizeBand = q.size_band
        ? q.size_band
        : q.max_dimension_cm
          ? deriveSizeBand(Number(q.max_dimension_cm))
          : 'M';
      if (!['S', 'M', 'L'].includes(sizeBand)) {
        return reply.code(400).send({ error: 'invalid_size_band' });
      }

      // Distance from explicit km, or derived by geocoding both postcodes.
      let distanceKm: number;
      if (q.distance_km !== undefined) {
        distanceKm = Number(q.distance_km);
      } else if (q.pickup_postcode && q.dropoff_postcode) {
        const [p, d] = await Promise.all([
          lookupPostcode(q.pickup_postcode),
          lookupPostcode(q.dropoff_postcode),
        ]);
        if (!p.valid || !d.valid) return reply.code(400).send({ error: 'invalid_address' });
        distanceKm = haversineKm(p.lat!, p.lng!, d.lat!, d.lng!);
      } else {
        return reply.code(400).send({ error: 'distance_km_or_postcodes_required' });
      }
      if (!Number.isFinite(distanceKm) || distanceKm < 0) {
        return reply.code(400).send({ error: 'invalid_distance' });
      }

      return {
        size_band: sizeBand,
        distance_km: Math.round(distanceKm),
        suggested_contribution_pennies: suggestContribution(sizeBand, distanceKm),
      };
    },
  );
}
