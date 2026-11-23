# Preview-then-approve (draft mode)

## Flag

`PAYDISK_CALC_DRAFT=true` in `.env.local` / `.env.example`

When on:

1. Calculate → `Calculate*_Draft` → `PayedContinusPayment_Draft` / `PayedMakeOvers_Draft`
2. Report / list / Sheba / IBN → read draft until promote (then live)
3. Approve → `Promote*Draft` → live `Payed*` (+ IT sync) → Ky/Key2/diskette; **draft kept** for compare
4. Post-pay: **مقایسه پیش‌نویس ↔ درج‌شده در DB** (`action=compare-draft`)
5. Cancel / next Calculate*_Draft → clear draft

Live `Calculate*` SPs are **unchanged** (Armaghan / non-flag path).

## Lab A/B (2026-11-23)

See `ab-draft-promote.json` — Emdad + Marakez draft+promote **MATCH** source totals.

## Deploy

- Lab: `node scripts/deploy-draft-calcs-lab.mjs`
- Prod 155: `node scripts/deploy-draft-calcs-prod.mjs` (write login DDL)
- SQL source: `DRAFT_SCHEMA_AND_SPS_LAB.sql`

## Plans

`plans/draft-plans-summary.json` — emdad source seeks; yarane has some scans (Person/Center joins).
