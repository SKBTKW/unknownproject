# Enemy Army distribution hypotheses

Seeds: 0..9999 (10000 per model).

Development hypotheses only. No production policy is selected.

| Model | LARGE mean | MEDIUM mean | SMALL mean | LIGHT mean | STANDARD mean | HEAVY mean | Extreme forces | Failures |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 33.45% | 33.28% | 33.27% | 33.36% | 33.46% | 33.17% | 19.89% | 0 |
| B | 17.25% | 69.14% | 13.60% | 19.88% | 48.13% | 31.99% | 9.14% | 0 |
| C | 25.53% | 44.26% | 30.21% | 29.03% | 38.15% | 32.81% | 12.72% | 0 |

Shares are equal-force marginal means, not individual counts. Co-presence does not establish individual correlation.

| Model / force | LARGE mean | MEDIUM mean | SMALL mean | HEAVY present | SMALL and HEAVY co-present |
|---|---:|---:|---:|---:|---:|
| A/A | 33.24% | 33.68% | 33.08% | 65.92% | 57.20% |
| A/B | 33.68% | 33.00% | 33.32% | 66.81% | 58.31% |
| A/C | 33.44% | 33.17% | 33.39% | 66.78% | 57.87% |
| B/A | 17.36% | 69.07% | 13.58% | 79.89% | 72.75% |
| B/B | 17.46% | 69.20% | 13.33% | 80.49% | 73.18% |
| B/C | 16.94% | 69.16% | 13.90% | 79.98% | 72.57% |
| C/A | 35.46% | 41.14% | 23.40% | 83.33% | 69.80% |
| C/B | 17.29% | 69.01% | 13.71% | 80.07% | 73.12% |
| C/C | 23.85% | 22.64% | 53.51% | 49.27% | 49.27% |

Force-level co-presence rates only (NOT individual equipment assignments):

| Model | LARGE + HEAVY | MEDIUM + LIGHT | MEDIUM + STANDARD | MEDIUM + HEAVY | SMALL + HEAVY | 3 species profiles / army | Single species forces | Replay matches |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 57.50% | 57.81% | 57.86% | 57.67% | 57.79% | 43.55% | 19.89% | 10000/10000 |
| B | 72.83% | 39.76% | 80.12% | 80.12% | 72.83% | 11.25% | 9.14% | 10000/10000 |
| C | 63.69% | 53.11% | 66.72% | 65.97% | 64.06% | 84.05% | 12.72% | 10000/10000 |

## Task / scope

Task: `aot-task/AoT261029/trial/enemy-army-generation-policy-validation-v1`.

