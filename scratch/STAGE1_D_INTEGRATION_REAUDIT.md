# Stage1 D Integration Re-audit — AoT260924

Target: `AoT260924`
Audit branch: `aot-task/AoT260924/integration/stage1-e2e-reaudit-d-r2`
Target HEAD at refresh: `b4002b928909596113e63d8cce026494949b4150`

## Canonical runtime status

The current target contains both:
- `scratch/test_stage1_e2e.mjs`
- `scratch/test_stage1_canonical_runtime_path.mjs`

The canonicality guard requires the Stage1 E2E to use public runtime boundaries and forbids direct authority mutation for Stage/Trial/Warning/Enemy progression.

Current E2E coverage includes:
- Verse1 real LAND Offering / placement
- Verse7 traces / OMEN
- Investigation unlock / Verse8 guarantee
- real Investigation -> KnownEnemyState -> WATCH
- TENSE / IMMINENT
- Verse15 Trial1 due
- positive Enemy Truth / route / ingress
- Trial launch
- interception / defense planning / activation
- production Trial Deployment Economy composition
- real deployment preview / affordability
- positive Food/Material sink
- committed preview/payment equality
- Food / Material / Defense write-through exactly once
- battle / traversal / HQ damage where applicable
- Trial completion / settlement
- Post-Trial interlude / Stage prelude
- Stage2 / 7x7
- Trial session release
- normal Offering restoration

Latest recorded merged evidence remains:
- Stage1 E2E: **119 PASS / 0 FAIL**
- Full Inspection #1002: **SUCCESS**

## Runtime completion gate

- unresolved BLOCKER: **0**
- unresolved runtime integration HIGH: **0**
- canonical runtime path: **GREEN**

## Remaining final-certification HIGHs

### #251 — first-wave board-investment cards

Status: **OPEN / HIGH**

Current owner progress on target:
- Granary gameplay v1 merged in #283
- Wetland Reclamation Board terrain-transform foundation merged in #286
- Zone Conversion production-modifier foundation merged in #274
- Special Block creation-cost authority exists on current target, but historical PR #267 itself was closed unmerged; target behavior, not PR number, is authoritative
- Logging Camp product implementation remains incomplete
- Wetland Reclamation still needs card-domain migration
- Granary still needs final cost-authority normalization / maintenance-boundary closure
- Agricultural Reform still needs canonical definition + production registration + card migration

Until representative paid board investments are actually executable in the intended FirstRun flow, the real Verse14/15 residual-resource envelope is not established.

### #250 — FirstRun relative resource-burden policy

Status: **OPEN / HIGH**

Blocked on the real residual-resource envelope from #251.

Do not tune Deployment against land-only/no-sink accumulation.

### #208 — final Deployment Economy balance closure

Status: **OPEN / HIGH**

Runtime integration is already green.

This issue now remains only as the final balance-composition gate after #251 and #250 are resolved, followed by another green canonical Stage1 E2E / Full Inspection run.

## D-owner boundary

D must not implement:
- board-investment card gameplay
- creation costs / facility values
- relative burden coefficients
- Trial deployment balance values

D resumes active execution when owner work changes the real Stage1 spend path. At that point:
1. sync to latest AoT260924
2. run canonical Stage1 E2E
3. run Full Inspection
4. verify no runtime regression
5. verify real pre-Trial residual snapshot
6. verify Deployment preview/commit against that residual
7. update #251/#250/#208 closure status
8. certify Stage1 only when unresolved BLOCKER = 0 and unresolved HIGH = 0

## Current verdict

**Stage1 canonical runtime is functionally GREEN. Final Stage1 certification is NOT READY because balance-side HIGH dependencies remain open.**
