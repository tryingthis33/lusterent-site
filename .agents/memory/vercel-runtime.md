---
name: Vercel runtime verification
description: Why migration checks must invoke the built function with plain Node
---

Verify the exact built function entry with plain Node, not only the TypeScript development runner or a successful frontend build.

**Why:** A Vercel build reported READY while every API request crashed on an extensionless local ESM import. A subsequent bundle passed locally but imported development Vite/Rollup tooling, whose native dependency was unavailable in the deployed function. An unreachable development branch can still introduce eager package imports during bundling.

**How to apply:** Exercise the artifact that the deployed entry actually imports with development tooling blocked, and inspect its dependency graph. Keep frontend development setup outside the API import graph rather than relying only on a runtime branch. Include missing optional authentication configuration in checks so it cannot disable public content. A successful local smoke test still does not establish that production credentials or login callbacks work.