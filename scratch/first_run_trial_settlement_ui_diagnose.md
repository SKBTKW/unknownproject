# FirstRun Trial Completion → Settlement UI diagnosis

- Classification: A — progression blocked.
- Base: AoT261002 / 0af6f9081cec0e63506ec092aa4c37475943fb12.
- Production browser: Verse1–15 reached with ordinary land placements; Verse8 Investigation consumed successfully. No gameplay state injection or resource boost.
- Defense: 0 → 1 → 22; Final Review → Confirm → Activate (food235/material153) → Battle → Result → Causality acknowledgment → Trial Complete.
- First failure: completed Trial banner has no Settlement action; NEXT verse and normal Offering remain absent. Result is SURVIVED, Ember9, battles1/1.
- Evidence: first-run-trial-settlement-blocker-1790988190765.jpg.
- First broken contract: TrialActionTrayComponent completed-result rendering has no call to the existing TrialResultUIController.settleCurrentTrialResult boundary.
- Domain settlement and TrialResultExitAdapter already exist and pass their diagnosis. Do not alter completion, settlement, damage, reward, persistence or Stage authorities.
- Fix: render a localized result confirmation button only for resultReady/unconsumed settlement, bound to existing UI settlement API.
- Certification correction: canonical E2E now renders the production tray and invokes its actual button handler instead of directly calling Settlement. Before fix both focused rendering test and E2E fail at missing Settlement button; after fix focused31/31, canonical23/0 and Stage1 audit131/0 PASS.
- Browser verification of the corrected build is pending deployment. Deployed build remains blocked; FirstRun Stage1 is not complete.

## Separate findings (outside this P0)

- E: Verse8 Investigation result/narrative is not automatically displayed; Report shows generic zoning report.
- E: Investigation card names/descriptions expose raw translation keys.
- B candidate: undeveloped-board Investigation can return NO_OBSERVABLE_FRAGMENTS (previous task diagnosis); no gameplay workaround introduced.
- F: no new design decision is required for this UI connection.
- G: future gameplay expansion remains frozen.
