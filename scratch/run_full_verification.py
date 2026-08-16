import subprocess
import sys
import io

# Force utf-8 output for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def main():
    print("\n=============================================================")
    print("RUNNING MASTER VERIFICATION PIPELINE (STEP 2 + STEP 3)")
    print("=============================================================\n")

    # Step 2: Run Python pre_write_linter.py
    print("--- [STEP 2] Running Python Linter & Spec Verification (.py) ---")
    res_py = subprocess.run([sys.executable, "scratch/pre_write_linter.py"], capture_output=True, text=True, encoding='utf-8')
    print(res_py.stdout)
    if res_py.returncode != 0:
        print(res_py.stderr)
        print("[FAIL] FAILURE AT STEP 2: Python Linter Failed!")
        sys.exit(1)

    # Step 3: Run Playwright Test node scratch/test_regression_all_ui.js
    print("--- [STEP 3] Running Playwright Main UI Test Engine (Node.js) ---")
    res_js = subprocess.run(["node", "scratch/test_regression_all_ui.js"], capture_output=True, text=True, encoding='utf-8')
    print(res_js.stdout)
    if res_js.returncode != 0:
        print(res_js.stderr)
        print("[FAIL] FAILURE AT STEP 3: Playwright Regression Test Failed!")
        sys.exit(1)

    print("\n=============================================================")
    print("[STEP 4 READY] ALL PIPELINE STEPS PASSED 100%!")
    print("=============================================================\n")

if __name__ == "__main__":
    main()
