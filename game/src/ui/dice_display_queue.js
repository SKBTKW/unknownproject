/**
 * 📥 DiceDisplayQueue (ダイス演出 FIFO キューモジュール)
 * 
 * 責務:
 * 1. CheckResolvedEvent をキューイングし、連続した判定演出が重ならないよう順番に再生する。
 * 2. ゲームロジック側は既に完了しているため、UI 側での演出詰まりや遅延がロジックに一切波及しない。
 * 3. タイムアウト安全機構 (Timeout Fallback) により、ブラウザのバックグラウンド化等でもキューがスタックしない。
 */

export class DiceDisplayQueue {
    /**
     * @param {Object} [diceWidget=null] - DiceWidgetComponent インスタンス
     */
    constructor(diceWidget = null) {
        this.widget = diceWidget;
        this.queue = [];
        this.isPlaying = false;
        this.maxWaitTimeoutMs = 3000; // 1演出あたりの最大保証時間
    }

    /**
     * 📥 演出イベントのキュー追加
     * @param {Object} event - CheckResolvedEvent { result, context, feedback }
     */
    enqueue(event) {
        if (!event || !event.result) return;
        this.queue.push(event);
        if (!this.isPlaying) {
            this.processNext();
        }
    }

    /**
     * 🔄 キューの順次消化処理
     */
    async processNext() {
        if (this.queue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const currentItem = this.queue.shift();

        try {
            if (this.widget && typeof this.widget.play === "function") {
                // Widget での演出再生 (安全タイムアウト付き)
                const playPromise = this.widget.play(currentItem);
                const timeoutPromise = new Promise((resolve) => setTimeout(resolve, this.maxWaitTimeoutMs));
                await Promise.race([playPromise, timeoutPromise]);
            }
        } catch (err) {
            console.error("[DiceDisplayQueue] Error during playback:", err);
        }

        // 次の演出へ
        this.processNext();
    }

    /**
     * 🧹 キューの全クリア
     */
    clear() {
        this.queue = [];
        this.isPlaying = false;
        if (this.widget && typeof this.widget.hide === "function") {
            this.widget.hide();
        }
    }

    /**
     * 📊 未処理キュー数
     */
    get length() {
        return this.queue.length;
    }
}

if (typeof window !== "undefined") {
    window.DiceDisplayQueue = DiceDisplayQueue;
}
if (typeof globalThis !== "undefined") {
    globalThis.DiceDisplayQueue = DiceDisplayQueue;
}
