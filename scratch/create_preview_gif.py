import os
from PIL import Image

dest_dir = "game/assets"

# 1. 8枚の合成画像を生成
bg_path = os.path.join(dest_dir, "campfire_background.png")
bg = Image.open(bg_path).convert("RGBA")

frames = []
for i in range(1, 9):
    f_path = os.path.join(dest_dir, f"campfire_flame_0{i}.png")
    flame = Image.open(f_path).convert("RGBA")
    
    # 背景と前面炎を原点 (0,0) で合成
    composite = Image.alpha_composite(bg, flame)
    frames.append(composite.convert("RGB"))

# 2. campfire_preview.gif として保存 (duration=125ms, loop=0)
gif_path = os.path.join(dest_dir, "campfire_preview.gif")
frames[0].save(
    gif_path,
    save_all=True,
    append_images=frames[1:],
    duration=125,
    loop=0
)

print(f"Created {gif_path} (size: {os.path.getsize(gif_path)} bytes, 8 frames @ 125ms)")
