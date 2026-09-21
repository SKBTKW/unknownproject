# AoT 開発プロトコル ＆ ガードレール仕様書 (AGENTS.md)

本ドキュメントは、リポジトリにおける安全な協調開発、Git 事故の抑止、アーキテクチャ整合性の維持、および AI の自律暴走を防ぐための絶対遵守プロトコルである。

---

## 1. 🛡️ 絶対安全規則 (Absolute Safety Rules - MUST)

いかなる場合も例外なく厳守しなければならない最上位の規則。

1. **ユーザー明示承認なき Git Push の絶対禁止 (MUST)**:
   - 事前に変更内容（ブランチ名、コミットメッセージ案、差分概要）を提示し、ユーザーからの明示的な承認（「push」等の文字列を含む指示）を得るまで、いかなる理由があっても `git push` コマンドを発行してはならない。
2. **破壊的 Git 同期コマンドの禁止 (MUST)**:
   - 未確認状態での無条件な `git pull`、`git reset --hard`、`git rebase`、`git merge` の実行を禁止する。
3. **ユーザー所有未コミット資産の保護 (MUST)**:
   - ワーキングツリー上に存在する未コミット差分（`game/images/crisis.png` やユーザー作業中のファイル）を、勝手な stash、checkout、reset、上書きによって破棄・改変してはならない。
4. **虚偽・パターン推測報告の絶対禁止 (MUST)**:
   - 未検証の動作を「確認済み」と報告したり、架空のコミットハッシュや実行結果を捏造して報告することを禁止する。検証不能な項目は「未検証」と明示しなければならない。

---

## 2. 🌿 Git 運用プロトコル (Git Preflight & Workflow)

作業開始時、およびブランチ操作時の安全手順。

### 2.1 作業開始前 Git Preflight シーケンス
コードや仕様を読み込み・作業を開始する際は、**無条件な `git pull` を行わず**、必ず以下のシーケンスで状態を確認する。
1. `git status` ＆ `git diff`: 作業対象ブランチ、および未コミット差分（`crisis.png` 等）の有無を確認する。
2. `git fetch origin <branch>`: リモートの最新リビジョン情報を安全に取得する（ワーキングツリーは変更しない）。
3. `git status -uno`: local と remote の関係（up to date / ahead / behind / diverged）を確認する。
   - **DIRECT**: 同名 `origin/<branch>` に対する behind / diverged は STOP。勝手に pull や rebase をしない。
   - **ISOLATED**: 記録したtarget基点の不一致は既存の厳格ルールどおり STOP。
   - **TASK**: `origin/<target>` の前進は `TARGET_DRIFT` として記録し、通常作業は CONTINUE。自動 pull / merge / rebase はしない。同名 `origin/aot-task/...` がlocal TASKに含まれない更新は `REMOTE_TASK_DRIFT` として STOP。記録基点がtarget履歴から失われた `BASE_REWRITE` も STOP。
4. ユーザーが指定した統合先ブランチをclone-local設定へ記録する: `git config --local aot.authorizedBranch <branch>`。
   - この設定の新規作成・変更は、ユーザーが作業ブランチを明示した場合に限る。
5. ファイル編集前に `python scratch/pre_write_linter.py` を実行し、`GIT001` が出た場合は作業を開始せずユーザーへ確認する。

### 2.2 作業モード（DIRECT / ISOLATED / TASK）
- **DIRECT**: 小規模な単独作業用。`aot.authorizedBranch` と同名の `origin/<branch>` を追跡する統合先ブランチで直接作業する。
- **ISOLATED**: 未コミット資産保護または破棄可能な実験用。`aot-tmp/<target>/<task-id>` を別worktreeで使用し、remote upstreamを設定・pushしてはならない。
- **TASK（並行作業の既定）**: 統合対象となる短命作業用。`aot-task/<target>/<domain>/<task-id>` を最新 `origin/<target>` から別worktreeに作成する。
- ブランチ／worktreeの作成はユーザーがそのタスクを承認した場合に限る。lintは検証のみを行い、作成・同期・統合・削除を実行しない。
- 複数worktreeの認可情報を衝突させないため、`extensions.worktreeConfig=true` を使用し、モード固有値は `git config --worktree` へ記録する。
  - `aot.workMode=DIRECT|ISOLATED|TASK`
  - `aot.authorizedWorkBranch=<ISOLATED branch>`
  - `aot.authorizedTaskBranch=<TASK branch>`
  - `aot.authorizedBaseCommit=<verified origin target HEAD>`
