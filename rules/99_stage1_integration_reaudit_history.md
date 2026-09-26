# 99-B. Stage1 Integration Re-audit History

> **Status:** Historical Audit Archive / Non-Authority
>
> この文書は、Stage1 canonical runtime path の時点監査を保存するための履歴資料。
> 現行Gameplay仕様・現行blocker判定・現行balance値の正本ではない。
>
> 現在状態を確認する場合は、最新の `AoT260924`、canonical runtime tests、
> AoT Full Inspection、および各Domainの正本を参照すること。

## 1. 保存目的

過去のIntegration監査TASKでは、その時点のStage1 completion gateをMarkdownとしてbranch内に保持していた。

これらのbranchを恒久的な監査資料置き場として残すのではなく、

- 何がその時点で確認済みだったか
- 何が未解決だったか
- どの責務をD担当が持たなかったか
- どの時点でruntime gateがGREENへ移ったか

だけを本書へ集約し、元TASK branchは通常のcleanup対象にできるようにする。

本書の記録は**当時の判断**であり、後続PRにより現在状態が変化していても書き換えて現在形にはしない。

## 2. 出典

| Snapshot | Target | Source branch | Source HEAD | Original file | Recorded |
| :--- | :--- | :--- | :--- | :--- | :--- |
| A | `AoT260922` | `aot-task/AoT260922/integration/stage1-e2e-reaudit-r2` | `65606b04f95085664220de56ca13c21d0576619b` | `scratch/STAGE1_E2E_REAUDIT_STATUS.md` | 2026-09-24 |
| B | `AoT260924` | `aot-task/AoT260924/integration/stage1-e2e-reaudit-d` | `b89f2fec418cbc8bb6c5de4f65b990eed8c225ef` | `scratch/STAGE1_E2E_REAUDIT_STATUS.md` | 2026-09-24 |
| C | `AoT260924` | `aot-task/AoT260924/integration/stage1-e2e-reaudit-d-r2` | `23d3b193bbefe62a9adeeb2a15e8ae04c1f97d5e` | `scratch/STAGE1_D_INTEGRATION_REAUDIT.md` | 2026-09-24 |

---

## 3. Snapshot A — AoT260922 Stage1 E2E re-audit

### 3.1 当時のresolved blocker

当時の監査では以下を解決済みとしていた。

- #200 browser FirstRun activation source
  - owner work: PR #203
- #201 Enemy Truth → observable → Investigation
  - owner work: PR #206
- #202 canonical Trial1 threat / non-zero enemy force
  - owner work: PR #222

この時点でStage1 E2Eは、少なくとも次のcanonical downstream pathを通す構成になっていた。

```text
Verse1
→ LAND Offering / placement
→ Verse7 traces / OMEN
→ Investigation unlock
→ Verse8 Investigation
→ KnownEnemyState / WATCH
→ TENSE / IMMINENT
→ Verse15 Trial1 due
→ positive Enemy Truth
→ legal ingress
→ Trial launch
→ interception planning
→ defense allocation
→ plan activation
→ battle / traversal
→ HQ damage where applicable
→ Trial completion
→ settlement
→ Post-Trial interlude
→ Stage prelude
→ Stage2 / 7x7
→ Trial session release
→ normal Offering restoration
```

### 3.2 当時の未解決HIGH

#208 Trial Deployment Economy production composition / final balance certification を
**OPEN / HIGH** としていた。

不足していた証明:

- production `TrialDeploymentService` attachment
- real preview
- positive Food / Material sink
- preview == commit payment
- Food write-through exactly once
- Material write-through exactly once
- activation / battle / settlementを跨いだduplicate charge不在

この監査branch自身ではcost profileやGameplay balance値を決めない、という境界を明示していた。

### 3.3 当時の結論

- unresolved BLOCKER: **0**
- unresolved HIGH: **1**
- downstream canonical E2E path: **implemented**
- final Stage1 certification: **NOT READY**

---

## 4. Snapshot B — AoT260924 runtime gate green transition

### 4.1 当時のcanonical runtime結果

当時の記録では、merged PR #232 と後続 #266 によりStage1 canonical pathのruntime統合がGREENへ移行していた。

記録値:

- Stage1 E2E: **119 PASS / 0 FAIL**
- AoT Full Inspection #1002: **SUCCESS**

確認対象には、Snapshot Aの経路に加えて次が含まれていた。

