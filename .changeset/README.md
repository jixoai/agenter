# Changesets

This directory stores release intent records.

- Create a changeset locally with: `bun run changeset`
- Push or merge to `main`; `.github/workflows/release.yml` creates the version PR or publishes.
- Configure npm trusted publishing with: `bun run trusted-publish:configure`
- Check npm trusted publishing with: `bun run trusted-publish:check`

Normal publishing is GitHub-owned and uses npm trusted publishing/OIDC. Do not add a long-lived `NPM_TOKEN` secret to CI. `bun run release-packages` is the CI publish command invoked by Changesets after the workflow receives the GitHub OIDC grant.
