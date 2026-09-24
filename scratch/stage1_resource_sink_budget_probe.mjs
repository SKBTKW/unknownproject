export function resolveTotalSpendShare({
    preTrialSpendShare = 0,
    deploymentSpendShare = 0
} = {}) {
    const pre = Math.min(1, Math.max(0, Number(preTrialSpendShare) || 0));
    const deployment = Math.min(1, Math.max(0, Number(deploymentSpendShare) || 0));
    return 1 - ((1 - pre) * (1 - deployment));
}

export function resolveRequiredPreTrialSpendShare({
    targetTotalSpendShare,
    deploymentSpendShare
} = {}) {
    const target = Math.min(1, Math.max(0, Number(targetTotalSpendShare) || 0));
    const deployment = Math.min(0.999999, Math.max(0, Number(deploymentSpendShare) || 0));
    return Math.min(1, Math.max(0, 1 - ((1 - target) / (1 - deployment))));
}

export function projectStage1SinkBudget({
    sample,
    preTrialSpendShare,
    deploymentSpendShare
} = {}) {
    const food = Math.max(0, Number(sample?.food) || 0);
    const material = Math.max(0, Number(sample?.material) || 0);
    const pre = Math.min(1, Math.max(0, Number(preTrialSpendShare) || 0));
    const deployment = Math.min(1, Math.max(0, Number(deploymentSpendShare) || 0));

    const preTrialFoodSpend = Math.round(food * pre);
    const preTrialMaterialSpend = Math.round(material * pre);
    const foodBeforeDeployment = food - preTrialFoodSpend;
    const materialBeforeDeployment = material - preTrialMaterialSpend;

    const deploymentFoodSpend = Math.round(foodBeforeDeployment * deployment);
    const deploymentMaterialSpend = Math.round(materialBeforeDeployment * deployment);

    return Object.freeze({
        sampleId: sample?.id || null,
        baselineFood: food,
        baselineMaterial: material,
        preTrialSpendShare: pre,
        deploymentSpendShare: deployment,
        totalSpendShare: resolveTotalSpendShare({
            preTrialSpendShare: pre,
            deploymentSpendShare: deployment
        }),
        preTrialFoodSpend,
        preTrialMaterialSpend,
        foodBeforeDeployment,
        materialBeforeDeployment,
        deploymentFoodSpend,
        deploymentMaterialSpend,
        finalFood: foodBeforeDeployment - deploymentFoodSpend,
        finalMaterial: materialBeforeDeployment - deploymentMaterialSpend
    });
}

export const STAGE1_V15_BASELINE_ENVELOPE_20260924 = Object.freeze([
    Object.freeze({ id: "FIRST_LEGAL_MIN", food: 164, material: 215 }),
    Object.freeze({ id: "FIRST_LEGAL_MAX", food: 437, material: 326 }),
    Object.freeze({ id: "GROWTH_MIN", food: 329, material: 227 }),
    Object.freeze({ id: "GROWTH_MAX", food: 580, material: 411 })
]);

export const STAGE1_SINK_BUDGET_BANDS = Object.freeze([
    Object.freeze({
        id: "TOTAL_70",
        targetTotalSpendShare: 0.70,
        deploymentSpendShare: 0.40
    }),
    Object.freeze({
        id: "TOTAL_75",
        targetTotalSpendShare: 0.75,
        deploymentSpendShare: 0.45
    }),
    Object.freeze({
        id: "TOTAL_80",
        targetTotalSpendShare: 0.80,
        deploymentSpendShare: 0.50
    })
]);
