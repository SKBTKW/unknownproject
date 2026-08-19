import json
import os

log_paths = [
    r"C:\Users\mam07\.gemini\antigravity\brain\273f204b-294b-44f5-a1dc-a22799321345\.system_generated\logs\transcript_full.jsonl",
    r"C:\Users\mam07\.gemini\antigravity\brain\45b557a8-3b14-4211-a20d-41770b2d0000\.system_generated\logs\transcript_full.jsonl",
    r"C:\Users\mam07\.gemini\antigravity\brain\89585373-159f-4e80-96cf-70d317be7004\.system_generated\logs\transcript_full.jsonl"
]

out_path = r"C:\Users\mam07\.gemini\antigravity\brain\273f204b-294b-44f5-a1dc-a22799321345\card_layer_structure_exact.txt"

with open(out_path, 'w', encoding='utf-8') as out:
    for path in log_paths:
        if not os.path.exists(path):
            continue
        cid = path.split("\\brain\\")[1].split("\\")[0]
        with open(path, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                try:
                    data = json.loads(line)
                    content = data.get("content", "")
                    if "レイヤー" in content or "layer" in content.lower() or "パーツ" in content or "重ね" in content:
                        role = data.get("source", "UNKNOWN")
                        out.write(f"=== [CID: {cid} Step {i} - {role}] ===\n{content}\n\n=========================================\n")
                except Exception:
                    pass

print("Done searching layer structure exact logs!")
