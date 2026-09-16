/**
 * 🎯 TargetBuilder (CheckSystem 動的目標値ビルダー)
 * 
 * 責務:
 * 1. 判定呼び出し元から「8以上で成功」「5以下で成功」といった直感的な目標値指定を受け取る。
 * 2. (-∞, +∞) を完全に網羅し、穴も重複もない数学的排他区間 (outcomes) を自動生成する。
 * 3. 生成直後に CheckValidator で自己検問を行い、数学的健全性を 100% 保証する。
 */

import { CheckValidator } from './check_validator.js';

export class TargetBuilder {
    /**
     * 基本定義と target オプションから動的判定定義を構築する
     * @param {Object} baseDef - check_definitions にある基本定義
     * @param {Object} target - { successAt, greatSuccessAt, mixedAt, comparison }
     * @returns {Object} 完全検証済みの動的 CheckDefinition
     */
    static build(baseDef, target) {
        if (!baseDef || typeof baseDef !== 'object') {
            throw new Error("[TargetBuilder] baseDef is required and must be an object.");
        }
        if (!target || typeof target !== 'object') {
            throw new Error("[TargetBuilder] target option must be an object.");
        }

        const comparison = target.comparison || ">=";
        if (comparison !== ">=" && comparison !== "<=") {
            throw new Error(`[TargetBuilder] Unsupported comparison: "${comparison}". Expected ">=" or "<="."`);
        }

        const successAt = target.successAt;
        if (!Number.isInteger(successAt)) {
            throw new Error(`[TargetBuilder] target.successAt must be an integer, got: ${successAt}`);
        }

        const greatSuccessAt = target.greatSuccessAt;
        if (greatSuccessAt !== undefined && !Number.isInteger(greatSuccessAt)) {
            throw new Error(`[TargetBuilder] target.greatSuccessAt must be an integer if provided, got: ${greatSuccessAt}`);
        }

        const mixedAt = target.mixedAt;
        if (mixedAt !== undefined && !Number.isInteger(mixedAt)) {
            throw new Error(`[TargetBuilder] target.mixedAt must be an integer if provided, got: ${mixedAt}`);
        }

        const outcomes = [];

        if (comparison === ">=") {
            // 📈 「以上」判定 (Roll-Over: 出目が大きいほど良い)
            if (greatSuccessAt !== undefined && greatSuccessAt <= successAt) {
                throw new Error(`[TargetBuilder] greatSuccessAt (${greatSuccessAt}) must be greater than successAt (${successAt}) for ">=" comparison.`);
            }
            if (mixedAt !== undefined && mixedAt >= successAt) {
                throw new Error(`[TargetBuilder] mixedAt (${mixedAt}) must be less than successAt (${successAt}) for ">=" comparison.`);
            }

            const failMax = mixedAt !== undefined ? mixedAt - 1 : successAt - 1;
            outcomes.push({
                id: "failure",
                min: null,
                max: failMax,
                nameKey: "CHECK_OUTCOME_FAILURE"
            });

            if (mixedAt !== undefined) {
                outcomes.push({
                    id: "mixed",
                    min: mixedAt,
                    max: successAt - 1,
                    nameKey: "CHECK_OUTCOME_MIXED"
                });
            }

            const successMax = greatSuccessAt !== undefined ? greatSuccessAt - 1 : null;
            outcomes.push({
                id: "success",
                min: successAt,
                max: successMax,
                nameKey: "CHECK_OUTCOME_SUCCESS"
            });

            if (greatSuccessAt !== undefined) {
                outcomes.push({
                    id: "great_success",
                    min: greatSuccessAt,
                    max: null,
                    nameKey: "CHECK_OUTCOME_GREAT_SUCCESS"
                });
            }

        } else {
            // 📉 「以下」判定 (Roll-Under: 出目が小さいほど良い)
            if (greatSuccessAt !== undefined && greatSuccessAt >= successAt) {
                throw new Error(`[TargetBuilder] greatSuccessAt (${greatSuccessAt}) must be less than successAt (${successAt}) for "<=" comparison.`);
            }
            if (mixedAt !== undefined && mixedAt <= successAt) {
                throw new Error(`[TargetBuilder] mixedAt (${mixedAt}) must be greater than successAt (${successAt}) for "<=" comparison.`);
            }

            if (greatSuccessAt !== undefined) {
                outcomes.push({
                    id: "great_success",
                    min: null,
                    max: greatSuccessAt,
                    nameKey: "CHECK_OUTCOME_GREAT_SUCCESS"
                });
            }

            const successMin = greatSuccessAt !== undefined ? greatSuccessAt + 1 : null;
            outcomes.push({
                id: "success",
                min: successMin,
                max: successAt,
                nameKey: "CHECK_OUTCOME_SUCCESS"
            });

            if (mixedAt !== undefined) {
                outcomes.push({
                    id: "mixed",
                    min: successAt + 1,
                    max: mixedAt,
                    nameKey: "CHECK_OUTCOME_MIXED"
                });
            }

            const failMin = mixedAt !== undefined ? mixedAt + 1 : successAt + 1;
            outcomes.push({
                id: "failure",
                min: failMin,
                max: null,
                nameKey: "CHECK_OUTCOME_FAILURE"
            });
        }

        const dynamicDef = {
            id: `${baseDef.id}_dynamic_${comparison === ">=" ? "gte" : "lte"}_${successAt}`,
            dice: baseDef.dice,
            outcomes
        };

        // 🛡️ 数学的自己検問: CheckValidator による完全無漏洩・無重複の証明
        CheckValidator.validateDefinition(dynamicDef);

        return dynamicDef;
    }
}
