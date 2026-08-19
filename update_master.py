with open('rules/00_master_handover_specification.md', 'r', encoding='cp932', errors='ignore') as f:
    content = f.read()

content = content.replace('王都圏', '本営近郊')

with open('rules/00_master_handover_specification.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("00_master_handover_specification.md updated successfully.")
