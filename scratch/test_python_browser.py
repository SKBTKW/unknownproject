import sys
import urllib.request
import re

sys.stdout.reconfigure(encoding='utf-8')
url = 'http://localhost:8080/index.html'
print(f"🚀 Fetching {url} for automated structural analysis...")

try:
    with urllib.request.urlopen(url) as response:
        html = response.read().decode('utf-8')
        
        print("✅ HTTP 200 OK: index.html is served successfully.")
        
        # 1. ロール選択ボタンのチェック
        has_general_btn = 'id="btn-role-general"' in html or 'btn-role-general' in html
        has_prophet_btn = 'id="btn-role-prophet"' in html or 'btn-role-prophet' in html
        has_pioneer_btn = 'id="btn-role-pioneer"' in html or 'btn-role-pioneer' in html
        print(f"  - General role button present: {has_general_btn}")
        print(f"  - Prophet role button present: {has_prophet_btn}")
        print(f"  - Pioneer role button present: {has_pioneer_btn}")

        # 2. selectGameRole JS関数のチェック
        has_role_func = 'function selectGameRole' in html
        has_render_all = 'renderAll()' in html
        print(f"  - selectGameRole function present: {has_role_func}")
        print(f"  - renderAll invocation present: {has_render_all}")

        # 3. モーダル初期非表示 style="display:none !important;" のチェック
        has_initial_hidden = 'style="display:none !important;"' in html
        print(f"  - Modal initially set to display:none: {has_initial_hidden}")

        # 4. ドローエリアおよび★ソケット直感的テキストのチェック
        has_card_offerings = 'id="card-offerings-row"' in html
        has_bonus_land_text = '🌟 ボーナス地' in html or 'ボーナス地' in html
        print(f"  - Draw area container present: {has_card_offerings}")
        print(f"  - Self-explanatory bonus land text present: {has_bonus_land_text}")

except Exception as e:
    print(f"❌ Error fetching URL: {e}")
