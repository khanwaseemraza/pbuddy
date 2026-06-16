// Cloud Logging-friendly pino config. Cloud Run captures stdout JSON and parses
// it into structured entries; we:
//   - map pino's level to Cloud Logging `severity` (so ERROR/CRITICAL entries
//     are classified correctly and feed Cloud Error Reporting),
//   - correlate each request to its Cloud Trace id (X-Cloud-Trace-Context),
//   - redact credentials so bearer tokens / signatures never reach the logs.
import { randomUUID } from 'node:crypto';
import type { FastifyServerOptions, FastifyRequest } from 'fastify';

const PINO_TO_SEVERITY: Record<string, string> = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
};

/** Map a pino level label to a Cloud Logging severity. */
export function pinoSeverity(label: string): string {
  return PINO_TO_SEVERITY[label] ?? 'DEFAULT';
}

/** Pino options that make Fastify logs Cloud Logging / Error Reporting friendly. */
export function loggerOptions(): FastifyServerOptions['logger'] {
  return {
    messageKey: 'message',
    formatters: {
      level: (label: string) => ({ severity: pinoSeverity(label) }),
    },
    // Strip secrets from request logs entirely.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["stripe-signature"]',
      ],
      remove: true,
    },
  };
}

/** Use the Cloud Trace id as the request id so logs correlate to a trace. */
export function genReqId(req: FastifyRequest['raw'] & { headers: Record<string, unknown> }): string {
  const trace = req.headers['x-cloud-trace-context'];
  if (typeof trace === 'string' && trace.length > 0) return trace.split('/')[0] ?? trace;
  return randomUUID();
}
