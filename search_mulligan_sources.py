import os, json

def search_mulligan_sources():
    print("=== SEARCHING REX / LOGS FOR MULLIGAN RULES ===")
    
    rules_dir = r"C:\Users\mam07\.gemini\antigravity\scratch\unknownproject\rules"
    for root, dirs, files in os.walk(rules_dir):
        for file in files:
            if file.endswith('.md'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if 'マリガン' in content or 'mulligan' in content.lower():
                        print(f"\n--- FOUND IN RULE FILE: {path} ---")
                        for line in content.splitlines():
                            if 'マリガン' in line or '引き直し' in line or '無償' in line or 'コスト' in line:
                                print(line.encode('ascii', errors='backslashreplace').decode('ascii'))

    brain_dir = r"C:\Users\mam07\.gemini\antigravity\brain\273f204b-294b-44f5-a1dc-a22799321345\.system_generated\logs"
    transcript_path = os.path.join(brain_dir, "transcript.jsonl")
    if os.path.exists(transcript_path):
        with open(transcript_path, 'r', encoding='utf-8', errors='ignore') as f:
            for i, line in enumerate(f):
                if 'マリガン' in line:
                    try:
                        data = json.loads(line)
                        step_idx = data.get('step_index', i)
                        msg_type = data.get('type', '')
                        content_str = str(data.get('content', ''))
                        if 'USER_INPUT' in msg_type or 'マリガン' in content_str:
                            print(f"\n--- TRANSCRIPT Step {step_idx} [{msg_type}] ---")
                            for c_line in content_str.splitlines():
                                if 'マリガン' in c_line:
                                    print(c_line.encode('ascii', errors='backslashreplace').decode('ascii')[:200])
                    except:
                        pass

if __name__ == '__main__':
    search_mulligan_sources()
