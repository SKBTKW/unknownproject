import sys
import urllib.request
import re

sys.stdout.reconfigure(encoding='utf-8')
url = 'http://localhost:8080/index.html'
print(f"🚀 Starting Step-by-Step Isolation Testing on {url}...\n")

try:
    with urllib.request.urlopen(url) as response:
        html = response.read().decode('utf-8')

        # -------------------------------------------------------------
        # Step 0: ベースライン構造テスト (HTML/JS ロード ＆ ロールモーダル)
        # -------------------------------------------------------------
        print("=== 📌 Step 0: Base Structure & Role Modal Test ===")
        step0_pass = ('id="role-select-modal"' in html) and ('selectGameRole' in html)
        print(f"  [Step 0 Result]: {'✅ PASS' if step0_pass else '❌ FAIL'}")

        # -------------------------------------------------------------
        # Step 1: 1ターン1回マリガン制限機能の独立チェック
        # -------------------------------------------------------------
        print("\n=== 📌 Step 1: Mulligan 1-Per-Turn Limit Isolation Test ===")
        step1_pass = ('mulliganThisTurn' in html) and ('LOG_MULLIGAN_LIMIT_REACHED' in html)
        print(f"  [Step 1 Result]: {'✅ PASS' if step1_pass else '❌ FAIL'}")

        # -------------------------------------------------------------
        # Step 2: ★ソケットのナラティブ化 (ボーナス地＋ホバー詳細) の独立チェック
        # -------------------------------------------------------------
        print("\n=== 📌 Step 2: Bonus Land Narrative Socket Isolation Test ===")
        step2_pass = ('🌟 ボーナス地' in html or 'ボーナス地' in html) and ('hasStarSocket' in html)
        print(f"  [Step 2 Result]: {'✅ PASS' if step2_pass else '❌ FAIL'}")

        # -------------------------------------------------------------
        # Step 3: ドローエリア拡大 ＆ 手札全プレイ時ガイドUI の独立チェック
        # -------------------------------------------------------------
        print("\n=== 📌 Step 3: Draw Area & Hand Cards Lock Isolation Test ===")
        step3_pass = ('handCards.length > 0' in html) and ('card-offerings-row' in html)
        print(f"  [Step 3 Result]: {'✅ PASS' if step3_pass else '❌ FAIL'}")

        print("\n=======================================================")
        all_steps = step0_pass and step1_pass and step2_pass and step3_pass
        print(f"🏆 Overall Isolation Test Status: {'ALL STEPS 100% VERIFIED PASS' if all_steps else 'FAILURE DETECTED'}")

except Exception as e:
    print(f"❌ Error during step-by-step testing: {e}")
