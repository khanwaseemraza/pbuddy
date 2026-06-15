// Framing integrity lint. The cost-sharing safe harbour depends on never calling
// a contribution a "fee"/"earnings"/"wage"/etc. on the user-facing path. This
// fails CI if any banned term appears in source (outside of allowlisted internal
// names like platform_fee/escrow_fee, which are PBuddy's own revenue, not the
// traveller's contribution).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', 'src');

// Banned when describing the traveller's contribution. Word-boundary matched.
const BANNED = [/\bdelivery fee\b/i, /\bearnings?\b/i, /\bwages?\b/i, /\bsalary\b/i, /\bincome\b/i];

// Internal revenue terms that are legitimately PBuddy's (not the contribution).
const ALLOW = [/platform_fee/i, /escrow_fee/i, /platformFee/i, /escrowFee/i];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

let violations = 0;
for (const file of walk(root)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // Skip comment lines — the lint polices user-facing strings, not internal
    // prose. (The Pro Buddy tier legitimately describes "earning" in comments.)
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    if (ALLOW.some((a) => a.test(line))) return;
    for (const re of BANNED) {
      if (re.test(line)) {
        console.error(`framing violation ${file}:${i + 1}  ${line.trim()}`);
        violations++;
      }
    }
  });
}

if (violations > 0) {
  console.error(`\n${violations} framing violation(s). Contributions are not fees/earnings.`);
  process.exit(1);
}
console.log('framing lint clean');
