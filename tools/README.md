# tools/ — project automation

## Jira backlog sync

The PBuddy backlog (epics + stories) lives as code in [`jira_wbs.py`](jira_wbs.py) and
is pushed to Jira by [`jira_sync.py`](jira_sync.py). This keeps the plan
**reproducible**: edit the WBS, re-run, and Jira matches — no manual ticket
wrangling, no duplicates.

- Project: **PBD** (pBuddy) on `https://pbuddy.atlassian.net`, team-managed.
- Idempotent: every item carries a stable `code:<WBS>` label and is upserted by
  searching that label first. Re-running updates in place.
- Statuses (`To Do` / `In Progress` / `In Review` / `Done`) are applied via
  workflow transitions.

### Run

Credentials are read from the environment — never commit them:

```bash
source ~/.pbuddy-secrets.env   # JIRA_BASE, JIRA_EMAIL, JIRA_TOKEN, JIRA_PROJECT
python3 tools/jira_sync.py
```

`~/.pbuddy-secrets.env` lives **outside** the repo (chmod 600). To recreate it:

```bash
cat > ~/.pbuddy-secrets.env <<'EOF'
export JIRA_BASE='https://pbuddy.atlassian.net'
export JIRA_EMAIL='you@example.com'
export JIRA_TOKEN='<atlassian-api-token>'
export JIRA_PROJECT='PBD'
export GH_TOKEN='<github-pat>'
export GH_REPO='khanwaseemraza/pbuddy'
EOF
chmod 600 ~/.pbuddy-secrets.env
```

### Workflow

As work proceeds: update the relevant item's `status` (and flesh out `ac`/`verify`)
in `jira_wbs.py`, then re-run the sync. Add new stories by appending items with a
fresh `code`. Each story's acceptance criteria are written to be testable so the
build stays verifiable end-to-end.
