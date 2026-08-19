import os, json, glob

def deep_search_gl_corrections():
    target_ids = [
        "45b557a8-3b14-4211-a20d-41770b2d0000",
        "89585373-159f-4e80-96cf-70d317be7004",
        "273f204b-294b-44f5-a1dc-a22799321345"
    ]
    base_brain = r"C:\Users\mam07\.gemini\antigravity\brain"

    print("=== DEEP SEARCH FOR GL CORRECTIONS / MULTIPLIERS ===")

    # 1. 脳内アーティファクト (.md, .txt) を全件捜索
    for conv_id in target_ids:
        conv_dir = os.path.join(base_brain, conv_id)
        if os.path.exists(conv_dir):
            for root, dirs, files in os.walk(conv_dir):
                for file in files:
                    if file.endswith('.md') or file.endswith('.txt'):
                        path = os.path.join(root, file)
                        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            if 'GL' in content and ('補正' in content or '倍率' in content or '係数' in content or '産出' in content):
                                print(f"\n--- ARTIFACT/FILE: {path} ---")
                                for line in content.splitlines():
                                    if 'GL' in line or '補正' in line or '倍率' in line:
                                        print(line.encode('ascii', errors='backslashreplace').decode('ascii')[:200])

    # 2. JSONL トランスクリプト全ステップ深く検索
    for conv_id in target_ids:
        transcript_path = os.path.join(base_brain, conv_id, ".system_generated", "logs", "transcript.jsonl")
        print(f"\n==========================================")
        print(f"DEEP TRANSCRIPT SEARCH: {conv_id}")
        print(f"==========================================")
        if os.path.exists(transcript_path):
            with open(transcript_path, 'r', encoding='utf-8', errors='ignore') as f:
                for i, line in enumerate(f):
                    if 'GL' in line and ('補正' in line or '倍率' in line or '係数' in line or '計算' in line or '産出' in line):
                        try:
                            data = json.loads(line)
                            step_idx = data.get('step_index', i)
                            msg_type = data.get('type', '')
                            content_str = str(data.get('content', ''))
                            if 'USER_INPUT' in msg_type or 'PLANNER_RESPONSE' in msg_type:
                                for c_line in content_str.splitlines():
                                    if 'GL' in c_line and ('補正' in c_line or '倍率' in c_line or '係数' in c_line or '加算' in c_line or '乗算' in c_line or '倍' in c_line):
                                        print(f"[Step {step_idx}] {c_line.encode('ascii', errors='backslashreplace').decode('ascii')[:220]}")
                        except:
                            pass

if __name__ == '__main__':
    deep_search_gl_corrections()
