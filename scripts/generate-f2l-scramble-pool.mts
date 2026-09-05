// Generates src/data/f2l-scramble-pool.ts: for every F2L case, a pool of short
// setup scrambles that reach the case without mirroring the solving algorithm.
//
// Run with: npm run generate:scrambles   (a few minutes; the output is
// committed, so this only needs re-running when the generator or the case
// definitions change).
//
// How: the case pattern is built from the speedcubedb setup alg. The last
// layer's 8 pieces are marked indistinguishable and orientation-free, and
// twsearch is asked for solutions of that reduced pattern under several
// generator subsets (RUF, LUF, RUB, RUD, ...) and minimum depths. Each
// solution's inverse is a scramble that places the pair exactly, while the
// rest of the top layer is whatever the search happened to leave. Scrambles
// that are just the inverse of a known algorithm for the case are dropped.
//
// Each case runs in its own child process: cubing.js spawns a worker per
// search and leaks across hundreds of searches (slowdown, then OOM).
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { KPattern } from 'cubing/kpuzzle';
import { ALL_F2LS } from '@/data/f2l-definitions';
import type { F2LDefinition } from '@/types/f2l';

const GENERATOR_SETS: string[][] = [
  ['R', 'U', 'F'], ['L', 'U', 'F'], ['R', 'U', 'B'], ['L', 'U', 'B'],
  ['R', 'U', 'D'], ['L', 'U', 'D'], ['F', 'U', 'D'], ['B', 'U', 'D'],
  ['R', 'U', 'L'], ['F', 'U', 'B'], ['R', 'U', 'F', 'D'], ['L', 'U', 'B', 'D'],
];
const MIN_DEPTHS = [0, 8, 9];
const MAX_DEPTH = 10;
// When a case yields few distinct scrambles, dig one move deeper with the
// three-face subsets only (four-face subsets get slow past depth 10).
const RETRY_BELOW = 4;
const RETRY_MIN_DEPTHS = [10, 11];
const RETRY_MAX_DEPTH = 11;
const MAX_PER_CASE = 12;

const RESULT_PREFIX = 'POOL_RESULT ';

interface CaseResult {
  scrambles: string[];
  failures: number;
  ms: number;
  inconsistentPresets: string[];
}

async function generateCase(def: F2LDefinition): Promise<CaseResult> {
  const { Alg } = await import('cubing/alg');
  const { KPattern: KPatternClass } = await import('cubing/kpuzzle');
  const { cube3x3x3 } = await import('cubing/puzzles');
  const { experimentalSolveTwips } = await import('cubing/search');
  const { F2L_PRESET_ALGORITHMS } = await import('@/data/f2l-preset-algorithms');
  const { rotationNeutral } = await import('@/lib/cube-rotation');
  const { invertAlg } = await import('@/lib/invert-alg');
  const { normalizeAlg } = await import('@/lib/normalize-alg');

  const t0 = performance.now();
  const kpuzzle = await cube3x3x3.kpuzzle();
  const solved = kpuzzle.defaultPattern();

  type Orbit = 'EDGES' | 'CORNERS';
  const uLayerPieces = (orbit: Orbit): Set<number> => {
    const afterU = solved.applyAlg(new Alg('U')).patternData[orbit].pieces;
    return new Set(afterU.map((p: number, i: number) => (p !== i ? i : -1)).filter((i: number) => i >= 0));
  };
  const LL: Record<Orbit, Set<number>> = { EDGES: uLayerPieces('EDGES'), CORNERS: uLayerPieces('CORNERS') };

  const centersHome = (p: KPattern) => p.patternData.CENTERS.pieces.every((c, i) => c === i);
  const f2lHome = (p: KPattern) =>
    (['EDGES', 'CORNERS'] as Orbit[]).every((orbit) => {
      const o = p.patternData[orbit];
      return o.pieces.every((piece, i) => LL[orbit].has(i) || (piece === i && o.orientation[i] === 0));
    });

  const ignoreLastLayer = (pattern: KPattern): KPattern => {
    const data = structuredClone(pattern.patternData);
    for (const orbit of ['EDGES', 'CORNERS'] as Orbit[]) {
      const o = data[orbit];
      const rep = Math.min(...LL[orbit]);
      const orientationMod: number[] = o.orientationMod ?? o.pieces.map(() => 0);
      o.orientationMod = orientationMod;
      o.pieces.forEach((piece: number, i: number) => {
        if (LL[orbit].has(piece)) {
          o.pieces[i] = rep;
          o.orientation[i] = 0;
          orientationMod[i] = 1;
        }
      });
    }
    data.CENTERS.orientationMod = data.CENTERS.pieces.map(() => 1);
    data.CENTERS.orientation = data.CENTERS.pieces.map(() => 0);
    return new KPatternClass(kpuzzle, data);
  };
  const target = ignoreLastLayer(solved);

  const setup = rotationNeutral(def.setupAlg);
  const casePattern = solved.applyAlg(new Alg(setup));
  if (!centersHome(casePattern)) throw new Error(`${def.id}: setup "${setup}" leaves the cube rotated`);

  // Every preset must be rotation-neutral after compensation (this doubles as
  // a test of lib/cube-rotation against cubing.js). A preset that does not
  // actually solve the case is a data problem in the preset list, not in this
  // generator: report it and leave it out of the "revealing" filter.
  const inconsistentPresets: string[] = [];
  const presets = F2L_PRESET_ALGORITHMS[def.id].map((alg) => rotationNeutral(alg)).filter((alg) => {
    if (!centersHome(solved.applyAlg(new Alg(alg)))) throw new Error(`${def.id}: "${alg}" is not rotation-neutral`);
    const solves = f2lHome(casePattern.applyAlg(new Alg(alg)));
    if (!solves) inconsistentPresets.push(`${def.id}: "${alg}"`);
    return solves;
  });
  if (presets.length === 0) throw new Error(`${def.id}: no preset algorithm solves the case`);
  const primary = presets[0];
  const solvesCase = (scramble: string) =>
    f2lHome(solved.applyAlg(new Alg(scramble)).applyAlg(new Alg(primary)));
  const revealing = new Set(presets.map((alg) => normalizeAlg(invertAlg(alg))));

  // A leading U turn on a scramble only moves last-layer pieces (the cube is
  // F2L-solved at that point), so it is dead weight; a trailing one may or may
  // not move the pair, so it is only dropped when the case survives.
  const trimFreeU = (scramble: string): string => {
    let tokens = scramble.split(' ');
    while (tokens.length > 1 && tokens[0].startsWith('U')) tokens = tokens.slice(1);
    if (tokens.length > 1 && tokens[tokens.length - 1].startsWith('U')) {
      const shorter = tokens.slice(0, -1).join(' ');
      if (solvesCase(shorter)) return shorter;
    }
    return tokens.join(' ');
  };

  const reduced = ignoreLastLayer(casePattern);
  const found = new Map<string, number>();
  let failures = 0;
  const run = async (gens: string[], minDepth: number, maxDepth: number) => {
    try {
      const solution = await experimentalSolveTwips(kpuzzle, reduced, {
        targetPattern: target,
        generatorMoves: gens,
        minDepth: minDepth || undefined,
        maxDepth,
      });
      const raw = normalizeAlg(solution.invert().toString());
      if (!solvesCase(raw)) return;
      const scramble = trimFreeU(raw);
      if (revealing.has(scramble)) return;
      if (!found.has(scramble)) found.set(scramble, scramble.split(' ').length);
    } catch {
      failures++;
    }
  };

  for (const gens of GENERATOR_SETS) for (const d of MIN_DEPTHS) await run(gens, d, MAX_DEPTH);
  if (found.size < RETRY_BELOW) {
    for (const gens of GENERATOR_SETS.filter((g) => g.length === 3)) {
      for (const d of RETRY_MIN_DEPTHS) await run(gens, d, RETRY_MAX_DEPTH);
    }
  }

  const scrambles = [...found.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([s]) => s)
    .slice(0, MAX_PER_CASE);
  return { scrambles, failures, ms: Math.round(performance.now() - t0), inconsistentPresets };
}

