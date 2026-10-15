# Stage1 baseline economy — trial setup (2026-10-13)

Baseline constants: `game/src/core/baseline_economy.js`.

Status: [TRIAL] — values are not final balance decisions.

## Chosen setup
- HQ: minimum survival base; Stage1 production remains 🌾5 / 🧱5 / 🛡️5 / ✨1.
- Initial balances: 🌾50 / 🧱50; 🔥 and ✨ unchanged.
- Base storage: 🌾200 / 🧱200. Facility storage bonuses remain additive.
- No automatic HQ production increase on Stage2 board expansion; retain existing HQ production in Stage2/3.
- UI resource breakdown must read HQ contribution from the runtime breakdown, not hardcode values.

## Stage1 expenditure audit before tuning
1. Verse maintenance: measure gross 🌾 production, food upkeep, and net balance over Verse1–15 in actual FirstRun runs. Confirm how 🔥 thresholds change upkeep.
2. Spending choices: record available/affordable Offering choices and costs per verse. Specifically test early paid cards (e.g. farm: 🧱30) with initial 🧱50; a purchase leaves only 20 materials.
3. Ember land-placement costs: record per-placement 🔥 charges separately from food/material expenditure. Keep these outside the food/material storage comparison.
4. Investigation and facilities: count required vs optional expenses, including post-Verse7 investigation.
5. Trial1: relative defense deployment policy charges >=80% of each available 🌾/🧱 balance immediately before deployment. This is distinct from pre-trial spending; assert payment can commit atomically after plausible opening choices.
6. Stage transition: confirm no resource or HQ-production jump at 5x5→7x7, and that production/tooltip stay consistent after Restore.

## Validation (2026-10-15)

Focused checks passed: Domain 328/328; FirstRun completion 24/24; facility storage/overflow/restore; seeded Stage2/3 HQ retention and tooltip breakdown parity. Full Inspection remains the publication gate. Browser pixel/layout verification has not been performed.

## Required regression coverage
- Fresh GameState begins with food=50, wood/material=50.
- Storage cap=200/200 with overflow clamped and facility bonuses preserved.
- HQ on fresh grid yields 5/5/5/1 and keeps that yield after Stage2 expansion.
- Header and tooltip HQ breakdown match computed values on Stage1 and Stage2.
- FirstRun Verse1–15 and Trial1→Stage2 seeded run; monitor failed affordability and resource starvation; ensure Trial defense allocation remains usable.
- Existing first-run Trial1 80% cost policy tests must be rerun with 200 maximum holdings rather than just earlier 150-cap examples.

Do not tune costs or cardinal Offering rules solely from this document; compare real run traces first.
