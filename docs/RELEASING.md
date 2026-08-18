# Releasing a new version

No CI/CD exists for this repo — releases are a manual checklist.

1. Decide the version bump (semantic, pre-1.0 during UAT):
   - MAJOR — a platform-wide milestone or breaking change. Reserve 1.0.0 for
     the end of UAT / general rollout.
   - MINOR — a new feature or module.
   - PATCH — a fix or small tweak.
2. Bump `"version"` in `package.json` to match.
3. Add a new entry to the *top* of `src/data/changelogData.js`:
   `{ version, date, status, title, modules: [{ module, changes: [...] }] }`.
   Write every bullet from the user's point of view, grouped by module
   (HR / Sales / Finance / Workspace / IT / Platform) — this is what
   renders on the About page (`/app/about`).
4. Commit both changes together.
5. Tag the commit: `git tag vX.Y.Z && git push --tags` — no tags exist today;
   starting now makes future history traceable.
6. Deploy as usual (`npm run build`, ship `dist/`).
