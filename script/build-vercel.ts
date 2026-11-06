import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, cp, mkdir, writeFile, copyFile } from "fs/promises";

// Produces Vercel's Build Output API (v3): the static site plus one Node
// function that runs the Express API (server/vercelHandler.ts).
const OUT = ".vercel/output";
const FN = `${OUT}/functions/api/index.func`;

async function main() {
  await rm("dist", { recursive: true, force: true });
  await rm(OUT, { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();
  await mkdir(OUT, { recursive: true });
  await cp("dist/public", `${OUT}/static`, { recursive: true });
  // Same app shell, served with a real 404 status for paths the router does not know.
  await copyFile(`${OUT}/static/index.html`, `${OUT}/static/404.html`);

  console.log("bundling API function...");
  await esbuild({
    entryPoints: ["server/vercelHandler.ts"],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: `${FN}/index.cjs`,
    define: { "process.env.NODE_ENV": '"production"' },
    external: ["bufferutil", "utf-8-validate", "pg-native", "sharp"],
    footer: { js: "module.exports = module.exports.default || module.exports;" },
    logLevel: "info",
  });
  await writeFile(
    `${FN}/.vc-config.json`,
    JSON.stringify({ runtime: "nodejs22.x", handler: "index.cjs", launcherType: "Nodejs", maxDuration: 60 }, null, 2),
  );
  await writeFile(
    `${OUT}/config.json`,
    JSON.stringify(
      {
        version: 3,
        routes: [
          {
            src: "/(.*)",
            headers: {
              "X-Content-Type-Options": "nosniff",
              "X-Frame-Options": "SAMEORIGIN",
              "Referrer-Policy": "strict-origin-when-cross-origin",
              "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            },
            continue: true,
          },
          { handle: "filesystem" },
          { src: "^/api(?:/.*)?$", dest: "/api/index" },
          // Keep in sync with the <Route> list in client/src/App.tsx.
          { src: "^/(?:portal|lent-credit(?:/dashboard)?|login|forgot-password|reset-password|verify-email|privacy|terms|refund-policy)/?$", dest: "/index.html" },
          { src: "/(.*)", dest: "/404.html", status: 404 },
        ],
      },
      null,
      2,
    ),
  );
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
