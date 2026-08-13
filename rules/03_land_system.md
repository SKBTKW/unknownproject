# 03. 土地システム (Land System) 確定仕様・概要

本仕様書群は、土地ブロックの配置、1マス基礎産出、ソケット資源、湖、拠点、マージ合体パズルのすべての確定仕様を定義します。

詳細仕様は、以下の [`03_land_system/`](file:///C:/Users/mam07/.gemini/antigravity/scratch/unknownproject/rules/03_land_system/) サブフォルダ内の各ファイルを参照してください。

---

## 📂 サブ仕様書一覧 (Sitemap)

1. **[`01_land_base.md`](file:///C:/Users/mam07/.gemini/antigravity/scratch/unknownproject/rules/03_land_system/01_land_base.md)**:
   - **1マス基礎産出完全マトリクス**: H1〜H3 ✕ GL0〜GL3 の 13 パターン確定数値。
   - **★ ソケット持続収入一覧**: 5 大カテゴリ ✕ 地形風土連動の追加産出。
   - **清湖 (Lake) 仕様**: オアシス開花 ＆ 灌漑バフ (+50%) ＆ 泥濘減衰 (-30%)。
   - **高度 ✕ 気候 二重ギャップ配置制限**: H1-H3間(丘陵要) ＆ GL0-GL2/3間(草原要) の直接隣接不可ルール。

2. **[`02_outpost_system.md`](file:///C:/Users/mam07/.gemini/antigravity/scratch/unknownproject/rules/03_land_system/02_outpost_system.md)**:
   - **拠点 (Outpost) 確定仕様**: 第 1 試練突破後解禁 ✕ 3 マス離隔 ✕ 未配置グリッド建設 ✕ 前線開拓ハブ ✕ **3×3拠点圏開発 ＆ 前線要塞コンプリートボーナス (🛡️+10 / 🔥+3)** ✕ コスト漸増。

3. **[`03_merge_system.md`](file:///C:/Users/mam07/.gemini/antigravity/scratch/unknownproject/rules/03_land_system/03_merge_system.md)**:
   - **4マス マージ合体仕様**: H1: 2×2のみ, H2: 2×2 ＆ L字, H3: 2×2 ＆ 凸字 の固定役割分担。
   - **産出計算**: 1.2 倍ボーナス (土地基礎のみ適用 / ソケット固定加算) ✕ 即時一括祝儀。
   - **ジグソー噛み合わせ ＆ 密着面数ボーナス**: L字/凸字のフィッティング祝儀 (🧱+15) ＆ 隣接面数比例バフ。

- **新機能実装予定案**:
  - **盤面段階的グリッド到達ボーナス (Territory Milestone)**: 50% / 80% / 100% 全埋め達成時の段階的産出・防衛・迎撃ポイント加算。
  - **土地グラデーション配置ボーナス (Gradation Harmony)**: 高度 (H1➔H2➔H3) や気候 (GL0➔GL1➔GL2) のなだらかな連続接続への加算防衛・産出ボーナス。

* **[`04. 2D6 土地探索 確定詳細仕様書`](rules/03_land_system/04_exploration_system.md)**: 🔥-1コスト、出目テーブル(不発なし)、ソケット一元化、探索完了バッジ表示。
