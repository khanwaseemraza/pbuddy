# PBuddy — Legal pack

This directory is the **canonical, version-controlled source of truth** for every
legal document PBuddy publishes. The database (`legal_copy`) and the app render
*copies* of these texts; when a document changes here, a new numbered version is
seeded into `legal_copy` (migration) and the bundle version is bumped so each
user's acceptance remains provable.

## Status

These documents are an **in-house drafted "best-possible" pack**, written to be
binding and launch-ready *and* to make outside review fast and cheap. They are
**not yet signed off by a practising, SRA-regulated solicitor**. See
[`LEGAL-ADVISOR-MEMO.md`](LEGAL-ADVISOR-MEMO.md) for the reasoning, the residual
risk register, and exactly which clauses a solicitor must confirm before launch.

## The documents

| File | `legal_copy` key | Audience | Purpose |
|---|---|---|---|
| [terms-of-service.md](terms-of-service.md) | `terms` | Everyone | The master contract between each user and PBuddy. |
| [carrier-agreement.md](carrier-agreement.md) | `carrier_agreement` | Buddies who carry | Self-employment substance, substitution right, right to refuse, RTW. |
| [liability-policy.md](liability-policy.md) | `liability_policy` | Everyone | The two-layer liability model (statutory floor + voluntary goodwill). |
| [optional-insurance.md](optional-insurance.md) | `insurance_optional` | Senders | What the optional parcel cover is — and is not. |
| [prohibited-items.md](prohibited-items.md) | `prohibited_items` | Everyone | What can never be sent. |
| [privacy-policy.md](privacy-policy.md) | `privacy` | Everyone | UK GDPR / DPA 2018 processing notice. |
| [cost-sharing-explainer.md](cost-sharing-explainer.md) | `cost_sharing.explainer` | Everyone | Plain-English "why a contribution is not a fee". |
| [green-claims-methodology.md](green-claims-methodology.md) | `green_claims` | Internal + public | CMA Green Claims Code substantiation for any environmental claim. |

## How a change reaches users

1. Edit the markdown file here.
2. Add a migration that inserts the new `(key, version, body)` row and sets the
   previous version `is_active = false`.
3. Bump `LEGAL_BUNDLE_VERSION` so the consent screen re-prompts and the new
   acceptance is recorded against the new version (`users.legal_version`).

Nothing in the product hardcodes legal/framing strings — the UI references a
`legal_copy` key so wording stays consistent and auditable over time.
