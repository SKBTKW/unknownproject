# Stage1 亜人軍・本番生成ポリシー設計 v1

- Status: **DESIGN / VALIDATION。本番採用なし、Gameplay接続なし。**
- Task: `aot-task/AoT261029/trial/enemy-army-production-policy-design-v1`
- Target / inspected HEAD: `AoT261029` / `87db1d3e4b6740d59805f0953f3449295416c317`（PR #472統合済み）
- 本書の推奨は担当者の提案であり、ユーザーが承認した正式仕様ではない。数値・閾値・候補の組合せを正式化しない。

## 1. 現行実装と正式決定の境界

参照正本: [Foundation](enemy_army_blueprint_foundation_v1.md)、[設計台帳](99_enemy_army_design_ledger_stage1_v1.md)、[PR #472分布検証](enemy_army_generation_distribution_validation_v1.md)。Foundation文書の「Stage-start接続はSCHEDULED」は当時の記録であり、現行では保持・保存復元、新規Run Bootstrap、Stage Adapterまで実装済みである。

| 区分 | 確認事項 |
|---|---|
| 正式な原則 | 真実は調査前に存在し、調査は既存の観測可能事実をKnownへ記録する。未観測情報を公開しない。 |
| 部隊の意味 | Aは主力、B/Cは副次の潜在的識別。潜在部隊と参加部隊、構成と制圧力を分離する。A主力は大型種主体を意味しない。 |
| 現行データ | Blueprint v1はStage1限定、A/B/Cの**3枠全て**を保存する。「最大3部隊」という設計に対し、可変長0〜3枠のモデルではない。参加数は別責務。 |
| 現行生成 | 明示ポリシーの完全構成候補から各枠1候補をweight抽選する。比率を連続的に再抽選する方式ではない。 |
| 再現性 | RunSeed・Stage・policy id/version・slotからFNV-1aで派生し、共通RandomSourceを局所生成する。既存Gameplay/Check RNGを消費しない。候補順序とデータも再現条件。 |
| 保持・復元 | LifecycleがGameStateのBlueprint ledgerを保持。保存構成を復元し、調査やVerseで再抽選しない。同じStageに異なる構成を再登録しない。 |
| 本番の現状 | GameEngineの`enemyArmyBlueprintPolicy`は既定null。通常Runで仮説A/B/Cは生成されない。Stage Adapterも明示設定が必要で、モデルのStage2/3対応は未実装。 |
| Trialの現状 | 既存Truth/ArmyStructure/Scenario経路を使用。Stage1 Trial1は基本総制圧力20、開発度係数0、1部隊導入を維持。Blueprintの3枠を参加させない。 |
| 未決定 | 本番比率・weight・種族装備制約、配分・参加条件、指揮役職、行動傾向、地形因果。既存実装値や本書の仮説から新仕様を導出しない。 |

実装確認対象はBlueprintモデル/Generator/Lifecycle/New Run Bootstrap/Stage Adapter、GameEngine、EnemyTruthObservableResolver、InvestigationResolver、Stage1 Trial Threat Policy。今回の変更は本書のみ。

## 2. 比較条件と仮説

PR #472のJSONと診断器をそのまま使用。全案共通でRunSeed **0〜9999**、Stage1、10,000軍団・30,000潜在部隊。各出力を即時再生成して比較した。生成失敗0、再生成不一致0、再生成エラー0、各案10,000/10,000一致。

```powershell
node scratch/diagnose_enemy_army_generation_distribution.mjs --models A,B,C --count 10000 --start 0 --json > $env:TEMP\aot-production-policy-design-distribution.json
node scratch/diagnose_enemy_army_generation_distribution.mjs --models A,B,C --count 10000 --start 0 --markdown
```

再測定JSONのSHA256は `9CE765CE12CDF4AC559E944104CD19DB1AFAFC62F78AD423DA541B95E9006309`。PR #472の独立再実行結果とも一致。表は原則小数第2位に丸める。同じSeed集合でもpolicy idが派生系列に含まれるので、案間で同一乱数値を引く比較ではない。有限Seed区間の記述統計であり、全uint32 Seedの保証や有意差検定ではない。

案名A/B/Cと部隊枠A/B/Cを区別する。以下のweightは全て**Development仮説**。正本は `scratch/enemy_army_distribution_hypotheses_v1.json`。既存loaderが種族候補×装備候補を完全構成候補へ展開し、既存Generatorへ渡す。別の抽選器は作らない。

| 案 | 種族候補のweight | 装備候補のweight（軽装寄り/標準寄り/重装寄り） |
|---|---|---|
| A: 均等 | 全枠: 大型/標準/小型主体の混成4/4/4、各単一種族1/1/1 | 全枠1/1/1 |
| B: 標準種主体 | 全枠: medium-core8、large-secondary1、small-secondary1、medium-only1 | 全枠1/3/1 |
| C: 部隊個性 | 枠A: 混成4/5/1、単一1/1/.5。枠B: B案。枠C: 混成1/2/7、小型単一1 | 枠A 1/2/3、枠B 1/3/1、枠C 3/2/1 |

混成の種族比率（大型/標準/小型）はlarge-mixed=60/25/15、medium-mixed=15/60/25、small-mixed=25/15/60。B案はmedium-core=15/75/10、large-secondary=65/30/5、small-secondary=5/30/65。装備は軽装寄り=LIGHT70/STANDARD30、標準寄り=STANDARD70/HEAVY30、重装寄り=HEAVY70/LIGHT30。全て未採用の仮定。

## 3. 10,000 Seedの結果

### 等重みの部隊平均

| 案 | LARGE | MEDIUM | SMALL | LIGHT | STANDARD | HEAVY | 単一種族部隊 / 30,000 |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 33.45% | 33.28% | 33.27% | 33.36% | 33.46% | 33.17% | 5,967 (19.89%) |
| B | 17.25% | 69.14% | 13.60% | 19.88% | 48.13% | 31.99% | 2,742 (9.14%) |
| C | 25.53% | 44.26% | 30.21% | 29.03% | 38.15% | 32.81% | 3,816 (12.72%) |

人数・制圧力が未定なので各潜在部隊を等重みで平均した。軍団全体の人口比や制圧力比ではない。診断上の極端判定は最大種族share>=90%。今回の候補集合では単一種族と一致するが、この閾値を禁止条件にはしない。

### 枠別平均と装備の存在

| 案/枠 | LARGE | MEDIUM | SMALL | HEAVYあり | SMALLとHEAVYが同じ部隊に存在 |
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

C案の枠Aでも平均最多はMEDIUMである。主力性と大型種を結び付ける根拠にはならない。存在率とshare平均は別の量。

### 同一軍団内の構成差

| 案 | 種族構成が全枠同一 | 種族構成が2種類 | 種族構成が3種類 | 種族+装備が全枠同一 |
|---|---:|---:|---:|---:|
| A | 557 (5.57%) | 5,088 (50.88%) | 4,355 (43.55%) | 61 (0.61%) |
| B | 3,904 (39.04%) | 4,971 (49.71%) | 1,125 (11.25%) | 902 (9.02%) |
| C | 0 (0%) | 1,595 (15.95%) | 8,405 (84.05%) | 0 (0%) |

C案は3枠全てに共通する種族候補が存在せず、全枠同一を構造的に除いている。84.05%を良いバランスの指標にはできない。B案の39.04%は部隊間調査が同じ結論になりやすい懸念だが、装備差や後続の別因果があれば無価値とは限らない。

### Run間の軍団の多様性（追加集計）

軍団の同一性は枠順A/B/Cを維持した構成の一致と定義し、RunSeed・ID・policy情報を除く。種族/装備リストはtype順に正規化。個体や装備の結合分布を作る集計ではない。

| 案 | 種族軍団の実測種類 / 候補組合せ上限 | 種族+装備軍団の実測種類 / 上限 | 最頻種族軍団の回数 | 最頻種族+装備軍団の回数 |
|---|---:|---:|---:|---:|
| A | 216 / 216 | 3,333 / 5,832 | 217 (2.17%) | 17 (0.17%) |
| B | 64 / 64 | 929 / 1,728 | 3,877 (38.77%) | 832 (8.32%) |
| C | 95 / 96 | 1,411 / 2,592 | 1,849 (18.49%) | 279 (2.79%) |

上限は各枠の候補数の積。未出現の組合せが不正という意味ではない。Aは軍団間の構成数が多く、Cは軍団内の差が多い。この2つの多様性を混同しない。Bの再登場集中には、見慣れた敵として学びやすい可能性と、調査を省略される可能性が両方ある。候補数・weightが異なるので固有数だけで優劣を決めない。

### 極端な軍団の頻度

| 案 | 単一種族部隊を1つ以上含む軍団 / 10,000 | 全3枠がそれぞれ単一種族の軍団 / 10,000 |
|---|---:|---:|
| A | 4,868 (48.68%) | 82 (0.82%) |
| B | 2,493 (24.93%) | 12 (0.12%) |
| C | 3,395 (33.95%) | 13 (0.13%) |

「全3枠が単一種族」は各枠内が単一という意味で、3枠の種族が同一とは限らない。単一種族部隊19.89%と、それを含む軍団48.68%は分母が異なる。

## 4. 再現できる構成例

### 共通Seed42の説明例

統計的代表を称する標本ではなく、全案共通Seedで確認する説明例。種族はLARGE/MEDIUM/SMALL%、装備はLIGHT/STANDARD/HEAVY%。0は当該リストに存在しない。

| 案/枠 | 種族 | 装備 |
|---|---|---|
| A/A | 15/60/25 | 0/70/30 |
| A/B | 25/15/60 | 0/70/30 |
| A/C | 25/15/60 | 0/70/30 |
| B/A | 5/30/65 | 0/70/30 |
| B/B | 15/75/10 | 0/70/30 |
| B/C | 0/100/0 | 0/70/30 |
| C/A | 60/25/15 | 0/70/30 |
| C/B | 15/75/10 | 0/70/30 |
| C/C | 25/15/60 | 70/30/0 |

各案の最頻の種族+装備軍団の最小SeedはA=538、B=33、C=11。B/33は全枠「種族15/75/10、装備0/70/30」で832回出現する。これはB案の集中を示す、頻度に基づく代表例。

### 極端例・類似例（条件を満たす最小Seed）

| 案 | 単一種族部隊の初出 | 全枠単一種族の初出と種族A/B/C | 全枠同一の種族構成の初出 |
|---|---|---|---|
| A | Seed3、枠A=SMALL100% | Seed103、SMALL/LARGE/MEDIUM | Seed26、全枠60/25/15 |
| B | Seed0、枠B=MEDIUM100% | Seed473、MEDIUM/MEDIUM/MEDIUM | Seed4、全枠15/75/10 |
| C | Seed1、枠C=SMALL100% | Seed600、MEDIUM/MEDIUM/SMALL | 0〜9999に存在せず。候補集合上も不可能 |

A/26では枠Aの装備がLIGHT30/HEAVY70、枠B/CがLIGHT70/STANDARD30であり、同じ種族でも装備差が残る。B/473は全枠STANDARD70/HEAVY30。C/600では枠A/CがLIGHT30/HEAVY70、枠BがSTANDARD70/HEAVY30である。小型単一部隊に重装比率があっても、個々の小型種が重装を着ているというモデル上の断定にはならない。

珍しい構成は発見やリプレイ性を生み得るが、未提示の因果で対処不能になるなら初見体験を損なう。その戦闘因果は未接続なので、排除・再抽選・最低混成率を正当化できない。同じ構成の複数部隊も、調査の再確認や配置差を持ち得るため無条件に除外しない。

## 5. 設計評価

| 評価軸 | A: 均等 | B: 標準種主体 | C: 部隊個性 |
|---|---|---|---|
| 亜人軍としての自然さ | 種族対称性の比較基準。等分が世界観上自然という根拠はない | 共通の軍団像を持たせやすい。ただし標準種主体の世界観は未承認 | 編成された部隊らしい差。ただし枠ごとの候補分離の作為も強い |
| 軍団間の変化 | 今回は構成種類が多く再登場集中は低い | 同じ軍団が集中。学習可能性と単調さの両面 | 中間。軍団内の差は多いがRun間の型も固定されやすい |
| 同一軍団内の差 | 偶発的。似た部隊も残す | 種族差は弱く装備差も限定的 | 差が出やすいが全枠同一を構造的に除外 |
| 調査する価値 | 幅広い結果を事前に予測しにくい可能性 | 基本形を既知とすると逸脱発見の価値が焦点 | 部隊別調査の素材。ただし枠から型を予測できると省略される |
| 将来の戦術因果 | 種族差の対照実験向け。初見で複雑な敵が多い懸念 | 基準敵との差を説明しやすい可能性 | 部隊別迎撃へ接続しやすい可能性。固定の対処手順になる懸念 |
| 極端構成 | 単一種族を含む軍団が約半数。珍しい例外とは言い難い | 頻度は低めだが約1/4の軍団に存在 | 約1/3。小型単一は枠Cに偏る仮説 |

自然さ・理解しやすさ・面白さは設計仮説であり、実プレイで実証した評価ではない。平均比率・候補数・部隊差から面白さの順位は付けない。

### 部隊役割と種族・装備

主力の制圧力は後続のTrial Threat / Army Deploymentで決める。主体種族、装備、行動傾向は別々に検討する。現行Blueprintに行動傾向はなく、種族や重装から行動を自動決定しない。枠Cを小型固定、枠Aを大型・重装固定にする必要もない。

種族と装備は**別々の周辺分布**。仮説loaderのweight積は、個体単位の独立性・相関を意味しない。SMALL+HEAVYの部隊レベル同時存在率はA57.79%、B72.83%、C64.06%で、小型種の重装着用率ではない。

種族別装備禁止、個体装備、人数による整合条件が必要なら、現行モデルだけではその真偽を判断できない。小型単一+重装候補の許否には、まず装備shareの意味と種族別装備表現の判断が必要。候補除外で仕様を先に固定せず、別TASKのモデル設計として扱う。部隊長・総指揮官・指揮種・先導個体は追加しない。

### 調査価値の判断に足りないもの

現行EnemyTruthObservableResolverは旧来の`armyStructure.force.profile`から体格・装備の粗いタグを作る。Blueprintの混成比率を読む本番アダプタはない。InvestigationResolverは既に公開可能な候補から報告を選ぶ。この経路を今回変更しない。

多くの混成候補は3種族全てを含むので、将来「存在する種族」だけを投影しても60%主体と15%少数を区別できない可能性がある。構成差、観測結果の差、観測後の選択変化を別々に確かめる必要がある。台帳の「多い種族ほど観測されやすい」方針も、混成比率からの具体的抽選・公開粒度は今回定めない。

後続では同じ盤面・同じ制圧力で異なる事前構成を用意し、許可された観測のみKnownへ渡して、迎撃地点や既存戦術の選択理由が変わるかを確認する。未調査時・同じ構成時も対照にする。構成の戦闘因果と公開ルールの承認が先に必要であり、現在このプレイ価値は**未検証**。

## 6. 担当者の推奨（未採用）

**① 懸念点・リスク:** Bをそのまま採ると基本形への集中が強い。Cをそのまま採ると部隊の型と候補の排他性が調査の代わりになり得る。Aの対称な平均を本番の妥当性とする根拠もない。全案未接続で、実戦上の有利不利・難度は未測定。

**② 対応策・代替案:** 次候補は「標準種主体の共通基盤に、確率的な部隊差を加える方針」を推奨する。Bを基準敵の対照として残し、Cの部隊差の発想を借りるが、各枠の候補に重なりを持たせ、A大型固定・C小型固定や全枠同一の一律禁止は採らない。単一種族・同型部隊も例外候補として残す。具体的weight・比率・例外頻度は決めない。これは測定済みの第4案ではなく、次に比較すべき方向の提案である。

**③ 総括判定:** 現行A/B/Cのいずれも本番採用しない。Bそのものを推奨ポリシーとせず、共通基盤と部隊差を独立調整できる候補を次TASKで検証する。標準種主体の世界観上の位置付けもユーザー判断を要する。最終採用は観測可能な違いが選択理由になることと、初見Stage1の安全性を確認してから行う。

## 7. 未決定事項と有効化箇所

| 決める事項 | 判断材料 / 今回の扱い |
|---|---|
| 基調・枠ごとの傾向 | 標準種主体の意味、候補の重なり、同型・単一種族の許容頻度。全数値未採用 |
| 装備share | 部隊資産比か個体装備か、種族別制約が必要か。モデル拡張は別TASK |
| 調査の粒度 | 部隊識別、存在/主体/比率のどこまで観測するか、偏り・再観測。新公開ルールは未実装 |
| 戦闘因果 | 混成部隊の既存地形・戦術への解釈。配分・参加・指揮仕様と分けて別途承認 |
| 採用・互換性 | policy id/version、候補順、旧セーブを再抽選しない扱い、将来の資産保管。保存形式は変更しない |
| Stage2/3 | モデル対応・再編・本番分布。対象外 |

将来の有効化は次の変更を別TASKで行う。以下の追加・接続を今回許可したものではない。

1. 承認済みStage1専用ポリシー資産を新設する（候補名`game/src/trial/config/stage1_enemy_army_blueprint_policy_v1.json`、現在は存在しない）。Development仮説JSONを本番からimportしない。既存validatorで検証する薄い読込箇所を設ける。
2. `game/src/core/game_engine.js`に既存のNew Runの`enemyArmyBlueprintPolicy`注入点へ、承認済み資産を渡す。現行の本番構築側は`game/index.html`の`bootstrap()`内の`GameEngine.createGame()`で、現在はポリシー未指定である。Bootstrap/Generator/Lifecycleの書換えを前提にしない。ロードでは生成を抑止し、保存済み構成を優先する。
3. Stage1の事前保持だけの有効化なら、`game/src/trial/integration/trial_runtime_bootstrap.js` / Stage Adapterや保存形式の変更は不要。Stage2/3ポリシーは追加しない。
4. Blueprint→既存Truth / 観測 / Deployment接続は更に別TASK。`enemy_truth_observable_resolver.js`、`enemy_truth_read_model.js`、`enemy_army_structure_resolver.js`、`trial_scenario_factory.js`、`enemy_force_deployment_resolver.js`は接続時の調査対象で、一括変更予定ではない。Trial Threatが構成を生成する設計には戻さない。

## 8. 回帰と今回の検証範囲

既存の分布Unit/CLI、Blueprint Unit/Integration、Lifecycle/保存復元、New Run Bootstrap、Stage Adapter、Stage1 Trial Threat Policy、FirstRun Stage1 Completionを維持する。有効化TASKでは正式資産の全候補検証・同入力再現・局所RNG非干渉・不正ポリシー失敗・既存Stage不変・復元時非生成・旧セーブ・Stage2移行を追加または強化する。観測接続時は未観測情報の非公開、調査によるTruth非変更、同型/極端例、観測と選択の関係を別途検証する。

本TASKは文書のみで新規`test_*.mjs`を追加せずレジストリも変更しない。関連テストとcleanなTASKでFull Inspection Layer1〜6を実行し、結果はPR/完了報告へ記録する。実ブラウザのプレイ・描画・面白さは未検証。合理的な生成分布とゲームとしての面白さは別の判断である。

## Appendix: 追加集計・例の再現

リポジトリルートで実行する。既存Generator/仮説loaderを再利用し、ゲームや保存データを変更しない。分布・再生成検査は前述CLIを正本とし、以下は軍団間の固有構成数と例の抽出を補足する。例の完全Snapshotは同じGeneratorに表のSeedを渡せば取得できる。

```powershell
$policyDesignCode = '
import {createDistributionPolicies} from "./scratch/enemy_army_generation_distribution.mjs";
import {generateEnemyArmyBlueprint as generate} from "./game/src/trial/systems/enemy_army_blueprint_generator.js";
const sig=list=>JSON.stringify([...list].sort((a,b)=>a.type<b.type?-1:a.type>b.type?1:0));
for(const [model,policy] of Object.entries(createDistributionPolicies())) {
  const species=new Map(),combined=new Map();
  let anyPure=0,allPure=0,firstAnyPure=null,firstAllPure=null,firstSame=null;
  for(let seed=0;seed<10000;seed++) {
    const forces=generate({runSeed:seed,stageId:1,policy}).getSnapshot().forces;
    const s=forces.map(f=>sig(f.composition.speciesComposition));
    const c=forces.map(f=>sig(f.composition.speciesComposition)+sig(f.composition.equipmentComposition));
    for(const [map,key] of [[species,JSON.stringify(s)],[combined,JSON.stringify(c)]]) {
      if(!map.has(key))map.set(key,{count:0,firstSeed:seed});
      map.get(key).count++;
    }
    const pure=forces.filter(f=>f.composition.speciesComposition.length===1).length;
    if(pure){anyPure++;firstAnyPure??=seed;}
    if(pure===3){allPure++;firstAllPure??=seed;}
    if(new Set(s).size===1)firstSame??=seed;
  }
  const top=map=>[...map].sort((a,b)=>b[1].count-a[1].count||(a[0]<b[0]?-1:1))[0][1];
  console.log(JSON.stringify({model,uniqueSpecies:species.size,uniqueCombined:combined.size,
    anyPure,allPure,firstAnyPure,firstAllPure,firstSame,
    topSpecies:top(species),topCombined:top(combined),
    seed42:generate({runSeed:42,stageId:1,policy}).getSnapshot().forces}));
}'
$policyDesignCode | node --input-type=module
```
