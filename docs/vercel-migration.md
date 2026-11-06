# Vercel migration

## Status and source

Migration is not complete until a Vercel preview passes the checks below.
The user approved keeping the existing Replit production database for now.
Vercel and the published Replit app will share records; no database copy or
provider replacement is authorized. Do not perform write tests on this shared
database or enable preview seeding/bootstrap.
The user selected the **published Replit website**, not development, as the
source of truth. Do not seed production from the development portfolio.

Read-only checks on 2026-09-13 found 14 portfolio rows, 4 blog posts,
4 job openings, 2 company settings, no users, and no credit accounts in
the production database. The published website API also returned 14 entries.
These counts are a point-in-time baseline, not a command to delete newer data.

## Deployment prerequisites

- GitHub must contain the backend function, frontend build configuration, and
  referenced local assets. Do not commit credentials, database exports, or `.vercel`.
- Configure `DATABASE_URL` privately in Vercel for the intended database.
  The Replit **production** Database Settings connection string supports external
  PostgreSQL clients. The development connection is not a production replacement.
- Reusing the production database preserves its content without copying records,
  but Vercel and Replit then share writes. Obtain approval before enabling this.
  Prefer an isolated database copy for write testing. Do not run migrations,
  seeding, or admin bootstrap against the shared live database.
- Configure `SESSION_SECRET` privately. Preserve the original
  `LENT_CREDIT_ENCRYPTION_KEY` if set; otherwise preserve the original
  `SESSION_SECRET`, because it also derives the credit PII encryption key.
  Generating a replacement can make existing encrypted records unreadable.
- Authentication currently requires `REPL_ID` and Replit OIDC
  (`ISSUER_URL` defaults to Replit). Do not assume Vercel callback domains
  are authorized. Verify supported registration or obtain approval for
  another identity provider before replacing authentication.
- Optional email uses `EMAIL_USER` and `EMAIL_PASSWORD`. Verify delivery;
  migration does not configure an email provider automatically.
- AI uses Replit-managed `AI_INTEGRATIONS_OPENAI_API_KEY` and
  `AI_INTEGRATIONS_OPENAI_BASE_URL`. Do not assume those work externally.
  Missing configuration must fail explicitly without breaking portfolio APIs.
  Obtain approval before changing AI providers or billing.
- `ADMIN_EMAILS` is only bootstrap configuration, not a substitute for stored
  roles. Preserve user IDs and roles when migrating identity or data.
- LENT issuance, membership billing, identity and reporting mocks remain mocks.
  A hosting migration does not make them real banking or reporting integrations.

## Data transfer without retyping

1. Confirm the authoritative source and target and whether shared writes are
   acceptable. Record only counts and schema metadata in logs.
2. If keeping the existing production database, configure the connection securely
   in Vercel. No data export/import is needed.
3. If moving to a new database, use a secure PostgreSQL backup/restore process
   with an authorized operator. Preserve schema, IDs, sequences, and encryption
   keys. Keep backups private and outside Git. Approve writes to the target first.
4. Validate row counts and content and plan a final sync/write freeze before
   domain cutover. Keep the old service available until rollback is no longer needed.

## Verification and cutover

- Build locally and validate the Vercel function entry separately from static files.
  The JavaScript entry loads the bundled `dist/vercel-api.mjs`; raw TypeScript
  imports that work under the development runner can fail in Vercel's ESM runtime.
  Keep the function's `includeFiles` setting in sync with that output.
  Run `node script/test-vercel-api.mjs` after building in the local development
  environment. It exercises the real entry while blocking Vite/Rollup imports.
  The build also rejects those dependencies in the API graph. Never run this
  smoke test using production database credentials.
- OIDC discovery is deferred to auth requests. Without a supported login
  configuration those requests return an explicit 503, while public content
  remains available. This is not completion of authentication migration.
- Compare public API content, not just successful homepage HTML.
- Check images, blog posts, settings, jobs, navigation and missing API paths.
- Test login/logout and admin authorization on the approved callback domain.
- Test credit workflows only in an isolated environment, never by creating
  charges or applications in the live source database.
- Verify email, AI, and any reporting/file persistence separately.
- Publish only through the user's deployment action; do not switch domains
  until the complete app is verified and the user approves cutover.

## Reuse for other apps

Repeat the same inventory for each repository: framework, server entry, database,
identity provider, environment-variable names, external storage, local assets,
background jobs, and webhooks. Do not blindly copy this app's credentials or
configuration into another project. Each app can have different runtime needs.

## Targeted portfolio restoration

The creator clarified that the missing sites are visible in development, but not
on the .com site or Vercel. This is a content mismatch between development and
production, not established evidence of deletion.

The Partner Portal includes an admin-only **Portfolio restoration** panel.
It previews six named additions and the WeParlay/Divine Tarots logo corrections.
Opening it makes no website changes. A checked confirmation and matching preview
token are required; stale or ambiguous plans are rejected. Existing unrelated
records and financial values are preserved. New records have no invented metrics.

To apply to the live shared database:
1. Publish the updated Replit app and push the changes to GitHub for Vercel,
   so both hosts serve the new PcTravelMembers logo and protected endpoints.
2. Use Partner Login on the published Replit/.com site as an administrator.
   Do not use the development preview: that would modify development instead.
   Vercel login remains unresolved, so use the existing Replit-hosted login.
3. Review each row and logo in Portfolio restoration. Confirm only if the
   preview is correct. The action updates the shared production records.
4. Verify both live portfolios afterward. No agent has executed this live action.

Hagenz uses the requested hagenz.online domain, which could not be resolved during
investigation. Its original logo is still needed. The saved Divine Tarots artwork
is shown for review; it has not been independently verified as the creator's
intended original.

References:
- https://vercel.com/docs/frameworks/backend/express
- https://vercel.com/docs/functions/runtimes/node-js
- https://docs.replit.com/features/data-and-storage/connection-details