# Stage1 Tactical Decision & Causal Impact Audit v1

## 0. Scope and method

- Base: `6ac94bf129fb3b60deea9f6939942c4b808893f0` (`origin/AoT261110`)
- Scope: Stage1 Trial の既存 production 戦闘経路、Battle Snapshot、調査情報境界の監査
- Production mutation: **なし**
- 正式係数・参加閾値・配分比率・`PRIMARY_SOURCE`・戦術効果・🔥式: **変更なし**
- 実行入口: `scratch/diagnose_stage1_tactical_decision_causal_impact_v1.mjs`
- NATURAL: seed `20260920`〜`20260927`、`expansion` / `balanced` の16盤面
- CONSTRUCTED_LEGAL: `GridEngine.checkNewMergeLinks()` と `SpecialBlockService` で2 Zone、1 Link、Palisade合法配置を検証。ただし標準プレイの代表とは扱わない。
- SYNTHETIC: 3経路・3プロフィールの戦闘Domain比較。通常Runの代表値とは扱わない。

比較は `TrialController` の Preview / Commit 境界を維持し、選択した案は Battle Resolution、Enemy Advance、HQ aggregate damage、Trial completionまで実行した。C6だけは全候補をPreviewで列挙し、最良案を実Trialへcommitした。

## A. 戦闘因果接続マトリクス

| 入力 | 判定 | productionで実際に起きること |
|---|---|---|
| 地形種類 | EFFECTIVE | `TrialTerrainEffectResolver`の森林・深森・湿原出口・砂漠出口と、敵プロフィールの地形相互作用へ入力される |
| 高度E | EFFECTIVE | 条件成立時に`HIGH_GROUND`が人類または敵へ倍率適用される |
| 繁茂GL | CONTEXT_ONLY | Battlefield Contextへ記録されるが、戦闘計算はGLを読まない |
| 地帯化 | NOT_CONNECTED | Stage1 Threatのdevelopment入力にはなるが、production Battle Contextへ渡らない |
| 連携 | NOT_CONNECTED | Stage1 Threatのdevelopment入力にはなるが、production Battle Contextの`links`は空のまま |
| 特殊ブロック | EFFECTIVE / CONTEXT_ONLY混在 | 迎撃可否と`PALISADE`の地形戦術抑止は有効。Palisade/Earthworkの数値倍率は既定`null`で戦果へ不適用 |
| 敵種族（体格） | EFFECTIVE | `SMALL/MEDIUM/LARGE`が展開比率・機動・予備戦力分離へ反映される |
| 有効装備 | EFFECTIVE | `LIGHT/STANDARD/HEAVY`が展開・機動へ反映される |
| 予約装備 | CONTEXT_ONLY | データ表現は可能だがactive equipment contractから除外される |
| 敵戦術 | CONTEXT_ONLY | 適格判定・優先選択・Snapshot記録は行うが、`TrialCombatResolver`へ数値Modifierを渡さない |
| 人類の基本戦術 | NOT_CONNECTED | production戦闘入力として存在しない。🛡️配分は別途EFFECTIVE |
| 時間帯・天候・視界 | CONTEXT_ONLY | Environment/Future inputとして保持可能だが戦闘計算に未接続 |
| 敵部隊同士の関係 | PROTOTYPE | development causal modelに存在するがproduction戦闘へ未接続 |
| Human Engagement Origin | CONTEXT_ONLY | Spatial/Snapshot/Presentationへ記録されるが数値戦闘へ未接続 |
| 🛡️投入量 | EFFECTIVE | `InterceptionPowerResolver`で🛡️1→迎撃力5へ変換される |

### production pipeline

`TrialController`
→ Route / planning
→ `EnemyForceTerrainInteractionResolver`
→ `EnemyForceDeploymentResolver`
→ Tactic eligibility / selection
→ `TrialCombatResolver`
→ `BattleResolutionSnapshotFactory`
→ Fact / Cause / Consequence / Battle State / Normal Outcome
→ Enemy Advance
→ HQ arrival aggregation
→ 🔥 damage

