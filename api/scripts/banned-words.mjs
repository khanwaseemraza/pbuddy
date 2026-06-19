// Framing + positioning integrity lint. PBuddy's legal defence depends on the
// copy: a contribution is never a "fee/earnings/wage", and the product must read
// as a MARKETPLACE that matches journeys — never a courier/logistics company that
// employs drivers or carries parcels itself. The wrong headline can hand a
// tribunal (worker status) or a transport operator (inducement of breach) their
// argument, so this is enforced in CI across the API and the app.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repo = join(__dirname, '..', '..');

// Roots that contain user-facing strings.
const ROOTS = [
  join(repo, 'api', 'src'),
  join(repo, 'app', 'app'),
  join(repo, 'app', 'src'),
];

// Banned when describing the traveller's contribution (cost-sharing framing).
const FRAMING = [/\bdelivery fee\b/i, /\bearn(?:s|ed|ing|ings)?\b/i, /\bwages?\b/i, /\bsalary\b/i, /\bincome\b/i];

// Banned positioning — affirmative courier/logistics/labour/carriage language.
// Phrased to catch the dangerous usage, NOT legitimate negations like
// "never a courier fee" or "cost-sharing parcel delivery".
const POSITIONING = [
  /\bour couriers?\b/i,
  /\bour drivers?\b/i,
  /\bdelivery fleet\b/i,
  /\bwe deliver\b/i,
  /\bbecome a [a-z ]*?(driver|courier)\b/i,
  /\bjoin (our|the) [a-z ]*?(fleet|drivers?|couriers?)\b/i,
  /\bguaranteed delivery\b/i,
  /\bfully insured\b/i,
  /\bdeliver(?:ed|y)? (?:by|on) (?:train|the train|tube|bus|coach|your commute)\b/i,
  /\b(?:send|sending)\b[a-z ]*?\b(?:by|on)\b[a-z ]*?\b(?:train|the train|tube|bus|coach|commute)\b/i,
];

const BANNED = [...FRAMING, ...POSITIONING];

// Internal revenue terms that are legitimately PBuddy's (not the contribution).
const ALLOW = [/platform_fee/i, /escrow_fee/i, /platformFee/i, /escrowFee/i];

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'ios' || name === 'android' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

let violations = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      // Skip comment lines — the lint polices user-facing strings, not internal prose.
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      if (ALLOW.some((a) => a.test(line))) return;
      for (const re of BANNED) {
        if (re.test(line)) {
          console.error(`framing/positioning violation ${file}:${i + 1}  ${line.trim()}`);
          violations++;
        }
      }
    });
  }
}

if (violations > 0) {
  console.error(`\n${violations} violation(s). Market the connection + the journey — never the labour or the carriage; a contribution is not a fee/earnings.`);
  process.exit(1);
}
console.log('framing + positioning lint clean');
