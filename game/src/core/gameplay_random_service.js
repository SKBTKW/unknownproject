import { RandomSource } from './check_system/random_source.js';

const GAMEPLAY_STREAM_SALT = 0x9E3779B9;

function normalizeSeed(seed) {
    return (Number.isFinite(seed) ? Math.trunc(seed) : 0) >>> 0;
}

export class GameplayRandomService {
    constructor(runSeed = 0) {
        this.source = new RandomSource((normalizeSeed(runSeed) ^ GAMEPLAY_STREAM_SALT) >>> 0);
        this.sequence = 0;
    }

    nextFloat() {
        return this.source.nextFloat();
    }

    nextInt(min, max) {
        return this.source.nextInt(min, max);
    }

    shuffle(items) {
        if (!Array.isArray(items)) throw new TypeError('GAMEPLAY_RANDOM_ARRAY_REQUIRED');
        for (let i = items.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [items[i], items[j]] = [items[j], items[i]];
        }
        return items;
    }

    pick(items) {
        if (!Array.isArray(items) || items.length === 0) return null;
        return items[this.nextInt(0, items.length - 1)];
    }

    nextId(prefix = 'rng', scope = null) {
        this.sequence += 1;
        return [prefix, scope, this.sequence].filter(value => value !== null && value !== undefined).join('_');
    }

    getState() {
        return {
            source: this.source.getState(),
            sequence: this.sequence
        };
    }

    setState(savedState) {
        if (!savedState || typeof savedState !== 'object' || !savedState.source) {
            throw new Error('GAMEPLAY_RANDOM_STATE_REQUIRED');
        }
        this.source.setState(savedState.source);
        if (!Number.isInteger(savedState.sequence) || savedState.sequence < 0) {
            throw new Error('GAMEPLAY_RANDOM_SEQUENCE_INVALID');
        }
        this.sequence = savedState.sequence;
    }
}

export default GameplayRandomService;