- TASKは初回push前のみupstreamなしを許容する。push後は同名の `origin/aot-task/...` だけを追跡でき、`origin/<target>` をupstreamにしてはならない。

### 2.3 TASK ライフサイクルと統合キュー
1. `git fetch origin <target>` 後の `origin/<target>` SHAを基点として記録し、専用worktreeを作る。
2. 作業開始前に、Task ID、担当、目的、対象ファイル、共有ファイル、対象外を申告する。
3. タスク外の修正を混ぜない。本番変更とテスト基盤修正は意味単位でコミットを分ける。
4. focused test後、未追跡・未コミットファイルのないcleanなTASK worktreeでFull Inspectionを実行する。
5. タスクブランチpush後は統合キューで `READY / WAITING_FOR_BASE_UPDATE / CONFLICT / TEST_FAILED / APPROVED / MERGED` のいずれかを管理する。
6. 通常作業では `scratch/task_health.mjs` によりTARGET_DRIFTと重なりを観測する。TARGET_DRIFTだけで作業を停止しない。shared surfaceまたはcontract overlapは後続統合のreconciliation対象として記録する。
7. 統合直前に `node scratch/task_health.mjs --integration-ready` でremote refsを最新化できることを確認し、続けて `python scratch/pre_write_linter.py --integration-ready` でTASKが最新 `origin/<target>` を包含していることを確認する。含まれなければ当該TASKだけを `WAITING_FOR_BASE_UPDATE` とする。
8. 本流が進んでいた場合、通常作業中の他TASKを止めない。統合順が来たTASKだけ最新本流とreconcileし、全検査を再実行する。Integration Guardがpeer overlapまで確認して独立READYと判定したTASKは、別のREVIEW_REQUIRED / BLOCKED TASKが存在してもそのTASK単体の統合を妨げない。
9. 統合可否の機械判定SSOTは Merge Decision Proof とする。Proofは対象target SHA、TASK SHA、PR head/base、clean merge preview、PR Full Inspection SUCCESSへ固定し、正常系に人手の再判定を追加しない。人間の判断はREVIEW_REQUIRED / BLOCKED / reconcileが必要な例外へ集中させる。統合実行そのものには従来どおり明示的な統合承認を必要とする。
10. 統合担当者は同時に一人とし、READY Proofを持つタスクを一件ずつ原則squash mergeする。統合後は対象ブランチ上のFull Inspection SUCCESSとmerged PR head SHA一致を確認する。
11. Merge Decision Proofと統合後検査が成立し、TASK headがProof生成時から動いておらず、TASK worktreeもcleanである場合、TASK remote branch / worktree / local branchを同じ統合ライフサイクル内で自動削除する。移動・dirty・lockなどの齟齬があれば削除だけを停止する。Task Sweeperはクラッシュ、手動merge、cleanup途中失敗、過去残骸の復旧用とする。未統合ブランチの強制削除を禁止する。
- `AGENTS.md`、`game/src/i18n.js`、`layout_config.js`、GameEngine、共通JSON、統合テストなどの共有ファイルは同時編集を避け、統合順を先に決める。
- TASK branchへのpush承認と、統合先branchへのpush承認は別の承認として扱う。

### 2.4 ブランチ・履歴保全
- 指定・認可されたモード以外のブランチを勝手に作成・切り替えてはならない。
- `git pull`、`git rebase`、通常merge、競合解消、force pushを自動実行してはならない。
- ISOLATEDの自動統合は、記録した基点から対象ブランチが動いておらず、対象worktreeがcleanで全検査合格の場合の `git merge --ff-only` だけを許可する。
- TASKの統合は統合担当と承認ゲートを経由し、作業担当が直接 `origin/<target>` へpushしてはならない。
- `git branch -D` による未統合ブランチの削除を禁止する。

---

## 3. 🎯 フェーズ・スコープ制御 (Phase & Scope Gate)

機能の段階的検証プロセスを守り、未成熟な機能の先走りを遮断する規律。

