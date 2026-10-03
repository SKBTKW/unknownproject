# FirstRun Stage1 live production certification

## Scope and verdict

- Phase: 4 — production traversal recertification after PR426.
- Target/build: AoT261002 / 20744b1f2c83c9cf4998c408bae612e1e64664da (visible badge20744b1).
- Live operation path: PASS for this new Run, Verse1 → Stage2 normal Verse16.
- Full FirstRun Completion: NOT YET CERTIFIED. Investigation result/narrative and card translation presentation remain incomplete. Do not equate successful traversal with complete explanatory UX.
- No gameplay changes, mock bypass, engine injection, resource subsidy, forced tutorial step, or external random seed manipulation.

## Observed production path

1. New Run starts Verse1 on5×5, food50/material30/defense5/Ember20.
2. Ordinary legal LAND placements through Verse1–6 prepare economy and defense.
3. Verse7 traces image and Advisor explanation appear; timed Confirm becomes enabled and is acknowledged. UI text explains Investigation unlock.
4. Verse8 INVESTIGATE_FOOTPRINTS is selected through the actual card confirmation modal and activated. Card disappears, Mulligan disables; next Verse remains reachable. Result explanation is not automatically displayed (E).
5. Verse9–14 normal land placement continues. Verse9 has no Investigation card (consistent with scoped guarantee; exhaustive guarantee test is automated).
6. Verse15 Trial1 launches with food492/material285/defense22/Ember14. Route ROUTE_INGRESS_1_4 acknowledged; E2 forest interception selected.
7. Defense0 →1 →22 works; preview favorable. Final Review displays food347/material170. Confirm→Activate pays to food145/material115/defense0.
8. Battle Start→Resolve displays human110→75, enemy100→70. Causality explanation appears and is acknowledged. Traversal repelled; next battle→Trial Complete succeeds.
9. Trial result SURVIVED, Ember14, battle1/1, HQ damage0. Newly connected Confirm Result and Continue button is present and opens Post-Trial.
10. Actual Continue buttons traverse AFTERMATH→ASSESSMENT→TRIAL_MEANING→STAGE_PRELUDE→STAGE_REVEAL→POST_STAGE_COMMENT→CLOSE. Stage prelude still shows Stage1; reveal explicitly shows Stage2, board7×7.
11. Return to board closes interlude. Read-only DOM:49 board cells, body player-tray-mode=normal, Trial Action Tray aria-hidden=true. Route/battle UI is gone.
12. Normal forest card is placed after Stage2 expansion; NEXT verse reaches Verse16 with fresh Offering (grass/hill/farmland reform). Board21/48, food207/material154/defense2/33, Ember12.

Evidence: first-run-stage2-normal-resume-1790992911302.jpg (Stage2 normal Offering and7×7 grid).

## Known issues, classified

- A: no new progression blocker encountered in this observed Run. Prior Defense and Settlement blockers resolved on the visible deployed build.
- B: undeveloped-board NO_OBSERVABLE_FRAGMENTS candidate from earlier Investigation diagnosis remains separately tracked; this developed Run succeeds. Stage1 logging/granary issues remain Phase5 work.
- C: no new syntax/diagnose/registry error observed. Full Inspection gate required separately.
- E: Investigation names/descriptions expose raw keys; report/narrative is not shown automatically. Warning state / KnownEnemy internal changes are not claimed from hidden browser state; automated tests cover their authority.
- F: no new design choice needed for this certification.
- G: future features remain frozen.

## Verification limits

Browser certifies actual inputs, visible transitions and normal play resumption in this single Run. Domain stage.id===2 and persistence/Restore nonduplication are checked by canonical E2E and existing Restore diagnostics; no hidden game state was accessed in browser. Exhaustive different choices/seeds and live reload/Restore were not certified here. FirstRun completion remains pending explanatory UI and remaining final gates.
