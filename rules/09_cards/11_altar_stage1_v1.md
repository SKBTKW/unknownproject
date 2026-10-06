# 祭壇 — Stage1 基本特殊ブロック

Status: IN PROGRESS / VALIDATION（HQ近郊配置改訂TASK、未push・未統合）

- Card: CMD_ALTAR / Altar、Stage1以上、UC、初期weight 0.25。
- カードcostは空。Board-owned建設quoteは🌾10・🧱30。
- 公開済みの正の✨産出があるセルに8方向で隣接する未配置セルへ独立生成。
- 配置先はHQ周囲8セルの近郊内にある未配置セルのみ。外側へのfallbackなし。
- Special Blockの共通隣接合法性を踏襲。Eは建設参照セルから継承、GL1。
- Base Terrainは生成しない。special-only、地帯化不参加、直接Trial Bonusなし。
- 全既存祭壇からChebyshev距離3以上。直交・斜めとも間に2マス空ける。
- 各Stageで新規建設1基。以前のStageの祭壇は存続。近郊内の最大距離は2のため、既存祭壇が近郊に残る限り2基目は配置できない（Run全体capではない）。
- 建設Stageを通常Special Block entityに保存。カードStage使用台帳も共通経路で更新。
- 現在の8方向隣接セルで、✨の正産出があるセル1つにつき✨+1/T、1基最大+3。
- 同一セルの地形・資源・施設の産出が重なっても計数は1。産出量や近郊倍率は計数を増やさない。
- 地形・発見済みソケット・解決済み地帯変換・機能中Special Blockの正本投影を参照。
- 本営、祭壇、未配置地形、未発見/未解決ソケットは対象外。
- 隣接関係・産出が変われば都度再計算。DYSFUNCTIONAL等は共通functional gateに従う。
- Offeringは支払い可能、Stage使用未消費、legal execution targetありの場合のみ。
- Previewは無消費。Commitは既存atomic payment、post-payment stale revalidation、rollbackを使用。
- Save / Restoreは既存entity・Stage使用台帳を使用し、追加産出を保存値に二重計上しない。

Stage2以降の発展カードによる上限拡張は設計候補。基本祭壇には先行実装しない。

検証: scratch/test_stage1_altar_v1.mjs（supplemental）。
weight比較は同じ合法Stage1候補プールの条件付き単発抽選で0.15/0.25/0.35を比較。
実プレイでの資源発見率、3枚Offering、リサイクル込みの出現率とは区別する。
