import os, json

def search_4_policies():
    target_ids = [
        "45b557a8-3b14-4211-a20d-41770b2d0000",
        "89585373-159f-4e80-96cf-70d317be7004",
        "273f204b-294b-44f5-a1dc-a22799321345"
    ]
    base_brain = r"C:\Users\mam07\.gemini\antigravity\brain"
    rules_dir = r"C:\Users\mam07\.gemini\antigravity\scratch\unknownproject\rules"

    print("=== SEARCHING FOR THE 4 PRODUCTION POLICIES ===")

    # 1. rules / artifacts 内検索
    for root, dirs, files in os.walk(rules_dir):
        for file in files:
            if file.endswith('.md'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if '方針' in content or '4' in content or '原則' in content or 'ポリシー' in content:
                        for line in content.splitlines():
                            if any(k in line for k in ['方針', '原則', 'ポリシー', '1.', '2.', '3.', '4.']):
                                print(f"[RULE: {file}] {line.encode('ascii', errors='backslashreplace').decode('ascii')[:180]}")

    # 2. マスター会話ログ検索
    for conv_id in target_ids:
        transcript_path = os.path.join(base_brain, conv_id, ".system_generated", "logs", "transcript.jsonl")
        print(f"\n----------------------------------------")
        print(f"SEARCHING CONVERSATION: {conv_id}")
        print(f"----------------------------------------")
        if os.path.exists(transcript_path):
            with open(transcript_path, 'r', encoding='utf-8', errors='ignore') as f:
                for i, line in enumerate(f):
                    if any(k in line for k in ['制作方針', '開発方針', '4つ', '4大方針', '4原則', '基本方針', '方針']):
                        try:
                            data = json.loads(line)
                            step_idx = data.get('step_index', i)
                            msg_type = data.get('type', '')
                            content_str = str(data.get('content', ''))
                            if 'USER_INPUT' in msg_type or 'PLANNER_RESPONSE' in msg_type:
                                print(f"\n[Step {step_idx} - {msg_type}]")
                                for c_line in content_str.splitlines():
                                    if any(k in c_line for k in ['方針', '原則', '4つ', '4大', 'Unity', '1.', '2.', '3.', '4.']):
                                        print(c_line.encode('ascii', errors='backslashreplace').decode('ascii')[:200])
                        except:
                            pass

if __name__ == '__main__':
    search_4_policies()
