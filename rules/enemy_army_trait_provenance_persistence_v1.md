# Enemy Army Trait Provenance / Persistence Contract v1

- Status: **IMPLEMENTED FOUNDATION / PRODUCTION DISCONNECTED**
- Target / base: `AoT261029` / `900fb67b46fd3a767c182a40dd936dcafd445822`
- Task: `aot-task/AoT261029/trial/enemy-army-trait-provenance-persistence-v1`

## 1. 正本と責務境界

`EnemyArmyBlueprint`は生成済み亜人軍の実態を表す正本である。`EnemyArmyTraitProvenance`は、そのBlueprintを生成した選択結果の最小来歴であり、再生成命令、Gameplay上の能力、調査済み情報ではない。

```text
explicit Trait Selection Result
             |
             v
immutable Provenance ---- validates ----> saved Blueprint (authority)
             |                                  |
             +---------- save / restore --------+
```

復元経路はSelector、Policy Resolver、Generatorをimportも実行もしない。保存済みBlueprintをそのまま復元し、Provenanceから再抽選、上書き、補完を行わない。Provenanceだけが存在する保存状態は拒否する。

本番Bootstrap、GameEngine、Stage Adapter、TrueEnemyState、KnownEnemyState、Investigation、Trial、Advisor/UIには接続していない。通常Runの自動生成、Stage2/3生成、Trait公開、TraitのGameplay効果は引き続き未実装である。

## 2. Provenanceデータ構造

Domain snapshot schema v1は次のexact-key構造である。

```js
{
  schemaVersion: 1,
  stageId: 1,
  traitId: 'development-trait-id',
  selectionPolicy: { id: 'selection-policy-id', version: 1 },
  generationPolicy: { id: 'concrete-blueprint-policy-id', version: 1 }
}
```

- `stageId`: Blueprintと関連付けるStage。
- `traitId`: Selectorが選択した内部識別子。プレイヤー公開を意味しない。
- `selectionPolicy`: 親Selection Policyのidentity。
- `generationPolicy`: 実際に解決されたConcrete Blueprint Policyのidentity。Blueprint snapshot内の`generationPolicy`と一致しなければならない。

IDは小文字英数字とハイフン、versionは1以上の整数に限定する。余分・不足フィールド、未知schema、重複Stage、Stage不一致、Concrete Policy identity不一致を拒否する。正式Traitカタログは未決定なので、v1はIDの構文を検証するが、`medium-core`等のDevelopment名を本番候補として固定しない。

内部snapshotとGameState上の保存値は深くfreezeする。`getSnapshot()`は外部変更が内部へ波及しないdetached copyを返す。

## 3. 保存しない情報

v1は次を保存しない。

- Trait候補一覧とweight
- Selection Policyのseed namespace
- 派生方式と派生seed
- RunSeedの重複コピー
- Concrete Policyの全候補構成

したがって、Provenance単体から過去の抽選を完全に再実行したり、当時の全候補・確率を復元したりはできない。これは意図した境界である。最終A/B/C構成とRunSeedはBlueprint、抽選定義はversion管理された外部Policy資産の責務であり、復元時にはどちらからも再生成しない。

## 4. Lifecycle接続と冪等性

既存`EnemyArmyBlueprintLifecycleService`を関連付けの唯一の書き込み境界として拡張した。Blueprint modelまたはLifecycle envelopeのschemaは変更していない。

- `registerBlueprint(stageId, blueprint, provenance?)`: Blueprintだけの既存呼び出しを維持する。Provenanceを明示した場合は、両snapshotとStage/Concrete Policy整合性をすべて検証してから同期的に関連付ける。
- 同一Blueprint＋同一Provenance: `registered:false` / `provenanceRegistered:false`で冪等。
- 同一Blueprint＋異なるProvenance: 拒否し、既存状態を変更しない。
- Blueprintのみの旧状態＋明示的Provenance: 整合する場合だけ追加関連付けできる。Seedや構成から自動推測しない。
- `getProvenance(stageId)`: detached immutable modelまたは`null`。
- `getProvenanceSnapshot()`: detached registry envelope。
- `restoreSnapshot(blueprintState, provenanceState?)`: 両方を事前検証してauthoritative replacementを行う。第2引数省略は旧形式として来歴なしを意味する。

Provenance用の小さなRegistry envelopeはStageごとに一件だけ保持する。Blueprintの複製や第二の軍構成正本は持たない。

