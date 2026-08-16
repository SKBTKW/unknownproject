import json
import os

root = os.path.join(os.path.dirname(__file__), "..")
cards_path = os.path.join(root, "game", "src", "data", "land_cards.json")

with open(cards_path, 'r', encoding='utf-8') as f:
    cards = json.load(f)

print("=== CHECKING ALL LAND CARDS FOR 1x3 SHAPES ===")
found_1x3 = []
for c in cards:
    shape = c.get("shape", [])
    # 1x3: shape == [[1, 1, 1]] or shape == [[1], [1], [1]]
    rows = len(shape)
    cols = len(shape[0]) if rows > 0 else 0
    total_cells = sum(sum(r) for r in shape)
    
    print(f"ID: {c['id']}, Rarity: {c.get('rarity')}, Shape: {shape} ({rows}x{cols}, cells={total_cells})")
    
    if total_cells >= 3 or rows >= 3 or cols >= 3:
        found_1x3.append(c)

print(f"\nFOUND {len(found_1x3)} CARDS WITH 3+ TILES (1x3 etc.):")
for c in found_1x3:
    print(f" -> ID: {c['id']}, Shape: {c['shape']}")
