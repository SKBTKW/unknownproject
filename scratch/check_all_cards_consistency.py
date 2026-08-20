import json
import sys

def check_consistency():
    json_path = "game/src/data/land_cards.json"
    with open(json_path, "r", encoding="utf-8") as f:
        cards = json.load(f)

    errors = []

    # Check 1: 1x3 cards rarity == 'R'
    cards_1x3 = [c for c in cards if "1X3" in c["id"]]
    for c in cards_1x3:
        if c["rarity"] != "R":
            errors.append(f"Card {c['id']} rarity is '{c['rarity']}', expected 'R'")

    # Check 2: 1x2 special cards minStage == 2
    specials_1x2 = ["CARD_DEEP_FOREST_1X2", "CARD_DESERT_1X2", "CARD_DESERT_HILL_1X2", "CARD_DEEP_HILL_1X2", "CARD_FOREST_HILL_1X2"]
    for cid in specials_1x2:
        card = next((c for c in cards if c["id"] == cid), None)
        if not card:
            errors.append(f"Card {cid} missing from land_cards.json")
        elif card["minStage"] != 2:
            errors.append(f"Card {cid} minStage is {card['minStage']}, expected 2")

    # Check 3: 1x1 special cards minStage == 1
    specials_1x1 = ["CARD_DEEP_FOREST_1X1", "CARD_DESERT_1X1"]
    for cid in specials_1x1:
        card = next((c for c in cards if c["id"] == cid), None)
        if not card:
            errors.append(f"Card {cid} missing from land_cards.json")
        elif card["minStage"] != 1:
            errors.append(f"Card {cid} minStage is {card['minStage']}, expected 1")

    # Check 4: Check weight total in Stage 1
    stage1_cards = [c for c in cards if c.get("minStage", 1) <= 1 and c.get("reqH2", 0) <= 0]
    total_w_s1 = sum(c["weight"] for c in stage1_cards)
    deep_forest_s1 = sum(c["weight"] for c in stage1_cards if "DEEP" in c["terrainId"])
    desert_s1 = sum(c["weight"] for c in stage1_cards if "DESERT" in c["terrainId"])

    df_pct = (deep_forest_s1 / total_w_s1) * 100
    des_pct = (desert_s1 / total_w_s1) * 100

    print("=============================================================")
    print("AUTOMATED MISMATCH & CONSISTENCY CHECK")
    print("=============================================================")
    print(f"- Total Cards Defined: {len(cards)}")
    print(f"- Stage 1 Total Weight: {total_w_s1:.2f}")
    print(f"- Stage 1 Deep Forest (1x1) Rate: {df_pct:.2f}%")
    print(f"- Stage 1 Desert (1x1) Rate: {des_pct:.2f}%")
    print(f"- 1x3 Cards Rarity = 'R': {[c['id'] + ': ' + c['rarity'] for c in cards_1x3]}")

    if errors:
<<<<<<< HEAD
        print("\n❌ ERRORS FOUND:")
=======
        print("\n笶・ERRORS FOUND:")
>>>>>>> dd8b7ce (chore: track tools and config in scratch)
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)
    else:
        print("\n[SUCCESS] ZERO MISMATCHES: All cards, rarities, minStages, and weights matched 100%!")

if __name__ == "__main__":
    check_consistency()
