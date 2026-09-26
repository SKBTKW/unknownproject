export const STAGE1_TRIAL1_LIVE_ENVELOPE_20260924 = Object.freeze([
    Object.freeze({ id: "LIVE_SEED_20260920", food: 431, material: 409, defense: 36 }),
    Object.freeze({ id: "LIVE_SEED_20260921", food: 400, material: 282, defense: 24 }),
    Object.freeze({ id: "LIVE_SEED_20260922", food: 513, material: 388, defense: 26 }),
    Object.freeze({ id: "LIVE_SEED_20260923", food: 576, material: 222, defense: 22 }),
    Object.freeze({ id: "LIVE_SEED_20260924", food: 366, material: 248, defense: 24 }),
    Object.freeze({ id: "LIVE_SEED_20260925", food: 615, material: 281, defense: 21 }),
    Object.freeze({ id: "LIVE_SEED_20260926", food: 480, material: 347, defense: 27 }),
    Object.freeze({ id: "LIVE_SEED_20260927", food: 404, material: 340, defense: 32 })
]);

export const STAGE1_TRIAL1_DEPLOYMENT_COST_CANDIDATES = Object.freeze({
    SOFT: Object.freeze({
        status: "RESOLVED",
        food: Object.freeze({ base: 80, perDefense: 5, perDistance: 16 }),
        material: Object.freeze({ base: 60, perDefense: 4.5, perDistance: 3 })
    }),
    DRAMATIC: Object.freeze({
        status: "RESOLVED",
        food: Object.freeze({ base: 100, perDefense: 6, perDistance: 20 }),
        material: Object.freeze({ base: 70, perDefense: 5.5, perDistance: 4 })
    }),
    RESILIENT: Object.freeze({
        status: "RESOLVED",
        food: Object.freeze({ base: 80, perDefense: 6.5, perDistance: 13 }),
        material: Object.freeze({ base: 40, perDefense: 4.5, perDistance: 9 })
    }),
    OVERLOAD: Object.freeze({
        status: "RESOLVED",
        food: Object.freeze({ base: 110, perDefense: 6.5, perDistance: 22 }),
        material: Object.freeze({ base: 80, perDefense: 6, perDistance: 5 })
    })
});

export default STAGE1_TRIAL1_DEPLOYMENT_COST_CANDIDATES;
