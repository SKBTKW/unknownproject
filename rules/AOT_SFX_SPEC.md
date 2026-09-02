# The Age of Trials — SFX正式仕様 v1.0

## 基本方針
AoTのSEは木・石・金属・土・風・水を中心とした短く乾いた手触りを基本とする。
派手なスマホゲーム音を避け、中世的で暗い世界観を壊さない。
操作SEは短く、MERGEのみ少し厚い低域と短い金属共鳴を許可する。

## ディレクトリ
```text
game/assets/audio/sfx/
├─ ui/
├─ land/
│  ├─ select/
│  └─ action/
├─ merge/
└─ command/
```

## 命名規則
- ファイル: `<category>_<action-or-subject>[_<variant>].wav`
- 小文字 snake_case
- Event ID: 大文字 SNAKE_CASE
- コードはEvent IDを参照し、パス直書きを避ける
- 差分が必要な場合のみ `_01`, `_02`
- `final`, `new`, `ver2`, `test` 等は禁止

## 正式割り当て
| 状況 | Event ID | File |
|---|---|---|
| カード選択 | UI_CARD_SELECT | ui/ui_card_select.wav |
| カード選択キャンセル | UI_CARD_CANCEL | ui/ui_card_cancel.wav |
| 草原選択 | LAND_SELECT_PLAINS | land/select/land_select_plains.wav |
| 丘陵選択 | LAND_SELECT_HILL | land/select/land_select_hill.wav |
| 山岳選択 | LAND_SELECT_MOUNTAIN | land/select/land_select_mountain.wav |
| 砂漠選択 | LAND_SELECT_DESERT | land/select/land_select_desert.wav |
| 森選択 | LAND_SELECT_FOREST | land/select/land_select_forest.wav |
| 深い森選択 | LAND_SELECT_DEEP_FOREST | land/select/land_select_deep_forest.wav |
| 森丘陵選択 | LAND_SELECT_FOREST_HILL | land/select/land_select_forest_hill.wav |
| 森林丘陵選択 | LAND_SELECT_DEEP_HILL | land/select/land_select_deep_hill.wav |
| 荒野選択 | LAND_SELECT_WASTELAND | land/select/land_select_wasteland.wav |
| 湿原選択 | LAND_SELECT_WETLAND | land/select/land_select_wetland.wav |
| 土地回転 | LAND_ROTATE | land/action/land_rotate.wav |
| グリッド配置 | LAND_PLACE | land/action/land_place.wav |
| Undo | LAND_UNDO | land/action/land_undo.wav |
| 資源ソケット配置 | LAND_PLACE_SOCKET | land/action/land_place_socket.wav |
| 1x2マージ | MERGE_1X2 | merge/merge_1x2.wav |
| 1x3マージ | MERGE_1X3 | merge/merge_1x3.wav |
| 2x2マージ | MERGE_2X2 | merge/merge_2x2.wav |
| コマンド実行 | COMMAND_EXECUTE | command/command_execute.wav |

## 音響言語
- 草原: 軽い土
- 丘陵: 小石 + 軽い上昇音
- 山岳: 重い石 + 短い金属共鳴
- 砂漠: 乾いた砂
- 森: 木 + 葉擦れ
- 深い森: より暗く低い木音
- 森丘陵: 木 + 石
- 森林丘陵: 森丘陵より低く重い
- 荒野: 乾いた石 + 風
- 湿原: 低い水気
- 1x2: 2点が噛み合う
- 1x3: 3段階の結合
- 2x2: 4点結合 + 低域 + 金属共鳴
- ソケット: 通常配置 + 小さな発見感
- コマンド: 木札/紙札の決定感 + 短い余韻

## 技術仕様
- WAV / PCM16 / mono / 44.1kHz
- 基本0.1〜0.55秒
- ループなし
- クリップ禁止
- 長いリバーブ禁止
- Unity移行後もEvent IDを維持

## 再生優先度
1. MERGE_2X2 / COMMAND_EXECUTE
2. LAND_PLACE_SOCKET
3. LAND_PLACE / LAND_UNDO
4. MERGE_1X3 / MERGE_1X2
5. Terrain Select
6. UI Select / Cancel

## 実装原則
- ゲームロジックはEvent IDだけ通知
- Audio側がEvent IDからファイルを解決
- 地形ID→パス解決を各所へ散らさない
- SE再生失敗でゲーム進行を止めない
- 将来カテゴリ音量は UI / LAND / MERGE / COMMAND / TRIAL