戦術選択、天候等、GL、Originは上記途中で記録されても`TrialCombatResolver`の人類/敵戦力を変更しない。Contextに存在することをEFFECTIVEの根拠とはしなかった。

## B. 迎撃地点比較

### B1. NATURAL 8 seed

16盤面中、同じ🛡️3で迎撃地点を変えたとき：

- 残存制圧力差あり: **7/16**
- 差なし: **9/16**
- NATURAL Zoneあり: **1/16**（seed 20260920 expansion）
- NATURAL Linkあり: **0/16**

代表例：

| Seed / strategy | 地点 | 地形 | 残存制圧力 | 🔥 | 判定 |
|---|---:|---|---:|---:|---|
| 20260921 expansion | (0,0) | Forest | 55 | 11 | 改善 |
| 20260921 expansion | (1,0) | Plains | 85 | 17 | 基本 |
| 20260921 expansion | (2,1) | Plains（敵側高所） | 105 | 21 | 迎撃なし🔥20より悪化 |
| 20260920 expansion | Forest 3候補 | Forest | 55 | 11 | 3地点すべて同一 |

改善ケースでは森林展開制限が実際のModifierになった。差がないケースは、同一Modifierへ解決された、候補が1件だけ、または固定🛡️と丸め後の残存制圧力が同じだった。

### B2. 同一敵軍・平地とPalisade森林

3経路Fixtureで主力経路だけを変更し、他経路・🛡️4ずつを固定した。

| 地点 | Fact / Cause / Consequence | 総残存制圧力 | 🔥 |
|---|---|---:|---:|
| Plains | profile/local power Factのみ。Causeなし | 60.5 | 13 |
| Forest + Palisade | `ENEMY_DEPLOYMENT_CONSTRAINED`、`DEPLOYMENT_CONSTRAINED`、`MOVEMENT_CONSTRAINED`、`ENEMY_RESERVE_HELD_BACK`、`SUPPORT_DELAYED` | 60.5 | 13 |

因果Snapshotは大きく変わるが戦果は同一だった。PalisadeはBase Terrain戦術を抑止し、既定の方向防御倍率が`null`である。展開不能分は予備へ移り、固定迎撃力が展開戦力を超えない範囲では総残存量が同じになった。

### B3. 因果ラベルの不整合

seed 20260921 expansionの(2,1)では敵が高所側で、`HIGH_GROUND`が敵制圧力を増やし🔥21へ悪化した。それでもFact `HIGH_GROUND`の存在だけでCause `TERRAIN_ADVANTAGE`がFAVORABLEとして生成される。数値戦果と因果説明の極性が一致していない。

## C. 🛡️配分比較

3経路、総戦略制圧力27（戦闘スケール135）、利用可能🛡️12を固定した。

| 方針 | 配分 | 残存制圧力 | 🔥 | 操作数 |
|---|---|---:|---:|---:|
| C1 迎撃なし | 0 / 0 / 0 | 135 | 27 | 3 |
| C2 均等 | 4 / 4 / 4 | 60.5 | 13 | 3 |
| C3 主力集中 | 10 / 1 / 1 | 63.5 | 13 | 3 |
| C4 地形優先 | 4 / 4 / 4（地点最適化） | 56.5 | 12 | 3 |
| C5 制圧力優先 | 6 / 4 / 2 | 62.5 | 13 | 3 |
| C6 診断上限 | 2 / 6 / 4 | 54.5 | 11 | 3 |

C6はallocation vector 455件、skipを含む地点組合せ18件から有効操作2,614件を打ち切りなしで評価し、Preview 54.5とcommit後54.5が一致した。C6はTruth/runtime previewを使う診断上限で、プレイヤーが通常到達できる判断とは扱わない。

最悪C1と最良C6の差は残存制圧力80.5、🔥16。C2〜C5では🔥差は1に留まり、単純な主力集中・制圧力比例が常に有利ではなかった。

## D. 敵種族・装備・地形