- Deployment Economy preview / payment
- positive Food / Material sink
- committed payment equals preview
- Food / Material / Defense write-through exactly once
- downstream battle / settlement / Stage2の継続成功

### 4.2 #208の意味の変化

この時点では、#208の**runtime composition defect自体は解決済み**としていた。

一方で、最終balance certificationとしては依然HIGH扱いであり、
runtime integrationとbalance closureを分離していた。

### 4.3 当時のbalance依存

当時は以下を最終certification側のHIGH依存として記録していた。

- #251 first-wave board-investment cards
- #250 FirstRun relative resource-burden policy
- #208 final Deployment Economy balance closure

当時の設計目安:

- peacetime / preparation sinks: baselineの約50–60%
- Deployment: residualの約40–50%
- combined FirstRun conversion: 約70–80%

これは**当時の監査上の設計レンジ**であり、現在値として扱わない。

### 4.4 当時の結論

- unresolved runtime BLOCKER: **0**
- unresolved runtime integration HIGH: **0**
- canonical Stage1 runtime path: **GREEN**
- final Stage1 certification: **NOT READY**

---

## 5. Snapshot C — AoT260924 D integration re-audit refresh

### 5.1 canonicality gate

後続refreshでは、以下の2テストをcanonical runtime gateの中心としていた。

- `scratch/test_stage1_e2e.mjs`
- `scratch/test_stage1_canonical_runtime_path.mjs`

Stage / Trial / Warning / Enemy progressionのauthorityを直接mutateせず、
public runtime boundaryを通ることを要求していた。

当時確認対象として列挙されていた主な経路:

- Verse1 real LAND Offering / placement
- Verse7 traces / OMEN
- Investigation unlock / Verse8 guarantee
- Investigation → KnownEnemyState → WATCH
- TENSE / IMMINENT
- Verse15 Trial1 due
- Enemy Truth / route / ingress
- Trial launch
- interception / defense planning / activation
- production Trial Deployment Economy
- real preview / affordability
- Food / Material sink
- preview / committed payment equality
- Food / Material / Defense write-through once
- battle / traversal / HQ damage
- Trial completion / settlement
- Post-Trial / Stage2 / 7x7
- Trial session release
- normal Offering restoration

### 5.2 当時のowner progress記録

#251について、当時のtarget上では次の進捗を記録していた。

- Granary gameplay v1 merged in #283
- Wetland Reclamation terrain-transform foundation merged in #286
- Zone Conversion production-modifier foundation merged in #274
- Special Block creation-cost authorityはtarget上に存在
- Logging Camp productは未完
- Wetland Reclamation card migrationは未完
- Granary cost-authority / maintenance境界は未完
- Agricultural Reform canonical definition / production registration / card migrationは未完

この一覧も**2026-09-24時点の記録**であり、現在状態を表さない。

### 5.3 D担当境界

D担当は次を実装しない、と明示していた。

- board-investment card gameplay
- creation cost / facility value
- relative burden coefficient
- Trial deployment balance value

owner workが変化した後にDが再開する責務は、

1. latest targetへsync
2. canonical Stage1 E2E実行
3. Full Inspection実行
4. runtime regression確認
5. real pre-Trial residual snapshot確認
6. Deployment preview / commit確認
7. completion gate更新
8. unresolved BLOCKER = 0 / HIGH = 0 の時だけcertify

だった。

### 5.4 当時の結論

- runtime completion gate: **GREEN**
- unresolved BLOCKER: **0**
- unresolved runtime integration HIGH: **0**
- balance-side HIGH dependencies: **残存**
- final Stage1 certification: **NOT READY**

---

## 6. 監査履歴の読み方

この3 snapshotは、Stage1統合が

```text
runtime composition未証明
→ runtime path GREEN
→ balance-side completion gateへ責務移行
```

した過程を保存するもの。

Issue番号、PR番号、PASS数、HIGH/BLOCKER判定はすべて**そのsnapshot時点の証拠**として扱い、
現行targetのstatus判定には直接再利用しない。

## 7. branch cleanup方針

本書へ保存済みの時点監査Markdownだけを理由に、元監査TASK branchを保持する必要はない。

元branchを削除する場合でも、

- branch HEADを本書のSource HEADと照合
- open PR head/base参照がないことを確認
- 本書がcurrent targetにmerge済みであることを確認

してから削除する。

これにより、監査履歴はGit branchではなくversioned documentとして保持する。
