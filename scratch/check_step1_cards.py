import json
import sys

def verify_step1():
    json_path = "game/src/data/land_cards.json"
    with open(json_path, "r", encoding="utf-8") as f:
        cards = json.load(f)

    expected_cmd_ids = [
        "CMD_AGRICULTURAL_POLICY",
        "CMD_BLACK_MARKET",
        "CMD_IRON_RAMPART",
        "CMD_BALLISTA_SET",
        "CMD_REKINDLE_EMBER",
        "CMD_TRANSMUTE_GOLDEN",
        "FAC_GREAT_WINDMILL",
        "LGD_DESPERATE_PACT"
    ]

    found_cmds = [c for c in cards if c["id"] in expected_cmd_ids]

    print("=============================================================")
    print("STEP 1: DATA REGISTRATION VERIFICATION (land_cards.json)")
    print("=============================================================")
    print(f"- Total Cards Registered: {len(cards)} (Expected 30)")
    print(f"- Non-Land Command Cards Added: {len(found_cmds)} / {len(expected_cmd_ids)}")

    missing = set(expected_cmd_ids) - set([c["id"] for c in found_cmds])
    if missing:
        print(f"[ERROR] Missing Cards: {missing}")
        sys.exit(1)
    else:
        print("[SUCCESS] All 8 Step 1 Non-Land Command Cards successfully registered and validated in land_cards.json!")

if __name__ == "__main__":
    verify_step1()
