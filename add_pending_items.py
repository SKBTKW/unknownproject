import os

# 1. Update rules/03_land_system/03_merge_system.md
with open('rules/03_land_system/03_merge_system.md', 'r', encoding='utf-8', errors='ignore') as f:
    content_merge = f.read()

pending_section_merge = """

---

## 🔍 6. 【要検討 (Pending Items)】 後日詳細検討事項

以下の設計項目は、基本構造および設計方針を確定済みであり、プロトタイプ検証後の UI/UX 詰めフェーズにて細かな操作ディテールを「要検討事項」として保持し、追って確定・更新する。

1. **複数マージ同時成立時の操作ディテール UI/UX**:
   - **基本決定方針**: 土地配置時に複数のマージ候補が同時に成立可能な場合、デフォルトで最も効果が高い（最高産出・最高倍率）候補範囲をハイライト表示し、プレイヤーが望む任意の組み合わせを選択・確定できる構造とする。
   - **要検討事項**: マウスホバー/ドラッグ＆ドロップによるリアルタイム候補プレビュー切り替え、およびスマートフォン等のタッチ操作との共通化・詳細フィードバック処理の策定。
"""

if '【要検討 (Pending Items)】' not in content_merge:
    content_merge += pending_section_merge

with open('rules/03_land_system/03_merge_system.md', 'w', encoding='utf-8') as f:
    f.write(content_merge)

# 2. Update rules/00_master_handover_specification.md
with open('rules/00_master_handover_specification.md', 'r', encoding='utf-8', errors='ignore') as f:
    content_master = f.read()

pending_section_master = """

---

## 🔍 12. 【要検討 (Pending Items)】 後日詳細検討事項

- **複数マージ同時成立時の操作ディテール UI/UX**:
  - 土地配置時に複数のマージ候補が同時成立する際、最高効果のデフォルト推奨表示と任意選択権を保証しつつ、マウスホバー切り替えやタッチ操作等の細かな UI/UX ディテールはプロトタイプ検証後の「要検討事項」として保持する。
"""

if '【要検討 (Pending Items)】' not in content_master:
    content_master += pending_section_master

with open('rules/00_master_handover_specification.md', 'w', encoding='utf-8') as f:
    f.write(content_master)

print("Pending items sections added successfully.")
