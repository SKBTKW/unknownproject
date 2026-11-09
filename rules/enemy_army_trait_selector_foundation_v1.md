# Enemy Army Trait Selector Foundation v1

> Phase 7で、Blueprintとは別のoptionalな`EnemyArmyTraitProvenance`保存契約が追加された。現行契約は`enemy_army_trait_provenance_persistence_v1.md`を参照すること。本書の「保存しない」はPhase 6完了時点の境界記録である。

- Status: **IMPLEMENTED FOUNDATION / PRODUCTION DISCONNECTED**
- Target / base: `AoT261029` / `084827d8ee214d5f0eb729de4ec4ddf50003eeef`
- Task: `aot-task/AoT261029/trial/enemy-army-trait-selector-foundation-v1`
- Phase 5の`medium-core`、`large-leaning`、`small-leaning`と6/2/2はDevelopment/Test fixtureであり、本番仕様ではない。

## 1. 責務と非責務

本Foundationは、`RunSeed + Stage + 明示的Trait Selection Policy`から軍団特性を一度選び、明示的bindingを介して既存`EnemyArmyBlueprintGenerator`用の具体Policyを解決する純粋基盤である。SelectorはBlueprintを生成せず、ResolverはTrait名からPolicyを推測しない。Generatorは従来どおりA/B/Cの最終構成を生成する。

```text
RunSeed / Stage / explicit Trait Selection Policy
                 |
                 v
       Enemy Army Trait Selector
                 |
                 v
 immutable selection (trait + concrete policy identity)
                 |
                 v
 explicit trait/policy binding -> Policy Resolver
                 |
                 v
 existing EnemyArmyBlueprintGenerator -> saved Blueprint snapshot
```

本番Bootstrap、GameEngine、Stage Adapter、Truth、Known Enemy、Trial、UIには接続しない。通常Runは従来どおり明示的なBlueprint生成Policyがない限り`POLICY_NOT_CONFIGURED`であり、Trait Selection Policyだけを渡しても生成しない。Stage2/3のBlueprint生成も有効化しない。

## 2. Trait Selection Policy

Selectorに既定Policyはない。呼び出し元は次の完全なPolicyを渡す。

```js
{
  id: 'selection-policy-id',
  version: 1,
  seedNamespace: 'versioned-independent-stream-v1',
  traits: [
    {
      traitId: 'trait-id',
      weight: 1,
      generationPolicy: { id: 'concrete-blueprint-policy-id', version: 1 }
    }
  ]
}
```

`traits`はTrait候補、正の有限weight、選択後に要求する具体的Blueprint生成Policy identityを明示する。ID、version、namespace、重複Trait、weight、余分・不足フィールドは生成前に検証する。Foundation本体にはTrait候補、抽選weight、種族・装備構成を置かない。

`seedNamespace`は独立系列の衝突防止と派生方式の監査用である。Policy内容を変える場合はPolicy versionも更新する運用を前提とする。Phase 5診断は既存の`enemy-army-distribution-army-trait-v1` namespaceをDevelopmentアダプタから明示し、既存10,000 Seed結果を維持する。

## 3. Selector結果と不変性

`selectEnemyArmyTrait()`の結果は深くfreezeされた次のデータである。

```js
{
  runSeed: 42,
  stageId: 1,
  traitId: 'trait-id',
  selectionPolicy: { id: 'selection-policy-id', version: 1 },
  generationPolicy: { id: 'concrete-blueprint-policy-id', version: 1 },
  reproducibility: {
    derivation: 'fnv1a-mulberry32-v1',
    namespace: 'versioned-independent-stream-v1',
    seed: 1234567890
  }
}
```

入力Policyは変更しない。`runSeed`、`stageId`、Policy identityとnamespaceからFNV-1aでuint32 seedを派生し、新しい`RandomSource`を1個だけ生成してweighted selectionを行う。`Math.random()`、Gameplay RNG、Check RNG、Blueprint各枠のRNG系列を消費しない。同一入力は同じ結果になり、呼び出し順やUI・時刻に依存しない。

FNV-1aの実装は`enemy_army_seed_derivation.js`へ集約した。既存Generatorも同じhelperを使用するが、従来の`enemy-army-blueprint-v1` tupleは変更していないため、既存Blueprint系列は変化しない。

