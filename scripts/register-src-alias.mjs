// Node module hook so scripts can import app modules through the `@/` alias
// used in tsconfig (`@/x` -> `src/x.ts`). Used via `node --import`.
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');

register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, next) {
      if (specifier.startsWith('@/')) {
        const url = new URL(${JSON.stringify(pathToFileURL(srcDir + '/').href)} + specifier.slice(2) + '.ts');
        return { url: url.href, shortCircuit: true };
      }
      return next(specifier, context);
    }
  `)}`,
);