### 3.1 フェーズ境界の厳守
- 現在フェーズの「目的」および「成功条件」を超える機能を勝手に先行実装してはならない。
- 作業開始時に、現在のフェーズ範囲と対象外（Out of Scope）を確認する。
  - *例（Trial 開発）*: Phase 2.5（比較検証環境の実装済み）を踏まえ、Phase 2.6 は「実プレイ・挙動検証段階（IN PROGRESS / VALIDATION）」として扱う。この段階で戦術カード、2D6、本番Trial接続などの後続仕様を勝手にコードへ混入させてはならない。

### 3.2 確定仕様のステータス追跡
合意されたゲームルールは「今すぐ全部コードに書く」のではなく、以下のステータスで管理・追跡する。
- **IMPLEMENTED**: 実装完了・テスト通過済み。
- **IN PROGRESS / VALIDATION**: 現在フェーズの実装・検証対象。
- **SCHEDULED**: 仕様確定済みだが、次フェーズ以降に実装予定。
- **ON_HOLD**: 検討中・バランス調整中・未確定。
- **PROTOTYPE**: 開発用の一時モック（本番未接続）。

---

## 4. 🏛️ アーキテクチャ ＆ 概念責務分離 (Architecture & SSOT)

高品質で破綻のないコードベースを維持するための設計原則。

### 4.1 既存 SSOT 再利用義務 (Existing SSOT First)
- 新たな判定関数、コンバータ、データ定数、マッピングを追加する前に、**同一責務の既存正本（SSOT）が存在しないかコードベース内を必ず検索**する。
- 既存の正本が存在する場合はそれを優先再利用し、重複する第二の判定系（例: `areTerrainsZoneCompatible` があるのに独自の草原判定 helper を新設するなど）を勝手に作ってはならない。

### 4.2 概念責務の完全分離 (Concept Separation)
AoT のドメインロジックにおいて、以下の異なる概念を同一の変数、ID、または単一の boolean フラグで混同してはならない。
1. **Terrain (地形種別)**: マス本来の地形種類（`GL1_PLAINS`, `GL2_FOREST`, `E0_WETLAND` 等）。
2. **Feature / Socket (付加属性)**: 地形上に後から開花・付加された属性（`SOCKET_LAKE`, `SOCKET_OASIS` 等）。
3. **ZoneCategory (地帯化互換分類)**: 地帯（2×2等）を形成できる互換グループ（`PLAINS`: 草原＋干拓地 等）。
4. **Trial Context (試練固有分類・戦闘文脈)**: 試練システムにおける敵・迎撃・地形補正の文脈。
5. **Presentation (UI 描画状態)**: 画面表示用のクラスやスタイル（`cell-lake-source`, `merged` 等）。
- **禁止**: Feature（湖ソケット）の有無を、Terrain や ZoneCategory の地帯化互換判定へ混入させてはならない。また、Presentation クラスを参照してゲーム計算を行ってはならない。