## 4. 明示的Policy Resolver

Resolverは次のbinding配列を要求する。

```js
[
  {
    traitId: 'trait-id',
    generationPolicy: {
      id: 'concrete-blueprint-policy-id',
      version: 1,
      slots: { A: [], B: [], C: [] }
    }
  }
]
```

Resolverはselectionの`traitId`と`generationPolicy.id/version`をbindingの両方へ照合し、既存`validateEnemyArmyBlueprintGenerationPolicy()`で完全Policyを検証する。未知Trait、identity不一致、重複binding、不正weight・compositionは拒否する。返却する完全Policyも複製して深くfreezeする。したがって`traitId`だけから命名規則でPolicyを組み立てたり、暗黙の既定値を選んだりしない。

## 5. Blueprint、保存・復元との境界

Selector結果は生成時の一時的な判断であり、現行save schemaへ追加しない。Resolverで得た具体Policyを既存Generatorへ渡すと、Blueprint snapshotには従来どおり最終A/B/C構成と具体Policyの`id/version`が保存される。その保存済みBlueprintが復元後の実態の正本である。

復元時はSelectorを再実行しない。旧saveにBlueprintがなければ、同じRunSeedからTraitやBlueprintを補完しない。現行Lifecycleの「保存済みBlueprint優先・欠落は未登録」を維持する。

現行schemaは最終構成と具体Policy identityを保持する一方、親Selection Policy identity、traitId、派生namespaceを監査用事実として保存しない。将来それらをsave後も直接参照する必要が正式決定された場合の最小拡張は、Blueprintのversioned generation metadataまたはLifecycle内の同Stage記録として次を保存することである。

- `selectionPolicy.id/version`
- `traitId`
- `generationPolicy.id/version`
- 派生方式とnamespace（必要な場合）

この拡張はschema migration、旧saveの「unknown provenance」表現、既存Snapshot優先規則を同時に設計する別TASKとする。seedからの黙示再計算は採用しない。

## 6. Phase 5アダプタとの関係

Phase 5の二段階E案から、決定的weighted selectionと具体Policy解決だけをFoundationへ抽出した。大量Seed集計、距離、予測可能性、分布レポートは引き続きDevelopment専用診断に残す。既存診断はSelector/Resolverを呼ぶため、同じweighted selectionを第二実装として持たない。

Development fixtureのTrait名・6/2/2 weight・種族装備候補は`scratch`側だけに存在し、本番Runtimeから自動参照されない。

## 7. リスク、対応、判定

**① 懸念点・リスク:** Traitを選べること自体はGameplay価値を保証しない。現行saveはTrait来歴を直接保存しないため、復元後にtraitIdをUIや因果へ使う要求が追加されるとschema拡張が必要になる。また、Policy内容をversion据え置きで変えると同じidentityでも結果が変わる。

**② 対応策・代替案:** 本番採用前にTrait候補・weight・種族装備構成を正式承認し、immutableなversioned assetとして管理する。来歴がGameplayで必要になる時点で、seed再抽選ではなく保存metadataを追加する。現段階は明示的Policyを持つDevelopment呼び出しだけに限定する。

**③ 総括判定:** Selector、Resolver、既存Generatorの境界は独立して検証可能になった。保存済みBlueprintの正本性と既存Trial非干渉を維持している。ただし本番weight、通常Run接続、Stage2/3、Truth/調査/戦術因果は未実装であり、本FoundationだけではGameplay変更は発生しない。

## 8. 検証範囲

- Unit: 同一入力、seed差、weight分布、identity、入力/出力不変性、不正Policy、未知Trait、Resolver binding、`Math.random()`禁止。
- Integration: Selector -> Resolver -> Generator、A/B/C identity、Gameplay/Check RNGとTruth非干渉、JSON保存・復元、旧save欠落。
- Regression: 通常Run非接続、Trial1の制圧力20・1部隊、Bootstrap非接続。
- 既存回帰: Phase 5分布診断、Blueprint/Lifecycle/Bootstrap/Stage Adapter、FirstRun Stage1完走、Full Inspection Layer 1〜6。

実ブラウザ描画とGameplayの面白さは、このデータロジックTASKの検証対象外である。
