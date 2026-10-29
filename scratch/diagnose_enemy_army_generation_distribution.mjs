import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeArmyDistribution, distributionMarkdown, validateSeedRange } from './enemy_army_generation_distribution.mjs';

export function parseDistributionArgs(args) {
    const options = { count: 1000, startSeed: 0, models: ['A','B','C'], format: 'json' };
    const seen = new Set();
    for (let i=0;i<args.length;i++) {
        const key=args[i]; if(seen.has(key)) throw Error('DISTRIBUTION_DUPLICATE_OPTION'); seen.add(key);
        if(key==='--json'||key==='--markdown') {
            if(seen.has(key==='--json'?'--markdown':'--json')) throw Error('DISTRIBUTION_FORMAT_CONFLICT');
            options.format=key.slice(2); continue;
        }
        if(!['--count','--start','--models'].includes(key)) throw Error('DISTRIBUTION_UNKNOWN_OPTION');
        const value=args[++i]; if(value===undefined) throw Error('DISTRIBUTION_VALUE_REQUIRED');
        if(key==='--models') options.models=value.split(',');
        else {
            if(!/^[0-9]+$/.test(value)) throw Error('DISTRIBUTION_INTEGER_REQUIRED');
            options[key==='--count'?'count':'startSeed']=Number(value);
        }
    }
    validateSeedRange(options.count,options.startSeed);
    if(!options.models.length||new Set(options.models).size!==options.models.length||options.models.some(m=>!['A','B','C'].includes(m))) throw Error('DISTRIBUTION_MODELS_INVALID');
    return options;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
    try {
        const options=parseDistributionArgs(process.argv.slice(2)); const report=analyzeArmyDistribution(options);
        process.stdout.write(options.format==='markdown'?distributionMarkdown(report):JSON.stringify(report,null,2)+'\n');
        if(Object.values(report.results).some(r=>r.generationFailures||r.replayMismatches||r.replayErrors))process.exitCode=1;
    } catch(error) { process.stderr.write(`${error.message}\n`);process.exitCode=1; }
}
