// Runs the two-phase search off the main thread: building its tables takes a
// few hundred milliseconds, and a search can take as long. Messages are
// answered in order; see scramble-client.ts.

import type { CubeState, Face } from '@/lib/smart-cube/cube-state';
import { initTwoPhase } from '@/lib/solver/two-phase';
import { generateModeScramble } from '@/lib/solve/mode-scramble';
import { routeBetween } from '@/lib/solve/scramble';
import type { SolveMode } from '@/lib/solve/solve-modes';

export type ScrambleRequest =
  | { id: number; type: 'init' }
  /** A scramble for a mode (CFOP when absent), its cross left on `face` as the scramble is written. */
  | { id: number; type: 'scramble'; mode?: SolveMode; face?: Face }
  | { id: number; type: 'route'; from: CubeState; to: CubeState; timeLimitMs: number };

export interface ScrambleResponse {
  id: number;
  result?: unknown;
  error?: string;
}

addEventListener('message', (event: MessageEvent<ScrambleRequest>) => {
  const request = event.data;
  const reply = (response: Omit<ScrambleResponse, 'id'>) => postMessage({ id: request.id, ...response });
  try {
    if (request.type === 'init') {
      initTwoPhase();
      reply({ result: true });
    } else if (request.type === 'scramble') reply({ result: generateModeScramble(request.mode ?? 'cfop', request.face) });
    else reply({ result: routeBetween(request.from, request.to, request.timeLimitMs) });
  } catch (error) {
    reply({ error: error instanceof Error ? error.message : String(error) });
  }
});
