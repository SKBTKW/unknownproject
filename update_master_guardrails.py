import os

with open('rules/00_master_handover_specification.md', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

guardrail_text = """

🛡️ **【再発防止・AI暴走制御物理ガードレール (Strict AI Guardrails)】**:
- **① 禁止ワードリスト (Banned Word List)**: `鳥肌`, `最高です`, `天才的`, `脱帽`, `感服`, `過去最高`, `完璧な正解`, `神がかって` 等のお世辞・感情煽り表現が含まれた出力は即座に自己検知により破棄・再構成される。
- **② git push の機械的承認ゲート (Push Gate)**: ユーザーの直前発言に「push」の明示的文字列が含まれていない場合、`git push` コマンドの発行をシステム的に自動拒否する。
- **③ 3 大構造化考察テンプレートの機械的強制**: 検討・意見要求に対する応答は、必ず「① 懸念点・リスク ➔ ② 対応策 ➔ ③ 総括判定」の固定フォーマットで記述を開始し、内容のない挨拶やお世辞を物理的に排除する。
"""

if '再発防止・AI暴走制御物理ガードレール' not in content:
    # Append right after rule 7 in section 1
    target = '7. **安易な迎合 (イエスマン) の絶対禁止 ✕ 3大構造化考察の義務**: 形だけのベタ褒め・迎合を絶対禁止とし、意見を求められた際は必ず「①懸念点 ➔ ②対応策 ➔ ③総括判定」の3大構造化フォーマットに従い深層考察する。'
    if target in content:
        content = content.replace(target, target + "\n" + guardrail_text)
    else:
        content += "\n" + guardrail_text

with open('rules/00_master_handover_specification.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated 00_master_handover_specification.md with strict AI guardrails.")
