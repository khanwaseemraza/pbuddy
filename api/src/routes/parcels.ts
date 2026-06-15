// Parcels: a sender posts a listing. Enforces the domestic-only guardrail
// (corridor allowlist + GB postcode validation via postcodes.io), the value and
// National Rail dimension/luggage caps, and captures real lat/lng for maps and
// matching proximity. Writes ROUTE_VALIDATED + PROHIBITED_ITEMS_ATTESTED audit.
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.ts';
import { authenticate, requireKyc } from '../middleware/auth.ts';
import { writeAudit } from '../lib/audit.ts';
import { lookupPostcode } from '../lib/postcodes.ts';
import { haversineKm } from '../services/matching.ts';
import { deriveSizeBand, suggestContribution } from '../services/pricing.ts';

// Categories explicitly disallowed (mirrors the prohibited-items declaration).
const PROHIBITED_CATEGORIES = new Set([
  'drugs', 'weapons', 'ammunition', 'cash', 'stolen_goods',
  'hazardous', 'perishable', 'livestock',
]);

interface Address { postcode: string; address_line: string }
interface CreateParcelBody {
  corridor_id: string;
  direction: 'outbound' | 'return';
  title: string;
  description?: string;
  category: string;
  photo_urls?: string[];
  pickup: Address;
  dropoff: Address;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  weight_g: number;
  piece_count?: number;
  declared_value_pennies: number;
  pricing_mode?: 'fixed' | 'auction';
  suggested_contribution_pennies?: number;
  max_contribution_pennies: number;
  pickup_window_start: string;
  pickup_window_end: string;
  dropoff_window_start?: string;
  dropoff_window_end?: string;
  prohibited_items_ack: boolean;
}

