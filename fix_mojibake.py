import subprocess

# 1. Get clean content from clean commit 50f8f58
res = subprocess.run(
    ['git', 'show', '50f8f58:rules/00_master_handover_specification.md'],
    capture_output=True
)

raw_bytes = res.stdout

# Decode using utf-8 or cp932
clean_text = None
for enc in ['utf-8', 'cp932', 'shift_jis']:
    try:
        clean_text = raw_bytes.decode(enc)
        print(f"Decoded clean original from commit 50f8f58 using {enc}")
        break
    except Exception:
        continue

if not clean_text:
    print("Failed to decode clean commit text.")
    exit(1)

# Apply all latest updates cleanly on clean_text
clean_text = clean_text.replace('王都圏', '本営近郊')

pending_section_master = """

---

## 🔍 12. 【要検討 (Pending Items)】 後日詳細検討事項

- **複数マージ同時成立時の操作ディテール UI/UX**:
  - 土地配置時に複数のマージ候補が同時成立する際、最高効果のデフォルト推奨表示と任意選択権を保証しつつ、マウスホバー切り替えやタッチ操作等の細かな UI/UX ディテールはプロトタイプ検証後の「要検討事項」として保持する。
"""

if '【要検討 (Pending Items)】' not in clean_text:
    clean_text += pending_section_master

# Save as UTF-8 strictly
with open('rules/00_master_handover_specification.md', 'w', encoding='utf-8') as f:
    f.write(clean_text)

print("Restored rules/00_master_handover_specification.md cleanly to UTF-8.")