戦略制圧力12、🛡️4を固定し、3プロフィール×4地形をproduction resolverで比較した。

- Large/Heavy: Open展開比1.0、Forest 0.45、Deep Forest 0.25。
- Medium/StandardとSmall/Lightは今回の4地形で展開比1.0。
- 地形による展開不能分はBattle Normal Outcomeの`reserveSuppression`と`remainingForceSuppression`へ保持される。
- Large/Heavy + Forestは予備6.6（戦略スケール）を保持し、HQ残存制圧力40。
- Large/Heavy + Deep ForestはBattle Normal Outcome上の残存全軍制圧力45を保持するが、局地戦がREPELになるため`TrialEnemyAdvanceService`が経路全体を停止しHQ到達量を0にする。

最後の挙動は既存テストでも明示されている。つまり「予備がBattle Snapshotから消えない」ことと、「REPEL後も予備がHQへ進む」ことは別仕様であり、現状は後者を行わない。Gameplay意味論として妥当かは次段階で承認が必要。

敵戦術は`FRONTAL_BREAKTHROUGH`、`AMBUSH_CAUTION`、`FLANKING`等が選択されたが、12/12ケースすべてで選択戦術由来の数値Modifierは0件だった。

## E. 統合部隊プロフィール

実AdapterでA/B/Cを1参加部隊へ統合した。

- A: Large / Heavy
- B: Medium / Standard
- C: Small / Light
- Battle runtime: **Large / Heavyのみ**
- `primarySourceForceId`以外のB/CプロフィールはSnapshotに残るが、Battle interactionへ不使用
- KnownEnemyStateはSource Force Aだけを保持し、処理前後で不変。B/C Truth漏洩なし。

`PRIMARY_SOURCE`は、代表部隊のプロフィール次第で統合部隊全体の地形適性・展開比・戦術候補を決める。混成比率、非主力の装備、各元部隊の得意地形は戦果へ反映されない。今回は候補案の比較に留め、production置換は行っていない。

候補案：

1. constituent別展開後に制圧力を合算する。
2. share加重の体格・装備interactionを新Resolverで解く。
3. 最も制約の強いconstituentを採る保守的方式。

いずれも戦闘意味論とバランス承認が必要であり、本TASKでは採用しない。

## F. 調査情報と判断

同一Fixtureで次を分離した。

| 条件 | 使用情報 | 選択 | 🔥 |
|---|---|---|---:|
| F1 未調査 | 公開盤面・経路のみ | 最初の合法地点 | 13 |
| F2 KnownEnemyState | Source Force AのLarge/Heavyのみ | 展開制約を期待して森林 | 13 |
| F3 Truth診断上限 | runtime previewの最小残存量 | 実測最良地点 | 13 |

このケースでは調査で判断は変わったが戦果は変わらなかった。理由はPalisadeが森林/高度のBase Terrain戦術を抑止し、展開不能分が予備へ戻ったためである。

KnownEnemyStateはTrial Advisor/planningへ直接接続されていない。したがって「情報を得た」ことと「UI上で合理的な差を説明できる」ことの間に未接続がある。F3は診断専用でプレイヤーへ開示していない。

## G. 盤面発展と因果

- expansion/balanced 16 NATURAL盤面を使用。
- seed 20260920 expansionだけZone 1。Zone有無は戦闘入力へ渡らず、地点差は地形Modifierに由来した。
- NATURALでLink 1以上の盤面は0件。通常Runの代表としてLink効果を主張できない。
- CONSTRUCTED_LEGAL盤面では2 Zone、1 Link、Palisade合法配置をSSOTで検証した。
- その盤面でもZone/LinkはBattle Contextへ渡らず、Palisadeの既定数値倍率は未設定。
- NATURALのFarm/Logging Campは資源・盤面発展へ影響するが、今回の地点戦闘Modifierとしては不使用。

盤面拡張によるThreat変化と、局地戦の地形効果は別経路として扱った。盤面が有利という理由で敵制圧力を補正していない。

## H. Fact → Cause → Consequence → Normal Outcome

