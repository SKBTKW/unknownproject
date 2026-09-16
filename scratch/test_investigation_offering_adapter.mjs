import {
    InvestigationOfferingPolicy,
    InvestigationOfferingAdapter
} from '../game/src/warning/index.js';

const base = [
    { id: 'BASE_A', category: 'LAND' },
    { id: 'BASE_B', category: 'COMMAND' }
];

const policy = new InvestigationOfferingPolicy();

if (policy.isEligible({ category: 'INVESTIGATION', reqInvestigationUnlocked: true }, { investigationUnlocked: false })) {
    throw new Error('locked investigation card became eligible');
}
if (!policy.isEligible({ category: 'INVESTIGATION', reqInvestigationUnlocked: true }, { investigationUnlocked: true })) {
    throw new Error('unlocked investigation card remained ineligible');
}
if (!policy.isEligible({ category: 'LAND' }, { investigationUnlocked: false })) {
    throw new Error('non-investigation card was blocked');
}

const adapter = new InvestigationOfferingAdapter({ policy });
const locked = adapter.extendMaster(base, { investigationUnlocked: false });
const unlocked = adapter.extendMaster(base, { investigationUnlocked: true });

if (locked.length !== base.length) {
    throw new Error('locked investigation cards leaked into master');
}
if (unlocked.length <= base.length) {
    throw new Error('unlocked investigation cards were not added');
}
if (!unlocked.some(card => card.id === 'INVESTIGATE_FOOTPRINTS')) {
    throw new Error('footprints investigation card missing');
}
if (!unlocked.some(card => card.id === 'BASE_A') || !unlocked.some(card => card.id === 'BASE_B')) {
    throw new Error('base master was damaged');
}

console.log('PASS investigation offering adapter');
