import os, json

def find_exact_4_principles():
    target_ids = [
        "45b557a8-3b14-4211-a20d-41770b2d0000",
        "89585373-159f-4e80-96cf-70d317be7004"
    ]
    base_brain = r"C:\Users\mam07\.gemini\antigravity\brain"
    rules_dir = r"C:\Users\mam07\.gemini\antigravity\scratch\unknownproject\rules"

    print("=== SEARCHING EXACT ORIGINAL 4 PRINCIPLES/POLICIES IN MASTER LOGS & RULES ===")

    # 1. rules/ 内の全 md ファイルから "4" や "方針" や "原則" や "コンセプト" や "柱" を捜索
    for root, dirs, files in os.walk(rules_dir):
        for file in files:
            if file.endswith('.md'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    print(f"\n--- FILE: {file} ---")
                    lines = content.splitlines()
                    for idx, l in enumerate(lines):
                        if any(k in l for k in ['方針', '原則', 'コンセプト', '柱', '4つ', '４', '4大', 'テーマ']):
                            print(f"[Line {idx+1}] {l.encode('ascii', errors='backslashreplace').decode('ascii')[:200]}")
                            # 周辺の行も出力
                            for neighbor in lines[max(0, idx-2):min(len(lines), idx+8)]:
                                print(f"   {neighbor.encode('ascii', errors='backslashreplace').decode('ascii')[:200]}")

    # 2. マスター会話ログ
    for conv_id in target_ids:
        transcript_path = os.path.join(base_brain, conv_id, ".system_generated", "logs", "transcript.jsonl")
        print(f"\n==========================================")
        print(f"MASTER LOG DEEP SEARCH: {conv_id}")
        print(f"==========================================")
        if os.path.exists(transcript_path):
            with open(transcript_path, 'r', encoding='utf-8', errors='ignore') as f:
                for i, line in enumerate(f):
                    if any(k in line for k in ['4つ', '４つ', '4大', '4原則', '4本', '4項目', '制作方針', 'ゲームデザイン方針', 'コンセプト']):
                        try:
                            data = json.loads(line)
                            step_idx = data.get('step_index', i)
                            msg_type = data.get('type', '')
                            content_str = str(data.get('content', ''))
                            if 'USER_INPUT' in msg_type or 'PLANNER_RESPONSE' in msg_type:
                                print(f"\n[Step {step_idx} - {msg_type}]")
                                for c_line in content_str.splitlines():
                                    if any(k in c_line for k in ['1.', '2.', '3.', '4.', '方針', '原則', 'コンセプト', '柱', '4']):
                                        print(c_line.encode('ascii', errors='backslashreplace').decode('ascii')[:220])
                        except:
                            pass

if __name__ == '__main__':
    find_exact_4_principles()
