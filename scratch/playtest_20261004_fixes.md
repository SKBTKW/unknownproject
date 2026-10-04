# 2026-10-04 playtest corrections

Base: AoT261002 `d86b26536777e4aba9b4f2a12ea77b2a1b11fd08`.
Task: `aot-task/AoT261002/first-run/playtest-ui-fixes-v1`.

## Classification and scope

- A: Board route clicks did not acknowledge ROUTE_INTRO. The UI input bridge now acknowledges the existing lesson before legal interception selection. Route endpoints can select the route; illegal interception targets remain illegal. Domain tutorial policy is unchanged.
- B: Mixed-terrain LAND cards are Stage2+ in both JSON and generated masters.
- B: Granary Offering is frozen through an authored `offeringDisabled` gate, including fallback candidate pools. Existing held cards, facilities and saves retain execution compatibility.
- E: Special Block entities have a gray 2D cell and a marker; hover reads canonical production and functional storage-capacity facts. The 2.5D surface uses the same gray. No production rule changes.
- E: LAND card output is explicitly labelled total output; its existing sum resolver is reused.
- E: The Trial Action Tray input and budget/review/result displays use combat power from the existing resolver. A strategic stock of 23 becomes 115 at the current conversion rate. The slider step is 5; this does not create 115 independent allocation choices. Domain reservations, costs and save data remain strategic units. Finer allocation granularity is undecided.
- C: The certification's fixed ten-unit allocation loses on the changed seeded board (real FAILED / EMBER_DEPLETED outcome). The success-path certification now commits available defense, retaining one unit per other route. It does not bypass Battle or failure handling.
- D: The old economy audit assumed self-sufficiency from Verse4. The changed pool includes opening deficits covered by stock. The audit now checks affordability at every settlement and self-sufficiency before Trial1; it does not alter production or maintenance.

## Offering weights (unchanged)

| LAND | Rarity | Base weight | Minimum Stage |
| --- | --- | --- | --- |
| Plains 1x1 | C | 1.20 | 1 |
| Forest 1x1 | C | 1.00 | 1 |
| Deep forest 1x1 | R | 0.15 | 1 |
| Desert 1x1 | R | 0.15 | 1 |
| Mixed plains/hill | R | 0.08 | 2 |
| Mixed plains/forest | R | 0.08 | 2 |
| Mixed hill/mountain | R | 0.05 | 2 |

Weights are relative to eligible candidates, not percentages. Rarity is not an additional weight multiplier. Directive/category bias and GE tag multipliers can change weights. LAND_STANDARD cooldown is one turn regardless of rarity; candidate shortage fallback can relax cooldown. No weight/cooldown balance changes were made.

## Verification boundaries

The new regression exercises production Farm card execution, overlay and expansion production, actual 2D rendering/tooltip methods, Offering exclusion including fallback, mixed LAND total output, and combat input conversion. Existing Farm/Sawmill domain tests cover dynamic yields, grain, capacity and restore.

Local browser navigation was blocked with `net::ERR_BLOCKED_BY_CLIENT` at `http://127.0.0.1:8765/game/`. The unpublished task cannot be visually certified on the public deployment. DOM method tests are not real-browser validation.
