// Auth middleware: verify the Firebase ID token on every request and resolve it
// to a PBuddy user. This is the security gate that replaces Supabase RLS — the
// client never reaches the DB directly, and every handler scopes by req.user.id.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { pool } from '../db.ts';
import { config } from '../config.ts';
import { verifyIdToken } from '../lib/firebase.ts';

export interface AuthUser {
  id: string;
  firebase_uid: string;
  tier: 'casual_buddy' | 'pro_buddy';
  immigration_class: 'uk_citizen_settled' | 'student_visa' | 'other_visa' | 'undeclared';
  kyc_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  rtw_status: 'not_started' | 'pending' | 'verified' | 'rejected';
  is_sender: boolean;
  is_traveler: boolean;
}

export interface AuthToken {
  uid: string;
  phoneNumber?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthToken;
    user?: AuthUser;
  }
}

/**
 * Verify the Firebase ID token and set req.auth. Does NOT require a provisioned
 * user — used by the provisioning endpoint (POST /users/me) which runs before the
 * user row exists.
 */
export async function verifyToken(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'missing_bearer_token' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    req.auth = await verifyIdToken(token);
  } catch {
    reply.code(401).send({ error: 'invalid_token' });
  }
}

/** Verify the token AND resolve it to a provisioned PBuddy user (req.user). */
export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await verifyToken(req, reply);
  if (reply.sent || !req.auth) return;

  const { rows } = await pool.query<AuthUser>(
    `SELECT id, firebase_uid, tier, immigration_class, kyc_status, rtw_status,
            is_sender, is_traveler
       FROM users WHERE firebase_uid = $1`,
    [req.auth.uid],
  );
  const user = rows[0];
  if (!user) {
    reply.code(403).send({ error: 'user_not_provisioned' });
    return;
  }
  req.user = user;
}

/** Guard: require a KYC-verified user. */
export function requireKyc(req: FastifyRequest, reply: FastifyReply, done: () => void): void {
  if (req.user?.kyc_status !== 'verified') {
    reply.code(403).send({ error: 'kyc_required' });
    return;
  }
  done();
}

/** Guard: require an admin (Firebase UID on the configured allowlist). */
export function requireAdmin(req: FastifyRequest, reply: FastifyReply, done: () => void): void {
  if (!req.user || !config.adminUids.includes(req.user.firebase_uid)) {
    reply.code(403).send({ error: 'admin_required' });
    return;
  }
  done();
}
