import os, json

def search_coefficients():
    print("=== SEARCHING LOGS & RULES FOR GL & ALTITUDE MULTIPLIERS / COEFFICIENTS ===")

    # 1. rules ディレクトリ検索
    rules_dir = r"C:\Users\mam07\.gemini\antigravity\scratch\unknownproject\rules"
    for root, dirs, files in os.walk(rules_dir):
        for file in files:
            if file.endswith('.md'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if any(k in content for k in ['補正', '係数', '倍率', 'GL', '高度', '産出']):
                        print(f"\n--- RULE FILE: {path} ---")
                        for line in content.splitlines():
                            if any(k in line for k in ['補正', '係数', '倍率', '高度', 'GL', '1.', '2.', '3.']):
                                print(line.encode('ascii', errors='backslashreplace').decode('ascii'))

    # 2. 会話ログ transcript.jsonl 検索
    brain_dir = r"C:\Users\mam07\.gemini\antigravity\brain\273f204b-294b-44f5-a1dc-a22799321345\.system_generated\logs"
    transcript_path = os.path.join(brain_dir, "transcript.jsonl")
    if os.path.exists(transcript_path):
        with open(transcript_path, 'r', encoding='utf-8', errors='ignore') as f:
            for i, line in enumerate(f):
                if any(k in line for k in ['補正', '係数', '倍率', 'GL', '高度']):
                    try:
                        data = json.loads(line)
                        step_idx = data.get('step_index', i)
                        msg_type = data.get('type', '')
                        content_str = str(data.get('content', ''))
                        if 'USER_INPUT' in msg_type or '補正' in content_str or '係数' in content_str:
                            print(f"\n--- TRANSCRIPT Step {step_idx} [{msg_type}] ---")
                            for c_line in content_str.splitlines():
                                if any(k in c_line for k in ['補正', '係数', '倍率', 'GL', '高度']):
                                    print(c_line.encode('ascii', errors='backslashreplace').decode('ascii')[:200])
                    except:
                        pass

if __name__ == '__main__':
    search_coefficients()