### 4.3 Mobile & Unity Ready (ロジックと描画の完全分離)
- 将来の Unity (C#) 移植およびスマホ（縦・横持ち）レスポンシブ動作を見据え、「純粋データロジック」と「DOM/CSS 描画」を完全に分離する。
- `game/src/core/` および `trial/domain/` などの純粋ロジック層から、DOM API（`document`, `window`, `HTMLElement` 等）を直接参照してはならない。

### 4.4 地形データ SSOT 規律 (Terrain SSOT)
- 全地形の基礎産出・地勢パラメータは `game/src/data/land_system.js`（`TERRAIN_MATRIX` / `TerrainParameterEngine`）および `land_system.json` を Single Source of Truth とする。
- カードデータやロジックコード側で、独自の建前数値を勝手に捏造・上書きしてはならない。

### 4.5 カードマスターデータの完全 JSON 外部化
- ロジックコード（`systems/`, `ui/`, `core/` 等）内に、カードマスターデータ配列（`COMMAND_CARDS_MASTER` 等）やオブジェクト定義を直書き・ハードコードすることを禁止する。
- カードデータは必ず `game/src/data/*.json` の純粋データアセットとして一元管理する。
- `land_cards.json` に非 LAND カードを混入させてはならない。また、廃止指定された旧カード ID をデータ資産に残存させてはならない。

---

## 5. 🎨 UI ＆ スタイル規律 (UI & CSS Policy)

画面の堅牢性と保守性を担保するためのスタイル規則。

### 5.1 レイアウト中央管理の絶対義務 (`layout_config.js`)
- UI パーツの位置（position）、サイズ（width/height）、配置（flex/grid 配置値）を変更する際は、HTML への直接インラインスタイル記述や場当たり的調整を禁止し、必ず `game/src/ui/layout_config.js` の中央定義（SSOT）にて一括管理・更新する。
- 色、ボーダー、アニメーションなどの純粋な視覚装飾は CSS クラス側で管理し、役割を分担する。

### 5.2 CSS カスケーディング規律 ＆ 新規 `!important` の禁止
- **新規 `!important` の禁止**: 新規追加・改修する CSS において、`!important` による安易な強制上書きを禁止する。排他スコープセレクタ（`:not()` や独立ラッパークラス）を用いたクリーンな詳細度設計を行うこと。
- **既存負債の扱い**: 既存コードに残存する `!important` 負債は段階的リファクタの対象として追跡し、今回の作業で無関係な箇所を一括破壊してはならない。

### 5.3 インラインスタイルの制限と例外
- HTML タグ内の生インラインスタイル属性（`style="..."`）の新規記述を禁止する。
- JS からの `.style.cssText =` や静的プロパティ操作は原則禁止とし、CSS クラスの切り替えで行う。
- **正当な例外**: カメラ操作（`transform` 座標）、ドラッグ追従、動的ポップアップ配置など、実行時のミリ秒単位の座標計算に限り、直接スタイル操作を許容する。

---

## 6. 🌐 ローカライズ規律 (I18N Rules)

1. **日本語テキストの直接埋め込み禁止**:
   - ランタイム JS コードおよび HTML テンプレート内への日本語文字列の直接ハードコードを禁止する。
2. **I18n 辞書経由の取得**:
   - 画面上に表示するすべてのユーザー向けテキストは、`game/src/i18n.js` に辞書登録し、`I18n.t('KEY')` 経由で取得する。
3. **生文字列連結の抑制**:
   - `I18n.t('KEY') + 'の詳細'` のような安易な生日本語の連結を避け、辞書側でプレースホルダ化を行う。

---

## 7. 🧪 検証 ＆ Testing Fallback (Testing & Fallback Protocol)

確実な動作確認と、環境制約時の透明性を担保するプロトコル。

### 7.1 ドメインロジックテストの義務
- 経済計算、土地配置、地帯化（マージ）、Trial 迎撃・戦闘計算などのゲームルールを変更した際は、必ず Node.js 単体テスト（`scratch/test_all_modules.mjs` 等）を実行し、変数の推移と計算結果を実証する。

### 7.2 Testing Fallback プロトコル (実行不能時の開示手順)
- 実機ブラウザ検証（Playwright や特定ブラウザ環境）が必要な場面において、リポジトリ内に実行環境や依存パッケージが存在しない場合：
  1. 勝手に未承認の外部パッケージを新規インストールしてはならない。
  2. JSDOM ライフサイクルテスト（`test_ui_lifecycle.mjs`）や代替単体テストを実行する。
  3. **「実機確認完了」と偽らず、検証済み範囲と未検証範囲を正確に報告する。**
     - *報告例*: 「ロジックテスト: PASS (344 tests) / DOM ライフサイクル: PASS (177 tests) / 実ブラウザ描画: 未検証 (Playwright 環境不在のため)」

---

## 8. 🤖 自動検査体系 (Automated Guardrails)

本リポジトリで実際に配備され、機械的に保証されている検査体系。

### 8.1 高速静的 Linter (`scratch/pre_write_linter.py`)
作業完了前・Push 提示前に自ら実行する日常ガードレール（数秒以内で完了）。
- **I18N001**: ランタイムコード内の直接記述日本語の検知。
- **CSS001**: Git 変更行における新規 `!important` の即時遮断。
- **CSS002**: HTML 内の生インライン `style="..."` 属性の遮断。
- **CSS003**: JS 内での直接スタイル操作の警告（WARN）。
- **CARD001〜003**: ロジック層でのカード直書き、`land_cards.json` 純化、削除旧カード残存の検知。
- **ARCH001**: ドメインロジック層からの DOM API アクセス遮断。
- **GIT001**: DIRECT / ISOLATED / TASKの認可、命名、worktree分離、upstream、基点祖先関係を検証する。TASKの `TARGET_DRIFT` は通常作業を止めないが、`REMOTE_TASK_DRIFT` と `BASE_REWRITE` は停止する。`--integration-ready` ではTASKの同名remote追跡、最新本流包含、clean状態も必須化する。

### 8.2 自動仕様突合アサーション (`scratch/verify_all_rule_files.py`)
- 仕様書が要求する定数（土地産出値、初期リソース、マージ倍率等）と、エンジン・データ資産の実数値を 1:1 で厳密比較検証する。

### 8.3 統合検問パイプライン (`scratch/run_full_inspection.mjs`)
あらゆる作業の最終完了時に実行する一方向パイプライン。
- `Layer 1: Static Lint` ➔ `Layer 2: Spec Assertions` ➔ `Layer 3: Domain Unit Tests` ➔ `Layer 4: Trial Tests` ➔ `Layer 5: UI Lifecycle Tests` ➔ `Layer 6: Integration & Settlement Tests` を順次実行し、全レイヤーの合格を確認する。
- TASKの統合判定に使うFull Inspectionは、対象TASK以外の未コミット差分や未追跡ファイルが存在しない専用worktreeで実行する。dirtyな統合先worktreeの結果を代用してはならない。

---

## 9. 📢 対話 ＆ 報告規律 (Reporting & Communication)

事実に基づき、誠実で建設的な対話を維持するための規律。

### 9.1 禁止ワードリスト (Banned Word List)
以下のお世辞・感情煽り表現が含まれた出力は、自己検知により即座に破棄・再構成する。
> 鳥肌, 最高です, 天才的, 脱帽, 感服, 過去最高, 完璧な正解, 神がかって, 100%完全保証, 非の打ち所がない

### 9.2 3大構造化考察テンプレートの義務化
設計、意見、または課題への対応を求められた際は、形だけのベタ褒め・安易な迎合（イエスマン）を排除し、必ず以下のフォーマットで深層考察を行う。
> **① 懸念点・リスク** ➔ **② 対応策・代替案** ➔ **③ 総括判定**

### 9.3 検査結果の保証範囲の正確な記述 (誇大表現の禁止)
- 検査結果の報告において、「全仕様100%一致」「完全に完璧」などの保証範囲を超えた誇大表現を禁止する。
- 実際に実行したアサーション件数（例: `6/6 spec assertions passed`）やテスト合格件数（例: `344/344 domain tests passed`）を客観的数値で報告する。

### 9.4 ユーザー対話最優先の原則
- ユーザーからの指示・質問を受けた際は、AI が勝手に先走って無言でツール実行やファイル修正のループに没頭することを禁止する。
- まずユーザーの発言を 100% 最優先で受け止め、直接の回答・方針説明を行ってから作業を進めること。

---

## 10. 🔒 Push 承認ゲート実行手順 (Push Gate Protocol)

Git Push を安全に行うための機械的・運用的プロトコル。

### 10.1 Push 事前提示フォーマット
Push を提案する際は、必ず以下の情報をユーザーへ完全提示する。
```text
【Git Push 事前確認】
- Push種別: TASK branch / integration target
- 対象ブランチ: <branch_name>
- 統合先ブランチ: <target_branch>
- 基点コミット: <base_hash>
- コミットハッシュ: <short_hash>
- コミットメッセージ: <commit_message>
- 変更ファイル統計: <git diff --stat の出力概要>
- 自動検査結果: Layer 1〜6 ALL PASS
- 実ブラウザ検証: <確認済み / 未確認>
- 既知の制約: <none または列挙>
```

### 10.2 機械的承認ゲート
- ユーザーの直前発言に「push」の明示的文字列が含まれていない場合、システム的に `git push` コマンドの発行を自動拒否する。
- いかなる緊急時であっても、ユーザーの明示承認なしに Push を強行してはならない。
- TASK branchへのpush承認は統合先へのpushを許可しない。統合先への反映には、統合差分と統合後検査結果を提示した別の明示承認が必要である。