function runChild(def: F2LDefinition): CaseResult {
  const child = spawnSync(
    process.execPath,
    [...process.execArgv, import.meta.filename, '--case', def.id],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const line = child.stdout.split('\n').find((l) => l.startsWith(RESULT_PREFIX));
  if (child.status !== 0 || !line) {
    throw new Error(`${def.id}: child process failed\n${child.stderr}\n${child.stdout}`);
  }
  return JSON.parse(line.slice(RESULT_PREFIX.length)) as CaseResult;
}

const caseArg = process.argv.indexOf('--case');
if (caseArg !== -1) {
  const id = process.argv[caseArg + 1];
  const def = ALL_F2LS.find((d) => d.id === id);
  if (!def) throw new Error(`unknown case ${id}`);
  const result = await generateCase(def);
  console.log(RESULT_PREFIX + JSON.stringify(result));
  process.exit(0);
}

const startedAt = performance.now();
const pool: Record<string, string[]> = {};
const inconsistentPresets: string[] = [];
for (const def of ALL_F2LS) {
  const result = runChild(def);
  pool[def.id] = result.scrambles;
  inconsistentPresets.push(...result.inconsistentPresets);
  console.log(
    `${def.id.padEnd(7)} ${String(result.scrambles.length).padStart(2)} scrambles ${String(result.ms).padStart(6)} ms` +
      `  (${result.failures} searches without solution)  e.g. ${result.scrambles[0] ?? '-'}`,
  );
}

const totalSec = ((performance.now() - startedAt) / 1000).toFixed(1);
const lines = ALL_F2LS.map((def) => `  '${def.id}': [${pool[def.id].map((s) => JSON.stringify(s)).join(', ')}],`);
const output = `// Generated by scripts/generate-f2l-scramble-pool.mts. Do not edit by hand;
// run \`npm run generate:scrambles\` instead.
//
// Short setup scrambles per F2L case, applied to a cube whose first two layers
// are solved (the last layer does not matter). Each one places the pair into
// the case without being the inverse of a known algorithm for that case.
// Last-layer pieces end up wherever the search left them.

import type { F2LId } from '@/types/f2l';

export const F2L_SCRAMBLE_POOL: Record<F2LId, readonly string[]> = {
${lines.join('\n')}
};
`;
const outPath = resolve(import.meta.dirname, '..', 'src', 'data', 'f2l-scramble-pool.ts');
writeFileSync(outPath, output);
const total = Object.values(pool).reduce((n, s) => n + s.length, 0);
console.log(`\nWrote ${outPath}: ${total} scrambles for ${ALL_F2LS.length} cases in ${totalSec}s`);
if (inconsistentPresets.length > 0) {
  console.log('\nPreset algorithms that do not solve their case (check src/data/f2l-preset-algorithms.ts):');
  for (const line of inconsistentPresets) console.log(`  ${line}`);
}
