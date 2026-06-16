# Secret Rotation Runbook (PBD-65)

The GitHub PAT, Jira API token, and Stripe key were shared in plaintext during
setup, so they should be rotated. Secrets never live in the repo — they live in
`~/.pbuddy-secrets.env`, `~/.pbuddy-git-credentials`, `api/.env` (all gitignored),
and Google Secret Manager.

Process per credential: **you** revoke + create the new value in that service's
dashboard, then I update the local file / Secret Manager and redeploy. Don't paste
the new secret into chat — put it in the file yourself (commands below), or tell me
and I'll prompt for where it goes.

---

## 1. GitHub Personal Access Token

1. You: https://github.com/settings/tokens → revoke the old token → generate a new
   one (scope: `repo`).
2. You: update the stored credentials (kept outside the repo):
   ```bash
   # ~/.pbuddy-git-credentials  -> https://khanwaseemraza:<NEW_PAT>@github.com
   # ~/.pbuddy-secrets.env       -> export GH_TOKEN=<NEW_PAT>
   ```
3. Verify: `git -C ~/claude/pbuddy fetch` succeeds (no auth prompt).

## 2. Jira API token

1. You: https://id.atlassian.com/manage-profile/security/api-tokens → revoke old →
   create new.
2. You: update `~/.pbuddy-secrets.env` → `export JIRA_TOKEN=<NEW_TOKEN>`.
3. Verify (I can run): `source ~/.pbuddy-secrets.env && python3 tools/jira_sync.py`
   re-syncs without auth errors.

## 3. Stripe key (test mode)

1. You: Stripe Dashboard → Developers → API keys → roll the restricted test key
   (`rk_test_…`). (Webhook signing secret `STRIPE_WEBHOOK_SECRET` is separate and
   already in Secret Manager; only roll it if you recreate the webhook endpoint.)
2. You: update `api/.env` → `STRIPE_SECRET_KEY=<NEW_KEY>` (local dev).
3. I run (prod): add a new Secret Manager version + redeploy:
   ```bash
   printf '%s' "<NEW_KEY>" | gcloud secrets versions add STRIPE_SECRET_KEY --data-file=-
   gcloud builds submit --config infra/cloudbuild.yaml --region=europe-west2 .
   ```
4. Verify: API `/readyz` 200; a Stripe call (e.g. Connect onboarding) works in test mode.

---

## After rotation
- Confirm the OLD values no longer authenticate (try an API call with the old token → 401).
- This file lists *where* each secret lives, never the values themselves.
- Least privilege: the runtime SA `pbuddy-run@` only has Cloud SQL client, Firestore,
  and accessor on `DATABASE_URL` / `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`.
