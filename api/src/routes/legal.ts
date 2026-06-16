// Public legal documents (PBD-68). Serves the versioned, framing-clean legal
// copy that the app links to and that users consent to at sign-up. Public — no
// auth needed to read the terms before you sign in.
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.ts';

// The user-facing pages (the rest of legal_copy holds inline framing snippets
// used elsewhere in the product). The highest active version of each is served.
export const LEGAL_PAGES = ['terms', 'privacy', 'prohibited_items', 'cost_sharing.explainer'] as const;

export async function legalRoutes(app: FastifyInstance): Promise<void> {
  // List the current legal documents (key + version) — drives the consent screen.
  app.get('/legal', async () => {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (key) key, version
         FROM legal_copy
        WHERE is_active AND key = ANY($1)
        ORDER BY key, version DESC`,
      [LEGAL_PAGES as unknown as string[]],
    );
    return { documents: rows };
  });

  // Fetch one document's active body.
  app.get<{ Params: { key: string } }>('/legal/:key', async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT key, version, body FROM legal_copy
        WHERE is_active AND key = $1 ORDER BY version DESC LIMIT 1`,
      [req.params.key],
    );
    if (!rows[0]) return reply.code(404).send({ error: 'not_found' });
    return rows[0];
  });
}
