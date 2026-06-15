#!/usr/bin/env python3
"""Idempotent Jira backlog sync for PBuddy (project PBD, team-managed).

Creates/updates Epics and their child Stories with detailed, testable
descriptions and sets their workflow status. Re-running does NOT create
duplicates: every item carries a stable ``code:<WBS>`` label and is upserted by
searching that label first.

Credentials are read from the environment (never hard-coded):

    source ~/.pbuddy-secrets.env   # JIRA_BASE, JIRA_EMAIL, JIRA_TOKEN, JIRA_PROJECT
    python3 tools/jira_sync.py

This file is the single source of truth for the backlog — edit the WBS below and
re-run to keep Jira in sync as the project proceeds.
"""
from __future__ import annotations

import base64
import json
import os
import ssl
import sys
import urllib.error
import urllib.request


def _ssl_context() -> ssl.SSLContext:
    """Build a verifying SSL context with a usable CA bundle.

    The python.org macOS build ships without configured CAs, so fall back through
    certifi -> SSL_CERT_FILE -> the system bundle. Verification stays ON.
    """
    for cafile in (
        os.environ.get("SSL_CERT_FILE"),
        _certifi_path(),
        "/etc/ssl/cert.pem",
    ):
        if cafile and os.path.exists(cafile):
            return ssl.create_default_context(cafile=cafile)
    return ssl.create_default_context()


def _certifi_path() -> str | None:
    try:
        import certifi
        return certifi.where()
    except Exception:
        return None


_SSL = _ssl_context()

BASE = os.environ["JIRA_BASE"].rstrip("/")
EMAIL = os.environ["JIRA_EMAIL"]
TOKEN = os.environ["JIRA_TOKEN"]
PROJECT = os.environ.get("JIRA_PROJECT", "PBD")

IT_EPIC = "10098"
IT_STORY = "10101"

AUTH = "Basic " + base64.b64encode(f"{EMAIL}:{TOKEN}".encode()).decode()


def api(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", AUTH)
    req.add_header("Accept", "application/json")
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, context=_SSL) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} {method} {path}: {e.read().decode()[:500]}", file=sys.stderr)
        raise


# ---------------------------------------------------------------------------
# ADF helpers (Jira Cloud REST v3 needs Atlassian Document Format).
# ---------------------------------------------------------------------------
def _p(text: str) -> dict:
    return {"type": "paragraph", "content": [{"type": "text", "text": text}]}


def _h(text: str, level: int = 3) -> dict:
    return {"type": "heading", "attrs": {"level": level},
            "content": [{"type": "text", "text": text}]}


def _ul(items: list[str]) -> dict:
    return {"type": "bulletList", "content": [
        {"type": "listItem", "content": [_p(i)]} for i in items]}


def adf(item: dict) -> dict:
    content: list[dict] = []
    if item.get("context"):
        content.append(_h("Context"))
        content.append(_p(item["context"]))
    if item.get("ac"):
        content.append(_h("Acceptance criteria (testable)"))
        content.append(_ul(item["ac"]))
    if item.get("verify"):
        content.append(_h("Verification"))
        content.append(_p(item["verify"]))
    if item.get("refs"):
        content.append(_h("References"))
        content.append(_ul(item["refs"]))
    return {"type": "doc", "version": 1, "content": content or [_p("(to be detailed)")]}


# ---------------------------------------------------------------------------
# Upsert + transition.
# ---------------------------------------------------------------------------
def find_by_code(code: str) -> str | None:
    jql = f'project = {PROJECT} AND labels = "code:{code}"'
    res = api("GET", f"/rest/api/3/search/jql?jql={urllib.parse.quote(jql)}&fields=key&maxResults=1")
    issues = res.get("issues", [])
    return issues[0]["key"] if issues else None


def set_status(key: str, target: str) -> None:
    trs = api("GET", f"/rest/api/3/issue/{key}/transitions")["transitions"]
    match = next((t for t in trs if t["to"]["name"].lower() == target.lower()), None)
    if match:
        api("POST", f"/rest/api/3/issue/{key}/transitions", {"transition": {"id": match["id"]}})


def upsert(item: dict, issue_type: str, parent_key: str | None = None) -> str:
    code = item["code"]
    fields: dict = {
        "project": {"key": PROJECT},
        "issuetype": {"id": issue_type},
        "summary": item["summary"],
        "description": adf(item),
        "labels": [f"code:{code}", "auto:pbuddy-plan"] + item.get("labels", []),
    }
    if parent_key:
        fields["parent"] = {"key": parent_key}

    existing = find_by_code(code)
    if existing:
        api("PUT", f"/rest/api/3/issue/{existing}", {"fields": fields})
        key = existing
        action = "updated"
    else:
        key = api("POST", "/rest/api/3/issue", {"fields": fields})["key"]
        action = "created"
    set_status(key, item.get("status", "To Do"))
    print(f"  {action} {key:10} [{item.get('status','To Do'):11}] {item['summary']}")
    return key


import urllib.parse  # noqa: E402  (after helpers, used by find_by_code)

from jira_wbs import EPICS  # noqa: E402


def main() -> None:
    print(f"Syncing {len(EPICS)} epics to {BASE} project {PROJECT}\n")
    for epic in EPICS:
        print(f"EPIC {epic['code']}: {epic['summary']}")
        epic_key = upsert(epic, IT_EPIC)
        for child in epic.get("children", []):
            upsert(child, IT_STORY, parent_key=epic_key)
        print()


if __name__ == "__main__":
    main()
