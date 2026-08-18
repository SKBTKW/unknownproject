// Trial of Ages : Last Ember - Four Directives System (AGENTS.md Rule 2 Synchronized)
(function(exports) {

    const DIRECTIVES = {
        DEVELOPMENT: {
            id: "DEVELOPMENT",
            nameKey: "DIRECTIVE_DEVELOPMENT_NAME",
            descKey: "DIRECTIVE_DEVELOPMENT_DESC",
            icon: "🚩",
            badgeClass: "directive-development",
            categoryMultipliers: { LAND: 3.0 },
            resourceMultipliers: {},
            exploreBonus: 0
        },
        PRODUCTION: {
            id: "PRODUCTION",
            nameKey: "DIRECTIVE_PRODUCTION_NAME",
            descKey: "DIRECTIVE_PRODUCTION_DESC",
            icon: "🌾",
            badgeClass: "directive-production",
            categoryMultipliers: {},
            resourceMultipliers: { food: 1.3, wood: 1.3, defense: 0.8 },
            exploreBonus: 0
        },
        MILITARY: {
            id: "MILITARY",
            nameKey: "DIRECTIVE_MILITARY_NAME",
            descKey: "DIRECTIVE_MILITARY_DESC",
            icon: "🛡️",
            badgeClass: "directive-military",
            categoryMultipliers: { MILITARY: 1.5 },
            resourceMultipliers: { defense: 1.3, wood: 1.3, food: 0.8 },
            exploreBonus: 0
        },
        PRAYER: {
            id: "PRAYER",
            nameKey: "DIRECTIVE_PRAYER_NAME",
            descKey: "DIRECTIVE_PRAYER_DESC",
            icon: "✨",
            badgeClass: "directive-prayer",
            categoryMultipliers: { MYSTIC: 1.5 },
            resourceMultipliers: { mystic: 1.4, defense: 1.4, food: 0.8 },
            exploreBonus: 0
        }
    };

    class DirectiveSystem {
        constructor(state) {
            this.state = state;
            this.currentDirectiveId = "DEVELOPMENT"; // 初期デフォルト: 🚩 開拓方針
            this.changeCount = 0;
            this.lockTurnsRemaining = 0;
            this.unlockedDirectives = ["DEVELOPMENT"]; // 現在は開拓方針のみ稼働
        }

        getCurrentDirective() {
            return DIRECTIVES[this.currentDirectiveId] || DIRECTIVES.DEVELOPMENT;
        }

        getCategoryWeightMultiplier(category) {
            const active = this.getCurrentDirective();
            if (active && active.categoryMultipliers && active.categoryMultipliers[category]) {
                return active.categoryMultipliers[category];
            }
            return 1.0;
        }

        getResourceMultiplier(resourceType) {
            const active = this.getCurrentDirective();
            if (active && active.resourceMultipliers && active.resourceMultipliers[resourceType] !== undefined) {
                return active.resourceMultipliers[resourceType];
            }
            return 1.0;
        }

        getExploreBonus() {
            return 0;
        }

        getChangeCost() {
            if (this.changeCount === 0) return 0; // 初回無料
            return this.changeCount; // 2回目以降 -1, -2, -3...
        }

        canChangeDirective(targetDirectiveId) {
            if (targetDirectiveId === this.currentDirectiveId) {
                return { possible: false, reason: "ALREADY_ACTIVE" };
            }
            if (!this.unlockedDirectives.includes(targetDirectiveId)) {
                return { possible: false, reason: "NOT_UNLOCKED" };
            }
            if (this.lockTurnsRemaining > 0) {
                return { possible: false, reason: "LOCKED", turns: this.lockTurnsRemaining };
            }
            const cost = this.getChangeCost();
            if (this.state && this.state.ember < cost) {
                return { possible: false, reason: "INSUFFICIENT_EMBER", cost };
            }
            return { possible: true, cost };
        }

        changeDirective(targetDirectiveId) {
            const check = this.canChangeDirective(targetDirectiveId);
            if (!check.possible) return check;

            if (check.cost > 0 && this.state) {
                this.state.ember -= check.cost;
            }

            this.currentDirectiveId = targetDirectiveId;
            this.changeCount++;
            this.lockTurnsRemaining = 3; // 3ターン変更不可ロック

            const I18n = (typeof window !== 'undefined' && window.I18n) ? window.I18n : { t: k => k };
            const directiveName = I18n.t(DIRECTIVES[targetDirectiveId].nameKey);
            if (this.state && typeof this.state.addLog === 'function') {
                this.state.addLog(I18n.t("LOG_DIRECTIVE_CHANGED", { name: directiveName, cost: check.cost }));
            }

            return { possible: true, cost: check.cost };
        }

        onTurnEnd() {
            if (this.lockTurnsRemaining > 0) {
                this.lockTurnsRemaining--;
            }
        }
    }

    exports.DIRECTIVES = DIRECTIVES;
    exports.DirectiveSystem = DirectiveSystem;

})(typeof exports !== 'undefined' ? exports : window);