## 5. Save schemaと互換性

既存のBlueprint schema v1と`enemyArmyBlueprintState` Lifecycle envelope v1は変更しない。新形式はGameState saveへ次のoptional additive fieldだけを追加する。

```json
{
  "enemyArmyTraitProvenanceState": {
    "schemaVersion": 1,
    "provenances": [
      {
        "schemaVersion": 1,
        "stageId": 1,
        "traitId": "development-trait-id",
        "selectionPolicy": { "id": "selection-policy-id", "version": 1 },
        "generationPolicy": { "id": "concrete-blueprint-policy-id", "version": 1 }
      }
    ]
  }
}
```

Provenanceが空ならSerializerはこのfieldを出力しないため、未登録RunとBlueprint-only saveの既存形状は変わらない。

互換性契約は次のとおり。

| 保存状態 | 結果 |
|---|---|
| Blueprintなし・Provenanceなし | 旧saveとして復元 |
| Blueprintあり・Provenanceなし | Blueprintを復元し、来歴不明のまま保持 |
| Blueprintあり・正常Provenanceあり | 両方を関連付けて復元 |
| Blueprintあり・不正/競合Provenanceあり | world変更前に検証エラー |
| Blueprintなし・Provenanceあり | orphanとして検証エラー |

Hydrationは両envelopeをbase worldの適用前に検証する。base hydrationが失敗した場合も準備済みのBlueprint/Provenanceを適用しない。History SnapshotとRollbackは既存のSerializer/Hydrator経路を再利用するため、保存・復元失敗後も直前の関連付けへ戻る。

## 6. 既存システムへの非干渉

- Trait選択とBlueprint生成は明示的Development/Test経路だけで行う。
- 登録、保存、復元、History restoreは`Math.random()`、Gameplay RNG、Check RNG、Selector用RandomSourceを消費しない。
- TrueEnemyStateとKnownEnemyStateへProvenanceを転記しない。
- Trial1は従来の基本総制圧力20・1部隊を使用する。
- FirstRun Stage1のVerse1からTrial1、Post-Trial、Stage2までの既存進行を変更しない。
- Stage2用Blueprint/Provenanceを生成しない。

## 7. エラー契約

Domain不正は`ENEMY_ARMY_TRAIT_PROVENANCE_*`、LifecycleのStage/重複競合は`BLUEPRINT_LIFECYCLE_PROVENANCE_*`で同期throwする。主要な拒否条件は、snapshot shape/schema、ID/version、Stage、duplicate Stage、orphan、Concrete Policy mismatch、既登録Provenance conflictである。黙示修復、default Trait補完、Seed逆算は行わない。

## 8. 検証範囲

- Domain: 正常/不正snapshot、JSON round-trip、detached ownership、Stage/Policy整合性、冪等登録、競合、orphan。
- Persistence: Serializer/Hydrator、旧save、Blueprint-only save、provenance-only拒否、事前検証の原子性、History capture/restore/rollback。
- Integration: Selector結果から最小Provenanceを作り、同じConcrete Policy identityのBlueprintへ明示登録。
- Non-interference: 通常Run非接続、RNG/Truth非干渉、Trial1回帰、canonical FirstRun Stage1完走。

実ブラウザ描画とGameplayの面白さは、このデータ契約TASKの検証対象外である。

## 9. リスクと後続判断

**① 懸念点・リスク:** v1はPolicy identityを保存するが、Policy本文やweightを保存しない。同じID/versionの内容を後から書き換える運用を許すと、監査時に当時の候補分布を復元できない。また、traitIdは内部情報であり、そのまま公開すると未観測Truthを漏らす。

**② 対応策・代替案:** 正式Policy採用時はimmutableなversioned assetとして管理し、内容変更時にversionを上げる。調査公開はKnownEnemyStateへの別の観測契約として後続TASKで設計し、Provenanceを直接UIへ渡さない。抽選監査にseed namespaceや候補集合まで必要と正式決定された場合は、Provenance schema v2としてmigrationを設計する。

**③ 総括判定:** Blueprint正本性と既存snapshot契約を維持したまま、Stage単位の最小来歴を保存・復元できる。旧saveと来歴不明Blueprintを許容し、不正・競合・orphanだけを拒否する。本番Trait候補、weight、Gameplay因果、調査公開は未決定のまま分離されている。
