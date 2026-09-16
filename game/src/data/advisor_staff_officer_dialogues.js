const freezeSegments = segments => Object.freeze([...segments]);
const freezeLocalized = localized => Object.freeze(Object.fromEntries(
    Object.entries(localized || {}).map(([lang, segments]) => [lang, freezeSegments(segments)])
));
const freezeEntry = entry => Object.freeze({
    ...entry,
    localizedSegments: freezeLocalized(entry.localizedSegments)
});

// Character-specific Advisor Advice. Missing events intentionally fall back to shared dialogue.
// Localized authored text lives with dialogue data so the shared i18n dictionary remains untouched.
export const STAFF_OFFICER_DIALOGUES = Object.freeze({
    EMBER_WARNING: freezeEntry({
        policyKey: "ember", priority: 90, cooldownMs: 0, durationMs: 4200,
        localizedSegments: {
            ja: ["余力が落ち始めています。", "この負担が続けば、維持に響きます。", "今は余計な消耗を抑えるべきです。"],
            en: ["Our remaining margin is beginning to shrink.", "If this burden continues, it will affect our ability to sustain operations.", "We should avoid unnecessary strain for now."]
        }
    }),
    EMBER_CRITICAL: freezeEntry({
        policyKey: "ember", priority: 100, cooldownMs: 0, durationMs: 4600,
        localizedSegments: {
            ja: ["余力が危険域まで落ちています。", "これ以上の負担は維持できません。", "回復を最優先にしてください。"],
            en: ["Our remaining margin has fallen to a dangerous level.", "We cannot sustain any further burden at this rate.", "Recovery should take priority."]
        }
    }),
    EMBER_RECOVERED: freezeEntry({
        policyKey: "ember", priority: 55, cooldownMs: 0, durationMs: 3600,
        localizedSegments: {
            ja: ["余力は戻りつつあります。", "当面の維持には支障ありません。", "今の余裕を崩さないようにしましょう。"],
            en: ["Our margin is beginning to recover.", "We can maintain present operations for the time being.", "I would keep this margin intact."]
        }
    }),
    FOOD_WARNING: freezeEntry({
        policyKey: "logistics", priority: 70, cooldownMs: 0, durationMs: 3900,
        localizedSegments: {
            ja: ["食料備蓄の減りが早まっています。", "今の消費速度では、余裕を残せません。", "補充か消費の抑制を検討してください。"],
            en: ["Food reserves are being depleted more quickly.", "At this rate of consumption, we will retain no margin.", "Consider replenishing stocks or reducing consumption."]
        }
    }),
    FOOD_CRITICAL: freezeEntry({
        policyKey: "logistics", priority: 95, cooldownMs: 0, durationMs: 4400,
        localizedSegments: {
            ja: ["食料備蓄が危険域です。", "現状の消費は維持できません。", "まず補充を優先してください。"],
            en: ["Food reserves are at a dangerous level.", "Current consumption cannot be sustained.", "Replenishment should come first."]
        }
    }),
    FOOD_RECOVERED: freezeEntry({
        policyKey: "logistics", priority: 50, cooldownMs: 0, durationMs: 3500,
        localizedSegments: {
            ja: ["食料備蓄は持ち直しました。", "当面の配給は維持できます。", "この余裕は維持しておきたいところです。"],
            en: ["Food reserves have recovered.", "Rations can be maintained for the time being.", "I would preserve this margin."]
        }
    }),
    DEFENSE_WEAK: freezeEntry({
        policyKey: "defense", priority: 70, cooldownMs: 0, durationMs: 3900,
        localizedSegments: {
            ja: ["即応可能な戦備に余裕がありません。", "損耗が出た場合の補充も厳しい状態です。", "増強するなら、今のうちです。"],
            en: ["Our immediately available defenses have little margin.", "Replacing losses would also be difficult in this condition.", "If we are to reinforce, now is the time."]
        }
    }),
    DEFENSE_CRITICAL: freezeEntry({
        policyKey: "defense", priority: 95, cooldownMs: 0, durationMs: 4400,
        localizedSegments: {
            ja: ["防衛準備が著しく不足しています。", "大きな損耗には耐えられない状態です。", "防衛力の確保を優先してください。"],
            en: ["Our defensive preparations are severely lacking.", "We are not in a condition to absorb major losses.", "Securing defensive strength should take priority."]
        }
    }),
    DEFENSE_HEALTHY: freezeEntry({
        policyKey: "defense", priority: 35, cooldownMs: 0, durationMs: 3400,
        localizedSegments: {
            ja: ["即応可能な戦備は確保できています。", "配置変更にも対応できる余裕があります。", "この状態を維持できれば十分です。"],
            en: ["We have sufficient forces immediately available.", "There is enough margin to adjust deployments.", "Maintaining this condition will be sufficient."]
        }
    }),
    FIRST_ZONE_COMPLETED: freezeEntry({
        policyKey: "development", priority: 75, cooldownMs: Infinity, durationMs: 4200,
        localizedSegments: {
            ja: ["地帯としての成立を確認しました。", "土地を一つのまとまりとして扱える状態です。", "維持する範囲としても把握しておきます。"],
            en: ["The zone is now established.", "The land can now be treated as one coherent area.", "I will account for it as a single area to maintain."]
        }
    }),
    ZONE_COMPLETED: freezeEntry({
        policyKey: "development", priority: 25, cooldownMs: 0, durationMs: 3300,
        localizedSegments: {
            ja: ["新しい地帯を確認しました。", "維持対象が一つ増えます。", "補給の負担も合わせて見ておきます。"],
            en: ["Another zone is established.", "That adds another area we must maintain.", "I will account for the added supply burden as well."]
        }
    }),
    FIRST_LINK_COMPLETED: freezeEntry({
        policyKey: "connection", priority: 80, cooldownMs: Infinity, durationMs: 4200,
        localizedSegments: {
            ja: ["地帯間の接続を確認しました。", "人員と物資を動かしやすくなります。", "この経路は維持しておきたいところです。"],
            en: ["Connection between the zones confirmed.", "Personnel and supplies can move more easily now.", "This route is worth keeping intact."]
        }
    }),
    LINK_COMPLETED: freezeEntry({
        policyKey: "connection", priority: 50, cooldownMs: 0, durationMs: 3500,
        localizedSegments: {
            ja: ["接続が一つ増えました。", "輸送の選択肢が広がります。", "経路の維持状況も確認しておきます。"],
            en: ["Another connection is in place.", "That gives us more options for moving supplies.", "I will keep track of the route's condition as well."]
        }
    }),
    BOARD_FRAGMENTED: freezeEntry({
        policyKey: "connection", priority: 65, cooldownMs: 0, durationMs: 3900,
        localizedSegments: {
            ja: ["地帯が分断されています。", "人員と物資の移動に無駄が出ます。", "接続を確保した方が維持しやすくなります。"],
            en: ["The zones are fragmented.", "That wastes time moving personnel and supplies.", "Securing connections would make them easier to maintain."]
        }
    }),
    CONNECTION_HEALTHY: freezeEntry({
        policyKey: "connection", priority: 35, cooldownMs: 0, durationMs: 3400,
        localizedSegments: {
            ja: ["輸送経路は安定しています。", "一部が塞がれても、迂回の余地があります。", "この運用余地は維持しておきたいところです。"],
            en: ["Our transport routes are stable.", "We still have room to reroute if one route is blocked.", "That operational flexibility is worth preserving."]
        }
    }),
    MAJOR_DEVELOPMENT: freezeEntry({
        policyKey: "development", priority: 30, cooldownMs: 0, durationMs: 3400,
        localizedSegments: {
            ja: ["領域が広がりました。", "同時に、維持する範囲も増えています。", "補給と防衛の負担を再確認します。"],
            en: ["Our territory has expanded.", "The area we must maintain has expanded with it.", "I will reassess the supply and defense burden."]
        }
    })
});