接続自体はproductionで実行され、Snapshotはimmutableである。

1. Contextは実地点、敵プロフィール、展開/予備、実CombatResultを保持する。
2. FactはContextから決定的に導出される。
3. Cause/ConsequenceはBattle Stateと説明用Normal Outcomeへ投影される。
4. Normal Outcomeの数値はCombatResultの写像であり、Cause/Consequenceが再度数値戦闘を変更するわけではない。
5. Opportunity/Fortuneは回帰対象のみで、本監査では変更していない。

したがって多くのFact/Cause/Consequenceは「数値結果の由来を記録する」役割であり、「生成されたCauseが数値結果を変更する」ものではない。特に`SUPPORT_DELAYED`は現状Battle State/説明への投影で、残存制圧力を追加減衰させない。

## I. 優先度付き次実装計画

### P0

1. **地形因果の極性修正**: `HIGH_GROUND`が人類有利か敵有利かをFact/Causeへ保持し、敵有利をFAVORABLE `TERRAIN_ADVANTAGE`としてAdvisorへ渡さない。
2. **予備戦力とREPELの意味論決定**: Battle Snapshotに残る予備を経路停止時に0扱いする現仕様を、ゲーム設計として維持するか明示承認する。

### P1

3. **KnownEnemyState→公開判断支援Adapter**: Source Force/Army/Regionの帰属を保ったまま、利用可能情報だけで候補比較理由を作る。Truth previewを使わない。
4. **統合プロフィールResolverの比較実装**: `PRIMARY_SOURCE`置換候補をprototypeで比較し、正式採用は別承認とする。
5. **敵戦術実行境界**: 選択済み戦術を数値/行動へ接続する場合、個別コスト・反作用・テストを先に定義する。

### P2

6. **Zone/Link/Special Blockの戦闘意味論**: productionへ接続するか、盤面発展/Threat専用と明示する。数値を無断追加しない。
7. **GL・Origin・Weather/Time/Visibility**: Context-onlyの表示を「適用済み効果」と誤認させない。

## J. Git / Test Report

- Base SHA: `6ac94bf129fb3b60deea9f6939942c4b808893f0`
- TASK branch: `aot-task/AoT261110/trial/stage1-tactical-decision-causal-impact-audit-v1`
- TASK HEAD: final commitはGit handoffで提示（コミット自身へのSHA埋め込みは自己参照になるため）
- 変更: 診断script、focused test、test registry、本報告書
- New focused test: **53/53 PASS**
- Stage1 participation production integration: PASS（Save/Restore・Known state非改変を含む）
- Battle Causality Domain / Resolution: PASS
- Enemy Invasion / Investigation: **9/9 PASS**
- Investigation restore round trip: PASS
- Trial foundation: **18/18 PASS**
- Battle Resolution: **30/30 PASS**
- HQ / Ember damage: **11/11 PASS**
- Reserve progression: PASS
- Full Inspection Layer 1〜6: final clean commitで実行し、Receiptと結果をGit handoffで提示する
- 実ブラウザ検証: **未実施**（新規UI・描画変更なし。Node production-domain経路を検証）
- 既知問題: 地形因果の有利/不利極性、REPEL時の予備HQ到達意味論、`PRIMARY_SOURCE`、敵戦術/Zone/Link等の未接続
- Push可否: Full Inspectionとclean-tree確認後に判定。Pushは明示承認待ち。

## 結論

Stage1では、迎撃地点と🛡️配分は実際に戦果を変え得る。NATURAL 16盤面中7件で地点差を確認し、3経路診断では判断差が🔥16まで拡大した。一方、9/16は地点変更で結果が変わらず、Context/Causeだけが増えて数値が変わらないケースもある。

現在の主な問題は「判断が全く効かない」ことではなく、**効く条件と説明の正確性が揃っていないこと**である。特に敵有利の高所をFAVORABLE原因として記録する問題と、Battle上の予備戦力と経路停止後の扱いの意味差を解消してから、Battle Causalityの追加実装へ進むべきである。
