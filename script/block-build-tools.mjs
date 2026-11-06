// Used by the API smoke test to simulate a runtime without build tooling.
export async function resolve(specifier, context, nextResolve) {
  if (/^(vite|rollup|@vitejs\/|@rollup\/|@replit\/vite-plugin)/.test(specifier)) {
    throw new Error(`Build-only dependency reached API runtime: ${specifier}`);
  }
  return nextResolve(specifier, context);
}