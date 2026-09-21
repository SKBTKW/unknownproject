# scratch の検証・運用ガイド

このディレクトリには、継続利用するテスト・運用ツールと過去の調査資料が同居しています。
既存のファイル名、CMD/BAT、CI、import経路を維持しながら、テストの登録と実行を管理します。

## 日常のコマンド

リポジトリのルートから実行します。新しいパッケージのインストールは不要です。
CIはNode.js 22とPython 3.12を使用します。

```sh
# 台帳の整合性を確認（テスト本体は実行しない）
node scratch/scratch_registry.mjs --check

# 登録内容・既知の問題を一覧表示
node scratch/scratch_registry.mjs --list

# 追加検査のみ実行
node scratch/scratch_registry.mjs --run supplemental

# 従来の6層検査 + 台帳検証 + 追加検査
node scratch/run_full_inspection.mjs

# 未解決テストを明示的に再調査（失敗すれば非ゼロ終了）
node scratch/scratch_registry.mjs --run quarantined
```

`--json`を付けると、実行結果・終了コード・標準出力/標準エラーをJSONで取得できます。
出力の保存はリダイレクトで行い、保存先にはリポジトリ外の一時ディレクトリ等を指定してください。
台帳ランナーは作業ディレクトリに依存せずリポジトリを解決し、子プロセスのcwdも固定します。
各テストは30秒でタイムアウトします。起動失敗・タイムアウト・非ゼロ終了を成功扱いにしません。

## 台帳の意味

正本は [`test_registry.json`](test_registry.json) です。

| suite | 役割 | 実行方法 |
|---|---|---|
| `existing` | 従来のFull Inspection・CI・その子テストで実行される | 既存の呼び出し元を維持 |
| `supplemental` | 過去に未接続だった追加テスト | 台帳ランナー、Full Inspection末尾、新CI |
| `quarantined` | 原因調査・修復が必要な既知の失敗 | 明示的な再調査コマンドのみ |

導入時は、既存103本に台帳自体のテスト1本を追加し、追加検査40本、未解決13本を登録しています。
未解決の分類は2026-09-22のWindows / Node 24.18.0 / Python 3.11.3での調査結果です。
分類は合格証明ではありません。実行結果に表示する`notRun`には、そのコマンドで実行しなかったテストが含まれます。
未解決13本は従来のCI経路にも含まれていなかったもので、既存の必須テストを免除したものではありません。

台帳検証では次を検出します。

- `scratch/`配下の未登録`test_*.mjs` / `test_*.js` / `test_*.py`（未追跡ファイルも対象）
- 消失したファイル、二重登録、無効な分類、目的の欠落
- 既存の呼び出し元から消えたテスト参照
- 未解決テストの理由・次の対応の欠落

`backup_snapshots/`と`__pycache__/`は探索対象外です。
既存呼び出し元の検証は、指定したソース内のパス文字列の静的確認です。
実行履歴や、条件分岐の先で必ず実行されることまで証明するものではありません。
`game/src/**/dev/diagnose_*.mjs`や手動素材生成スクリプトは、このテスト台帳の対象外です。

## テストを追加・修復するとき

1. テストを作成し、`path`・`purpose`・`suite`を台帳に登録します。
2. 新しい継続検査は原則`supplemental`へ登録し、単体実行と追加検査を通します。
3. 既存の検査経路で実行する場合は`existing`とし、`entryPoints`へ実際の呼び出し元を記録します。
4. 未解決テストは`reason`と`nextAction`を記録します。期待値の変更だけで失敗を隠さず、本体の問題・旧仕様・テスト環境不足を切り分けます。
5. 修復したテストは元の検証意図を確認して単体実行し、`quarantined`から`supplemental`へ移します。
6. 台帳チェック、追加検査、既存Full Inspectionを実行します。

`--run quarantined`の成功だけでは分類を自動変更しません。
同じ理由の失敗かどうかは診断出力を確認してください。台帳への登録も自動生成で上書きしません。

## CIとの関係

- 既存の`full-inspection.yml`と`pages.yml`の対象ブランチ、検査順序、公開経路は維持します。
- `scratch-validation.yml`がmain / AoT*へのPR・pushで台帳検証と追加検査を実行します。手動起動にも対応します。
- 追加検査のJSON結果は、失敗時もGitHub Actionsのartifactとして保存します。
- mainの新CIは追加検査の範囲です。mainで既存Full Inspection全体が自動実行されるようになった、という意味ではありません。
- 必須チェックへの指定はGitHubのブランチ保護設定で別途行う必要があります。この変更ではリモート設定を変更しません。

## 運用ツールと退避資料

| 種類 | 現行の入口・扱い |
|---|---|
| ローカル起動 | `PLAYTEST.bat` → `playtest_server.py` |
| 統合・履歴保護 | ルートの`AoT_*.cmd` → `integration_*` / `safe_integration_*` / `unified_integration_*`等 |
| 作業ブランチ管理 | `task_health.mjs` / `task_merge_preview.mjs` / `task_sweeper*.mjs` |
| バックアップ実装 | `integration_guard_backup.mjs`は現役コード。退避資料ではない |
| 過去スナップショット | `backup_snapshots/`は復元用途を確認してから整理。今回の変更では移動・削除しない |
| 素材生成 | 個人環境の絶対パスと既存素材への書き込みがあるため、入力・出力先を確認して手動実行 |
| 過去ログ・キャッシュ | `*.txt`、`*.log`、追跡済み`__pycache__`をテストの正本にしない |

`capture_browser_console.js`と`check_all_cards_consistency.py`には導入時点で未解消競合があり、実行不能です。
これらは今回の自動検査対象に含めていません。手動利用前に修復または廃止を判断してください。
`verify_browser_playwright.mjs`にも旧`window.gameUI`への依存があります。
`verify_all_rule_files.py`の成功はコード内期待値との比較結果で、仕様書本文全体との整合性保証ではありません。

## 変更の戻し方

既存ファイルの移動・削除、ゲーム本体の変更、公開設定の変更はありません。
追加部分を戻す場合は、`run_full_inspection.mjs`に追加した台帳チェック・台帳テスト・追加検査の呼び出しと、
新しい`scratch-validation.yml`、台帳・ランナー・台帳テスト・このガイドを同じ変更単位で戻します。
従来の検査呼び出しはそのまま残ります。
