import shutil, os
from PIL import Image

src_path = 'C:/Users/mam07/.gemini/antigravity/brain/ebea6b65-346f-4b05-9516-b6e84901a865/.user_uploaded/media_1787741810179.png'
dest_dir = 'game/assets'

# 1. campfire_flame_spritesheet.png をコピー
sheet_dest = os.path.join(dest_dir, 'campfire_flame_spritesheet.png')
shutil.copyfile(src_path, sheet_dest)
print(f'Copied official spritesheet: {os.path.getsize(sheet_dest)} bytes')

# 2. PIL で 8 コマ切り出し
sheet = Image.open(sheet_dest).convert('RGBA')
print(f'Sheet size: {sheet.size}')

for i in range(8):
    box = (i * 100, 0, (i + 1) * 100, 100)
    frame = sheet.crop(box)
    frame_path = os.path.join(dest_dir, f'campfire_flame_0{i+1}.png')
    frame.save(frame_path, 'PNG')
    print(f'Saved frame {i+1}: {frame_path} ({os.path.getsize(frame_path)} bytes)')

# 3. verification_contact_sheet.png を生成
bg_path = os.path.join(dest_dir, 'campfire_background.png')
bg = Image.open(bg_path).convert('RGBA')

contact = Image.new('RGBA', (800, 100))
for i in range(8):
    contact.paste(bg, (i * 100, 0))

contact.alpha_composite(sheet, (0, 0))
contact_path = os.path.join(dest_dir, 'verification_contact_sheet.png')
contact.save(contact_path, 'PNG')
print(f'Saved contact sheet: {contact_path} ({os.path.getsize(contact_path)} bytes)')