export async function parcelRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateParcelBody }>(
    '/parcels',
    { preHandler: [authenticate, requireKyc] },
    async (req, reply) => {
      const user = req.user!;
      const b = req.body;

      if (!b.prohibited_items_ack) {
        return reply.code(400).send({ error: 'prohibited_items_ack_required' });
      }
      if (PROHIBITED_CATEGORIES.has(b.category)) {
        return reply.code(400).send({ error: 'prohibited_category', category: b.category });
      }

      // Corridor allowlist (domestic-only).
      const { rows: crows } = await pool.query(
        `SELECT id FROM corridors WHERE id = $1 AND is_active = true`,
        [b.corridor_id],
      );
      if (!crows[0]) return reply.code(400).send({ error: 'unknown_or_inactive_corridor' });

      // Compliance caps.
      const cfg = (await pool.query(
        `SELECT max_declared_value_pennies, max_dimension_cm, max_luggage_pieces
           FROM compliance_config WHERE id = 1`,
      )).rows[0];
      if (b.declared_value_pennies > cfg.max_declared_value_pennies) {
        return reply.code(400).send({
          error: 'declared_value_over_cap',
          max_declared_value_pennies: cfg.max_declared_value_pennies,
        });
      }
      const dim = Math.max(b.length_cm, b.width_cm, b.height_cm);
      if (dim > cfg.max_dimension_cm) {
        return reply.code(400).send({ error: 'dimension_over_limit', max_dimension_cm: cfg.max_dimension_cm });
      }
      const pieces = b.piece_count ?? 1;
      if (pieces < 1 || pieces > cfg.max_luggage_pieces) {
        return reply.code(400).send({ error: 'piece_count_out_of_range', max: cfg.max_luggage_pieces });
      }
      if (!Number.isInteger(b.max_contribution_pennies) || b.max_contribution_pennies <= 0) {
        return reply.code(400).send({ error: 'invalid_max_contribution' });
      }

      // GB postcode validation + geocoding for both ends (domestic-only).
      const [pickup, dropoff] = await Promise.all([
        lookupPostcode(b.pickup.postcode),
        lookupPostcode(b.dropoff.postcode),
      ]);
      if (!pickup.valid || !dropoff.valid) {
        await writeAudit({
          eventType: 'ROUTE_VALIDATED',
          userId: user.id,
          payload: { ok: false, pickup, dropoff },
        });
        return reply.code(400).send({
          error: 'invalid_address',
          pickup: pickup.valid ? 'ok' : pickup.reason,
          dropoff: dropoff.valid ? 'ok' : dropoff.reason,
        });
      }

      const pricingMode = b.pricing_mode ?? 'fixed';
      // Fixed price: max_contribution is the price and is set immediately.
      const contributionAmount = pricingMode === 'fixed' ? b.max_contribution_pennies : null;

      // Auto-fill a suggested contribution if the sender didn't set one, using the
      // real geocoded distance and derived size band, clamped to the sender's max.
      const suggested = b.suggested_contribution_pennies ?? suggestContribution(
        deriveSizeBand(dim),
        haversineKm(pickup.lat!, pickup.lng!, dropoff.lat!, dropoff.lng!),
        b.max_contribution_pennies,
      );

      const { rows } = await pool.query(
        `INSERT INTO parcels (
            sender_id, corridor_id, direction, title, description, category, photo_urls,
            pickup_postcode, pickup_address_line, pickup_lat, pickup_lng,
            dropoff_postcode, dropoff_address_line, dropoff_lat, dropoff_lng,
            length_cm, width_cm, height_cm, weight_g, piece_count, declared_value_pennies,
            pricing_mode, suggested_contribution_pennies, max_contribution_pennies,
            contribution_amount_pennies, pickup_window_start, pickup_window_end,
            dropoff_window_start, dropoff_window_end)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
                 $22,$23,$24,$25,$26,$27,$28,$29)
         RETURNING id, status, pricing_mode, contribution_amount_pennies,
                   pickup_postcode, dropoff_postcode`,
        [
          user.id, b.corridor_id, b.direction, b.title, b.description ?? null, b.category,
          JSON.stringify(b.photo_urls ?? []),
          pickup.postcode, b.pickup.address_line, pickup.lat, pickup.lng,
          dropoff.postcode, b.dropoff.address_line, dropoff.lat, dropoff.lng,
          b.length_cm, b.width_cm, b.height_cm, b.weight_g, pieces, b.declared_value_pennies,
          pricingMode, suggested, b.max_contribution_pennies,
          contributionAmount, b.pickup_window_start, b.pickup_window_end,
          b.dropoff_window_start ?? null, b.dropoff_window_end ?? null,
        ],
      );
      const parcel = rows[0];
      if (!user.is_sender) {
        await pool.query(`UPDATE users SET is_sender = true WHERE id = $1`, [user.id]);
      }
      await writeAudit({
        eventType: 'ROUTE_VALIDATED',
        userId: user.id,
        parcelId: parcel.id,
        payload: { ok: true, pickup: pickup.postcode, dropoff: dropoff.postcode, country: pickup.country },
      });
      await writeAudit({
        eventType: 'PROHIBITED_ITEMS_ATTESTED',
        userId: user.id,
        parcelId: parcel.id,
        payload: { category: b.category, declaration_version: 1 },
      });
      return reply.code(201).send(parcel);
    },
  );

  // ---- Sender: list my parcels (with live bid counts) ----
  app.get('/parcels', { preHandler: [authenticate] }, async (req) => {
    const { rows } = await pool.query(
      `SELECT p.id, p.title, p.status, p.direction, c.display_name AS corridor,
              p.pickup_postcode, p.dropoff_postcode, p.pricing_mode,
              p.suggested_contribution_pennies, p.max_contribution_pennies,
              p.contribution_amount_pennies, p.created_at,
              count(b.id) FILTER (WHERE b.status = 'pending') AS pending_bids
         FROM parcels p
         JOIN corridors c ON c.id = p.corridor_id
         LEFT JOIN bids b ON b.parcel_id = p.id
        WHERE p.sender_id = $1
        GROUP BY p.id, c.display_name
        ORDER BY p.created_at DESC`,
      [req.user!.id],
    );
    return { parcels: rows };
  });

  // ---- Sender: view pending bids on my parcel ----
  app.get<{ Params: { id: string } }>(
    '/parcels/:id/bids',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const owner = await pool.query('SELECT sender_id FROM parcels WHERE id = $1', [req.params.id]);
      if (!owner.rows[0]) return reply.code(404).send({ error: 'parcel_not_found' });
      if (owner.rows[0].sender_id !== req.user!.id) {
        return reply.code(403).send({ error: 'not_your_parcel' });
      }
      const { rows } = await pool.query(
        `SELECT b.id, b.bid_contribution_pennies, b.bid_pieces, b.status, b.expires_at,
                u.full_name AS traveller_name, u.trust_score, u.rating_count,
                t.transport_mode, t.depart_at
           FROM bids b
           JOIN users u ON u.id = b.traveler_id
           JOIN trips t ON t.id = b.trip_id
          WHERE b.parcel_id = $1 AND b.status = 'pending'
          ORDER BY b.bid_contribution_pennies ASC, u.trust_score DESC`,
        [req.params.id],
      );
      return { bids: rows };
    },
  );
}
