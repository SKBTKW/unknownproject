# The Age of Trials — Flexible Dice Check Contract

Status: DESIGN CONTRACT / implementation target

This document defines the reusable dice-check boundary for The Age of Trials. It is intentionally not tied to exploration, Trial, or any single card.

## 1. Design principle

Dice checks are composed from independent data layers so future rules can change without rewriting game-specific callers.

```text
DiceSpec
→ DiceRoll
→ ResolutionRule
→ OutcomeTable
→ game-specific effect
```

Presentation is separate from rules:

```text
PresentationHint
→ UI chooses the appropriate animation / layout
```

Core rule:

> The dice mechanism is reusable; the meaning of the result belongs to the caller or the check definition.

## 2. DiceSpec

DiceSpec describes only what is rolled and what is kept.

```js
{
  count: 2,
  sides: 6,
  keep: "all"
}
```

Supported by the existing DicePool contract:

```text
all
highest_N
lowest_N
```

The underlying contract must remain generic enough for examples such as:

```js
{ count: 2,  sides: 6, keep: "all" }
{ count: 5,  sides: 6, keep: "highest_3" }
{ count: 10, sides: 2, keep: "all" }
```

Do not hard-code the gameplay layer to 2D6.

## 3. DiceRoll

A raw roll result preserves factual roll data.

```js
{
  rolled: [2, 6, 4, 1, 5],
  kept: [6, 5, 4],
  dropped: [2, 1]
}
```

Rules and UI may inspect this data, but the roll result itself does not contain exploration-, Trial-, or card-specific effects.

## 4. ResolutionRule

ResolutionRule defines how the kept dice are converted into one scalar resolution value.

Initial target set:

```text
sum
highest
lowest
success_count
```

Examples:

```js
{ type: "sum" }
```

```js
{ type: "highest" }
```

```js
{
  type: "success_count",
  successAt: 5
}
```

For `success_count`, each kept die meeting the configured threshold counts as one success.

`keep` and `resolution` are intentionally separate responsibilities. Example: 5D6 keep highest 3 + sum is valid without inventing a new resolution type.

## 5. OutcomeTable

OutcomeTable maps the resolved value to an arbitrary semantic result.

Example:

```js
[
  { max: 4, id: "low" },
  { min: 5, max: 7, id: "medium" },
  { min: 8, id: "discovery" }
]
```

Another check may use completely different bands:

```js
[
  { max: 1, id: "failure" },
  { min: 2, max: 3, id: "mixed" },
  { min: 4, id: "success" }
]
```

Outcome IDs are semantic labels only. Resource gain, damage, intel, movement, or other actual effects remain outside the generic dice layer.

Definitions must fail fast on invalid dice specs, unsupported resolution rules, gaps, or overlapping outcome ranges.

## 6. PresentationHint

PresentationHint must communicate importance, not dictate concrete DOM structure.

Example:

```js
{
  importance: "TACTICAL"
}
```

Rules must not encode UI instructions such as "render two D6 cubes" or "show five dice in one row".

The presentation layer may choose different layouts based on DiceSpec and available space.

Examples:

```text
2D6
→ existing rich 3D D6 animation may be used

5D6
→ compact dice-row presentation may be used

10D2 / non-D6
→ generic dice presentation may be used
```

Existing 2D6 presentation quality must not regress merely because the rule backend becomes generic.

## 7. RNG ownership

Player-facing dice checks use the CheckSystem random stream.

World / content generation randomness uses GameplayRandomService.

```text
runSeed
├ CheckSystem RNG
│  └ player-facing dice / checks
│
└ GameplayRandomService
   └ Offering / sockets / events / world selection / deterministic gameplay IDs
```

Do not consume GameplayRandomService for player-facing dice.

Do not consume CheckSystem RNG for Offering, socket placement, weighted card selection, or similar world-generation randomness.

The two streams must remain independent: consuming one stream must not alter future results in the other stream.

## 8. Restore / determinism contract

CheckSystem RNG state and GameplayRandomService state are restored independently.

Required property:

> Same restored state + same subsequent decisions = same subsequent dice and world-random results.

Restore must not be usable as a hidden reroll mechanism.

Known historical state such as an already generated Offering or known socket layout is restored exactly rather than regenerated.

## 9. Existing and future callers

The generic system is not an exploration subsystem.

Possible callers include:

```text
land exploration
abandoned settlement
ambush
cavalry charge
forced breakthrough
retreat
reinforcement arrival
reconnaissance
emergency construction
future Trial tactical checks
```

Each caller may select its own DiceSpec, ResolutionRule, OutcomeTable, and effects.

## 10. Initial implementation boundary

The first implementation should preserve existing behavior and avoid speculative feature breadth.

Required first-step capabilities:

```text
existing DicePool keep rules
resolution: sum
arbitrary OutcomeTable
seeded deterministic CheckSystem RNG
```

The API and data shape must leave room for:

```text
highest
lowest
success_count
```

without requiring callers to be rewritten.

## 11. Regression requirements

At minimum, future implementation tests should cover:

```text
2D6 all
5D6 highest_3
10D2 all
same seed reproduces same roll sequence
CheckSystem getState/setState resumes the sequence exactly
invalid DiceSpec fails fast
invalid OutcomeTable fails fast
GameplayRandom consumption does not shift CheckSystem dice
CheckSystem dice consumption does not shift GameplayRandom results
existing 2D6 check behavior remains unchanged
```

## 12. Non-goals for this contract

Not required at this stage:

```text
supporting every physical die shape in UI
building dedicated 5D6 / 10D2 animations
choosing final Trial dice mechanics
making exploration the owner of generic dice rules
moving world randomness into CheckSystem
```

This contract exists to keep those future choices open without creating a rewrite requirement.
