import os, json

def search_target_conversations():
    target_ids = [
        "45b557a8-3b14-4211-a20d-41770b2d0000",
        "89585373-159f-4e80-96cf-70d317be7004"
    ]
    base_brain = r"C:\Users\mam07\.gemini\antigravity\brain"

    print("=== SEARCHING SPECIFIED MASTER LOGS ===")

    for conv_id in target_ids:
        transcript_path = os.path.join(base_brain, conv_id, ".system_generated", "logs", "transcript.jsonl")
        print(f"\n==========================================")
        print(f"SEARCHING CONVERSATION: {conv_id}")
        print(f"Path: {transcript_path}")
        print(f"Exists: {os.path.exists(transcript_path)}")
        print(f"==========================================")

        if os.path.exists(transcript_path):
            with open(transcript_path, 'r', encoding='utf-8', errors='ignore') as f:
                for i, line in enumerate(f):
                    if any(k in line for k in ['GL', '高度', '補正', '係数', '倍率', '産出', '密林', '平地', '丘陵', '山岳']):
                        try:
                            data = json.loads(line)
                            step_idx = data.get('step_index', i)
                            msg_type = data.get('type', '')
                            content_str = str(data.get('content', ''))
                            if 'USER_INPUT' in msg_type or any(k in content_str for k in ['補正', '係数', '倍率', 'GL', '高度']):
                                print(f"\n[Step {step_idx} - {msg_type}]")
                                for c_line in content_str.splitlines():
                                    if any(k in c_line for k in ['補正', '係数', '倍率', 'GL', '高度', '産出', '1.', '2.', '3.']):
                                        print(c_line.encode('ascii', errors='backslashreplace').decode('ascii')[:200])
                        except:
                            pass

if __name__ == '__main__':
    search_target_conversations()
