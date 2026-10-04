# 周囲探索：世界情報の所有境界監査 v1

Status: AUDITED / 接続方針は提案。Gameplay、世界生成、保存形式の追加は未実装。
基準: AoT261002 / 3a6dd74a694be245bd4badce387bdc3ed7eb79af。

## 現在の正本と責務

| 情報 | 現在の正本 | 今回の判断 |
| --- | --- | --- |
| 初期盤面・Socketの存在フラグ | `game/src/core/world_initialization_service.js` | 未知土地や資源のDiscovery catalogではない |
| 土地配置時のSocket資源決定と結果キャッシュ | `game/src/systems/grid_engine.js` | 地形依存で資源を選ぶ。未解決Socketを既存資源identityとして調査しない |
| 通常LANDのマスターとOffering | `game/src/systems/deck_manager.js` / LAND data | 通常LAND候補を維持。調査専用世界catalogへ転用しない |
| 敵の観測可能情報 | `game/src/warning/systems/enemy_observation_projector.js` | 敵側から提供されたobservableだけを既存Investigationへ渡す |
| 敵情報履歴 | KnownEnemyState | World Discoveryと混ぜない |
| 世界観測情報の受け渡し | WorldObservationProjector | 明示されたobservable.observationsだけをimmutable profileへ投影 |
| 調査候補 | collectWorldObservationCandidates | 既存strict ConditionEvaluatorで絞る。存在情報は生成しない |
| 世界発見履歴 | DiscoveryLedger | 観測済みreportの保存。未知世界の存在正本ではない |
| 保存復元 | state_serializer.js / hydrate_game_state.js | DiscoveryLedgerは対応済み。未知世界catalogの保存は未対応 |
| Discovery条件の判定 | ConditionEvaluator / DISCOVERY_RECORDED | 共通条件は実装済み。実製品カードの解禁や解除済み記録は未接続 |

## 接続する際の一方向契約

1. 世界側の所有者が「存在する対象」と安定したidentityを保持する。
2. 世界側の観測ポリシーが、その時点で渡してよい情報だけをobservableへ出す。
3. Projectorがallowlistでコピーし、候補境界がEligibilityを適用する。
4. 将来Resolverが候補から選び、Reportを確定する。
5. 世界情報はDiscoveryLedger、敵情報はKnownEnemyStateへ記録する。
6. Offeringは記録済みDiscoveryの共通条件を参照する。

UI、Investigation候補境界、Report、Offeringから世界の存在を決定しない。
未配置グリッド・未解決Socket・カードマスターは未知世界identityの代用品にしない。
観測可能かとOffering解禁済みかも別契約とする。

## 最小接続候補（SCHEDULEDではなく提案）

初回の実データ接続はTHREATを候補とする。既存の敵観測Projector、source facet
policy、KnownEnemyStateとFirstRun導線を再利用できるため。
足跡・野営跡・斥候目撃はTHREATの観測元であり、世界Discoveryへ変換しない。
ただし現行カードを削除するには《周囲探索》実行経路と保証枠の置換が必要。
今回その置換、通常Run解禁変更、RNG、2D6、カード追加は行わない。

## 未決定事項 F：世界Discoveryの実データ接続を止めるもの

- 未知世界の存在を保持するDomainと寿命（Run単位・Stage単位など）。
- 各対象の安定identityと、存在確定のタイミング。
- ownerから出すobservableのポリシーとEligibility。
- Discoveryと実際のOffering解禁の対応、解除済みの追跡。

これらはFirstRun Verse1→Stage2を止めないため、現段階では製品仕様を決めない。
新しいRun state field、生成確率、Discovery catalog、セーブ移行を追加しない。

## 将来実装の検証条件（未実装 TODO）

- 存在情報の保存復元でidentityと観測候補を維持し、再生成・再抽選しない。
- 未知情報をPresentationやKnownEnemyStateへ漏らさない。
- 基本結果は最低1件。同カテゴリの任意追加投資でShared CheckSystemを1回だけ使う。
- 追加支払い・Check・immutable reportの確定を同じtransactionとして扱う。
- 再確認と新規発見、宣言上の将来解禁と実際のOffering候補追加を区別する。
- 通常LAND Offering、FirstRun Verse7→Verse8、Stage1完走を維持する。
