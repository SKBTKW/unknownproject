# The Age of Trials — ルール

このディレクトリは、The Age of Trials に関する読み物を役割ごとに分けた入口です。

実装・数値・例外条件まで含む詳細仕様の正本は、既存の [`rules/`](../rules/) にあります。

ここでは次の3つを分離して扱います。

1. [`01_プレイマニュアル.md`](./01_プレイマニュアル.md)  
   **操作説明です。** 右クリックによる土地ブロック回転、マウスオーバーによる詳細確認、カード選択、Hold、Undo、`NEXT VERSE →` など、ゲームを操作するために必要なことだけを書きます。

2. [`02_ゲーム概念.md`](./02_ゲーム概念.md)  
   Verse、開発、地帯化、連携、Trial、残火など、ゲームを構成する概念を説明します。

3. [`03_コンセプト.md`](./03_コンセプト.md)  
   「盤面＝未来への投票」「これまで作ってきたものに、戦う意味を与える」など、本作の中心思想を説明します。

---

## マニュアルに書かないこと

プレイマニュアルには、操作に不要な内部仕様や攻略情報を載せません。

たとえば以下はマニュアルの範囲外です。

- カードが提示される内部条件
- Offeringの抽選方式
- Stageの進行条件
- Trialが接近・発生する条件
- 敵routeの生成規則
- 地帯化・連携の内部数値
- 強い土地やカード
- 推奨される盤面構築
- Trial前に何を準備すると有利か

これらは、開発用仕様または攻略情報として分離します。

---

## 詳細仕様について

競合した場合は、[`rules/`](../rules/) 内の各専門文書を優先してください。

主な正本:

- 全体: [`rules/01_overall_concept.md`](../rules/01_overall_concept.md)
- 資源・🔥: [`rules/02_resources_and_ember.md`](../rules/02_resources_and_ember.md)
- 土地: [`rules/03_land_system/`](../rules/03_land_system/)
- Offering / Hold: [`rules/04_draw_and_hand_system.md`](../rules/04_draw_and_hand_system.md)
- Trial: [`rules/05_trials_and_defense.md`](../rules/05_trials_and_defense.md)
- Global Event: [`rules/10_global_events.md`](../rules/10_global_events.md)
