import assert from "assert";
import { CheckSystem } from "../game/src/core/check_system/check_system.js";

console.log("=== Flexible Dice Check Contract ===");

const def = ({ id, count, sides, keep = "all", outcomes }) => ({
    id,
    dice: { count, sides, keep },
    resolution: { type: "sum" },
    outcomes
});

// 2D6 + arbitrary outcome table
{
    const system = new CheckSystem({ seed: 12345 });
    const result = system.resolveDefinition({
        definition: def({
            id: "runtime_2d6",
            count: 2,
            sides: 6,
            outcomes: [
                { max: 4, id: "low" },
                { min: 5, max: 7, id: "medium" },
                { min: 8, id: "high" }
            ]
        })
    });

    assert.strictEqual(result.dice.rolled.length, 2);
    assert.strictEqual(result.dice.kept.length, 2);
    assert.ok(["low", "medium", "high"].includes(result.outcome.id));
}

// 5D6 keep highest 3
{
    const system = new CheckSystem({ seed: 54321 });
    const result = system.resolveDefinition({
        definition: def({
            id: "runtime_5d6_highest_3",
            count: 5,
            sides: 6,
            keep: "highest_3",
            outcomes: [
                { max: 9, id: "low" },
                { min: 10, max: 14, id: "medium" },
                { min: 15, id: "high" }
            ]
        })
    });

    assert.strictEqual(result.dice.rolled.length, 5);
    assert.strictEqual(result.dice.kept.length, 3);
    assert.strictEqual(result.dice.dropped.length, 2);
    assert.strictEqual(result.rawTotal, result.dice.kept.reduce((sum, v) => sum + v, 0));
}

// 10D2
{
    const system = new CheckSystem({ seed: 777 });
    const result = system.resolveDefinition({
        definition: def({
            id: "runtime_10d2",
            count: 10,
            sides: 2,
            outcomes: [
                { max: 14, id: "low" },
                { min: 15, id: "high" }
            ]
        })
    });

    assert.strictEqual(result.dice.rolled.length, 10);
    assert.ok(result.dice.rolled.every(v => v === 1 || v === 2));
    assert.ok(result.rawTotal >= 10 && result.rawTotal <= 20);
}

// deterministic equal-seed runtime check
{
    const definition = def({
        id: "runtime_determinism",
        count: 5,
        sides: 6,
        keep: "highest_3",
        outcomes: [
            { max: 9, id: "low" },
            { min: 10, id: "high" }
        ]
    });

    const a = new CheckSystem({ seed: 424242 });
    const b = new CheckSystem({ seed: 424242 });
    assert.deepStrictEqual(
        b.resolveDefinition({ definition }),
        a.resolveDefinition({ definition })
    );
}

// getState / setState resumes exact sequence
{
    const definition = def({
        id: "runtime_restore",
        count: 2,
        sides: 6,
        outcomes: [
            { max: 6, id: "low" },
            { min: 7, id: "high" }
        ]
    });

    const system = new CheckSystem({ seed: 98765 });
    system.resolveDefinition({ definition });
    const snapshot = system.getState();

    const expected = system.resolveDefinition({ definition });
    system.setState(snapshot);
    const restored = system.resolveDefinition({ definition });

    assert.deepStrictEqual(restored, expected);
}

// Fail fast: bad dice / unsupported resolution / outcome gap
{
    const system = new CheckSystem({ seed: 1 });

    assert.throws(
        () => system.resolveDefinition({
            definition: def({
                id: "bad_count",
                count: 0,
                sides: 6,
                outcomes: [{ id: "all" }]
            })
        }),
        /dice\.count must be an integer >= 1/
    );

    assert.throws(
        () => system.resolveDefinition({
            definition: {
                id: "bad_resolution",
                dice: { count: 2, sides: 6, keep: "all" },
                resolution: { type: "success_count", successAt: 5 },
                outcomes: [{ id: "all" }]
            }
        }),
        /Unsupported resolution type/
    );

    assert.throws(
        () => system.resolveDefinition({
            definition: def({
                id: "gap",
                count: 2,
                sides: 6,
                outcomes: [
                    { max: 5, id: "a" },
                    { min: 7, id: "b" }
                ]
            })
        }),
        /Gap detected/
    );
}

// Existing named-check entry point remains unchanged.
{
    const system = new CheckSystem({ seed: 24680 });
    const result = system.resolve({ checkId: "standard_2d6" });
    assert.strictEqual(result.checkId, "standard_2d6");
    assert.strictEqual(result.dice.kept.length, 2);
}

console.log("Flexible Dice Check Contract: PASS");
