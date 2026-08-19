import json
import os

log_path = r"C:\Users\mam07\.gemini\antigravity\brain\273f204b-294b-44f5-a1dc-a22799321345\.system_generated\logs\transcript_full.jsonl"
out_path = r"C:\Users\mam07\.gemini\antigravity\brain\273f204b-294b-44f5-a1dc-a22799321345\user_history.txt"

with open(log_path, 'r', encoding='utf-8') as f, open(out_path, 'w', encoding='utf-8') as out:
    for i, line in enumerate(f):
        try:
            data = json.loads(line)
            if data.get("type") == "USER_INPUT":
                content = data.get("content", "")
                out.write(f"[{i}] {content}\n")
        except Exception as e:
            pass

print("Done extracting user inputs!")
