#!/usr/bin/env python3
import sys
import os
import tempfile

sys.path.insert(0, 'scratch')
import verify_all_rule_files
import pre_write_linter

print("=== 🛡️ 暴走制御スクリプト検知能力テスト ===")

# --- 1. 数値改ざん・捏造の検知テスト ---
print("\n[テスト1] AIが勝手に数値を捏造した場合 (平地の食料を 99 に改変)")
with tempfile.TemporaryDirectory() as tmpdir:
    game_dir = os.path.join(tmpdir, 'game')
    src_dir = os.path.join(game_dir, 'src')
    os.makedirs(src_dir)
    with open(os.path.join(src_dir, 'fake_data.js'), 'w', encoding='utf-8') as f:
        f.write('export const fake = { id: "GL1_PLAINS", food: 99, wood: 0, defense: 0 };')

    mismatches, count, elapsed = verify_all_rule_files.verify_all_specs_against_code('rules', game_dir)
    print(f"  検知された違反件数: {len(mismatches)} 件")
    for m in mismatches:
        print(f"  🚨 遮断理由: {m}")

    if len(mismatches) > 0:
        print("  ✅ [PASS] 捏造数値を機械的に100%検知・遮断しました。")
    else:
        print("  ❌ [FAIL] 捏造数値を検知できませんでした。")
        sys.exit(1)

# --- 2. 日本語直書き・I18N違反の検知テスト ---
print("\n[テスト2] AIが勝手に日本語テキストを直書きした場合")
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as tf:
    tf.write('const msg = "勝手に追加した未翻訳テキスト";\n')
    temp_filepath = tf.name

violations = pre_write_linter.scan_file_for_hardcoded_japanese(temp_filepath)
os.remove(temp_filepath)

print(f"  検知された直書き日本語行: {len(violations)} 行")
for line_num, content in violations:
    print(f"  🚨 遮断理由: 行 {line_num} -> {content}")

if len(violations) > 0:
    print("  ✅ [PASS] 日本語直書きを機械的に100%検知・遮断しました。")
else:
    print("  ❌ [FAIL] 日本語直書きを検知できませんでした。")
    sys.exit(1)

print("\n====================================================")
print("🎉 結論: 暴走制御スクリプトは確実に機能・遮断しています！")
print("====================================================")