Base: `bb07111d91d33d13fe7d9d80ca2b5428c4d1f3bf` (PR#471 integrated).

All numbers below are DEVELOPMENT HYPOTHESES, not approved gameplay or production balance. Production Bootstrap, model, Generator, Lifecycle, save/restore, Stage adapter and Trial code are unchanged. Ordinary Runs still have no configured Blueprint generation policy. Trial1 remains suppression20/one force; three generated Blueprint identities are potential forces, not participants.

## Reproduce / output

```powershell
node scratch/diagnose_enemy_army_generation_distribution.mjs --models A,B,C --count 10000 --start 0 --json > $env:TEMP\aot-enemy-distribution-10000.json
node scratch/diagnose_enemy_army_generation_distribution.mjs --models A,B,C --count 10000 --start 0 --markdown
```

The CLI defaults to all3 models, count1000, start0, JSON. Counts are strict integer1..10000; seed start is uint32 and the entire consecutive range must fit. Unknown/duplicate options, malformed numbers, overflow, duplicate/unknown models and conflicting formats fail nonzero. Output contains aggregates and bounded failure examples, not all generated armies. No timestamps, runtime duration or random seed selection affect output. No files are created by the CLI; shell redirection is explicit. Raw reports remain outside Git.

Measurements use0..9999 for each model:10000 armies and30000 potential forces per model. Every army was generated again immediately and compared byte-for-byte. All30000 replay comparisons passed, with0 generation failures,0 replay mismatches,0 replay errors. A second independent whole CLI execution produced identical JSON bytes. SHA256 of both raw JSON files: `9CE765CE12CDF4AC559E944104CD19DB1AFAFC62F78AD423DA541B95E9006309`.

Policy/source identity and generated-stream digests are included in JSON. The summary tables round to2 decimals; complete JSON retains unrounded floating sums. Floating consistency assertions use tolerance rather than falsely expecting decimal sums to be exact binary values.

## Hypothesis definitions

Source: `scratch/enemy_army_distribution_hypotheses_v1.json`. The development loader compiles explicit species-profile and equipment-profile choices into the existing Generator's ordered complete-composition candidates. Candidate weight=species-profile weight times equipment-profile weight; this is a hypothesis catalogue expansion, not a replacement Generator. All expanded policies are validated by the existing exported policy validator.

Species profiles (values are LARGE / MEDIUM / SMALL; missing types are absent):

| Profile | LARGE | MEDIUM | SMALL |
|---|---:|---:|---:|
| large-mixed | .60 | .25 | .15 |
| medium-mixed | .15 | .60 | .25 |
| small-mixed | .25 | .15 | .60 |
| large-only | 1 | 0 | 0 |
| medium-only | 0 | 1 | 0 |
| small-only | 0 | 0 | 1 |
| medium-core | .15 | .75 | .10 |
| large-secondary | .65 | .30 | .05 |
| small-secondary | .05 | .30 | .65 |

Equipment profiles: light-mix=LIGHT.70/STANDARD.30; standard-mix=STANDARD.70/HEAVY.30; heavy-mix=HEAVY.70/LIGHT.30. All are experimental assumptions. No SMALL/HEAVY prohibition exists.

- Model A: every force has species-profile weights large/medium/small-mixed4/4/4 and corresponding pure profiles1/1/1; equipment profile weights1/1/1. This makes equal expected species and gear marginal means, not equal presence counts or independent individual assignments.
- Model B: every force uses medium-core8, large-secondary1, small-secondary1, medium-only1; equipment profile weights light/standard/heavy1/3/1.
- Model C: forceA uses mixed-profile weights4/5/1 and pure weights1/1/.5, with equipment1/2/3. ForceB uses model B. ForceC uses mixed weights1/2/7 plus small-only1, with equipment3/2/1. These force personalities are proposed experimental inputs, not a rule that forceA must be large or forceC must be small.

The resulting catalogues contain54/36/42 complete candidates across all3 slots for models A/B/C respectively. Candidate ordering and policy ID/version are part of reproduction. The existing RNG derives independent streams from RunSeed/Stage/policy identity/version/slot; the same seed set across models does not imply matched uniform draws. There is no alternative RNG or live gameplay stream consumption.

## Interpreting the observed output

A returned mean species share33.45/33.28/33.27 percent, matching its intended equal-marginal baseline within this sample. B returned MEDIUM69.14 percent with little A/B/C variation. C returned forceA LARGE35.46 + MEDIUM41.14, forceB MEDIUM69.01, forceC SMALL53.51 percent. These show the current API can express different per-force marginal tendencies.

Single-species / extreme-share forces were5967/30000 (A,19.89 percent),2742/30000 (B,9.14 percent),3816/30000 (C,12.72 percent). The diagnostic extreme threshold is maximum species share>=.90; in these catalogues it selects exactly the pure-profile candidates. This is not a production invalidity rule or automatic balance judgment.

Armies with3 distinct species-composition profiles: A4355/10000, B1125/10000, C8405/10000. C's higher value is partly induced by intentionally different profile catalogues across slots; it does not establish superior balance or tactical depth. In C no species profile is shared by all3 slot catalogues, so0 identical-profile armies is a design consequence of the hypothesis.

The JSON includes species/equipment presence counts and rates, dominant-species and dominant-equipment histograms (ties explicit), all9 species/equipment force co-presence counts, per-slot tallies, distinct species/equipment/combined-profile histograms, failure rate/examples and replay counters. Presence totals can exceed100 percent because one force can contain several types. Dominance counts sum to the number of forces. Share means sum to1 per axis, with equal weighting per potential force because headcounts/suppression allocations do not exist.

Forces containing SMALL and HEAVY were17338/30000 (A),21850/30000 (B),19219/30000 (C). These are actual FORCE CO-PRESENCE events. They do not mean those small individuals wear heavy equipment; no individual cross-tab is stored. No joint probability is inferred by multiplying marginal shares. Vocabulary/schema violations are detected by the existing model, not by adding gameplay combination bans.

## Existing architecture investigation / limitations

- EnemyArmyBlueprint is immutable and validates Stage1, A/B/C order/IDs, allowed categories and normalized marginal lists. The Generator selects one weighted complete candidate per slot from an independent FNV-1a-derived common RandomSource stream. The diagnostics consume the actual output snapshot and validate it again; no army construction algorithm is duplicated.
- The current API supports finite catalogues of mixed species/equipment marginal profiles and per-slot weights. Arbitrary continuous ratio generation would require caller-provided catalogue expansion or a separately approved Generator feature. Individual pairings, headcounts, commander traits and battlefield effects are unavailable; this task does not invent them.
- Lifecycle holds frozen Stage snapshots. New Run Bootstrap uses only explicitly supplied production policy and remains disabled by default. The Stage adapter does not generate unsupported Stage2/3. None imports this development policy data or analyzer.
- Registry supplemental execution is part of Full Inspection Layer6 and GitHub CI. No existing reusable distribution runner was found by source search. Existing gameplay RNG and Blueprint deterministic tests are retained. This CLI is a diagnostic, not a registered test; its two test modules are registered as supplemental.
- CLI errors reject invalid configuration before generation; unexpected generation/output-validation failures are counted per attempted army, bounded to20 examples. Replay failure is reported separately. Any failure/mismatch causes a nonzero CLI exit, and zero-success rates are null / N/A rather than invented zero-observation success.

## Validation and changed files

- `scratch/enemy_army_distribution_hypotheses_v1.json`: development-only hypothesis data.
- `scratch/enemy_army_generation_distribution.mjs`: catalogue expansion, actual-output aggregation and Markdown formatter.
- `scratch/diagnose_enemy_army_generation_distribution.mjs`: bounded CLI and JSON/Markdown output.
- `scratch/test_enemy_army_generation_distribution.mjs`: deterministic bulk/tally/immutability/non-interference tests.
- `scratch/test_enemy_army_generation_distribution_cli.mjs`: CLI output and malformed/oversized argument tests.
- `scratch/test_registry.json`: supplemental registration.
- This rules document: measured comparison and scope/limits.

Focused results: distribution tests7/7 PASS; CLI tests3/3 PASS.1000-seed comparison tests include share/count/diversity/replay consistency; a separate1000-seed test verifies unchanged held snapshots, input policies, model source and a real Engine's gameplay/check RNG states and EnemyTruth, including suppression20/one force and disabled default policy. Full Inspection and unchanged FirstRun completion remain final gates; real-browser rendering is outside this data-only task.

No model is selected for production. Relative species ratios, force personalities, SMALL/HEAVY treatment, tactical benefits, command roles, Stage2/3 content and suppression distribution remain undecided.
