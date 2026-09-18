import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trialRoot = path.join(repoRoot, "game", "src", "trial");
const guardedRoots = ["flow", "domain", "scenario", "systems"].map(name => path.join(trialRoot, name));
const forbiddenRoots = [
    path.join(trialRoot, "presentation"),
    path.join(repoRoot, "game", "src", "ui")
];

async function collectSourceFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...await collectSourceFiles(fullPath));
        else if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) files.push(fullPath);
    }
    return files;
}

function importedSpecifiers(source) {
    const specs = [];
    const pattern = /(?:import|export)\s+(?:[^"'\n;]*?\s+from\s+)?["']([^"']+)["']/g;
    let match;
    while ((match = pattern.exec(source))) specs.push(match[1]);
    return specs;
}

function isInside(target, root) {
    const relative = path.relative(root, target);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

const violations = [];
for (const root of guardedRoots) {
    for (const file of await collectSourceFiles(root)) {
        const source = await readFile(file, "utf8");
        for (const specifier of importedSpecifiers(source)) {
            if (!specifier.startsWith(".")) continue;
            const resolved = path.resolve(path.dirname(file), specifier);
            const forbidden = forbiddenRoots.find(rootPath => isInside(resolved, rootPath));
            if (!forbidden) continue;
            violations.push({
                file: path.relative(repoRoot, file).replaceAll("\\", "/"),
                specifier,
                forbidden: path.relative(repoRoot, forbidden).replaceAll("\\", "/")
            });
        }
    }
}

assert.deepEqual(
    violations,
    [],
    "Trial core layers must not depend on Presentation/UI layers:\n" + JSON.stringify(violations, null, 2)
);

console.log("✅ Trial core → Presentation/UI import boundary: PASS");
