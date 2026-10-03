# 開墾・施設保持上限（2026-10-03 暫定）

ユーザー指定の暫定値。バランス確定値ではない。

- 基本保持上限：🌾150 / 🧱150（ユーザー選択）。✨・🔥・🛡️には本変更を適用しない。
- 《開墾》：Stage1解禁、🧱30、FARM基礎🌾6、1基につき🌾保持上限+20。
- 直接開墾：配置済みGL1_PLAINS、HQ不可、Special Block重複不可。
  Base Terrain identityを保持。農場が基礎土地産出を置換し、4+6の二重加算をしない。
- 拡張開墾：草原 / 有効FARMから直交隣接の未配置マスへ1×1FARMを生成。
  孤立条件なし。FARMから連続拡張可能。毎回カードと🧱30が必要。
- Eは起点からコピー、GL1。通常の施設隣接合法性を適用。
- FARMは地帯構成・連結・LINKの対象外。既存地帯の構成セルを農場化すると、その地帯を解除。
  過去に獲得済みの地帯 / LINK一時報酬は巻き戻さない。
- 直交隣接のCAT_GRAIN資源が1つ以上あると🌾+1固定。斜め・FARM自身は対象外。
  資源は消費しない。保持上限には影響しない。
- 《開墾》Offeringは合法対象と🧱30支払い能力を両方要求。実行時再検証、失敗時支払いを残さない。
- 製材所LOGGING_CAMP：有効1基につき🧱保持上限+50。
- 追加容量はBoardの有効施設から導出。カード使用カウンターを永続加算しない。
- 成功ActionのCommitとVerse精算境界で超過分を失う。
  Verseは収穫→維持費精算→保持上限の順。HUDは現在量 / 上限を表示。
- 本TASKは未統合の製材所修正TASKを依存として含む。
- 旧GRANARYの維持費軽減・Trial配備費の再調整は本TASKの変更範囲外。

検証：focused、関連統合、Stage1 E2E、Full Inspectionで確認する。

## 検証結果

- 開墾 focused（直接 / 連続拡張 / 支払い / 穀物 / 地帯 / 容量 / 保存復元 / 維持費後の超過処理）：PASS。
- Board特殊ブロック、Card Core / Offering、製材所bridge：PASS。
- Stage1収支：8 seed、Verse1–15、上限超過の収支内訳を含めPASS。
- FirstRun Stage1 completion certification：23 PASS / 0 FAIL。
- Full Inspection：Layer 3の `test_stage1_trial1_live_experience_audit.mjs` でFAIL。
  暫定基本容量150によってheavy配備費の回収期間が1.75–3.36節となり、
  既存authoring anchor 4.50–6.80節を下回る（分類D：バランス評価）。
  Trial配備費・閾値を変更せず、数値再評価TODOとして残す。
- 実ブラウザ描画：未検証。TASK未push / 未統合。全体Completion成立とはしない。
