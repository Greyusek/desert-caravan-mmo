# Repository instructions

## Source of truth

- Before changing code, read `README.md`, `TODO.md`, `docs/ROADMAP.md`, and the latest `docs/CHECKPOINT_*.md`.
- Treat `TODO.md` as the short-term queue and `docs/ROADMAP.md` as the long-term direction.
- Keep the simulation core independent from UI, database, and networking concerns until a checkpoint explicitly adds them.

## Scope and compatibility

- Keep each branch and pull request limited to one functional checkpoint or one tooling/fix task.
- Do not implement later roadmap items while completing the current task.
- Preserve public APIs and deterministic seeded outputs unless the task explicitly changes them. Update golden tests when an intentional seeded-output change is approved.
- Do not add production dependencies without an explicit need and explanation.
- Tooling-only and documentation-only changes do not bump the package version or advance the product checkpoint.

## Git and verification

- Start from current `main`, work on a separate branch, and never commit directly to `main`.
- Add or update automated tests for functional changes wherever practical.
- Do not remove, skip, or weaken tests or CI gates to make a change pass.
- Before opening a pull request, run `npm ci`, `npm run verify:local`, and `git diff --check`.
- Open a ready-for-review pull request. During the pre-MVP phase, routine scoped changes do not wait for manual review, but CI must pass before merge.
- Never force-push or rewrite `main`. Roll back a bad merge with a revert commit or GitHub's Revert action.

## Manual-review exceptions

Explicitly flag and pause for manual review when a change affects GitHub workflow permissions, dependencies, secrets/authentication, persistent storage or migrations, destructive data operations, or a large cross-cutting refactor.

## Completion report

Report the implemented scope, commands run, test totals, branch, commit, pull-request URL, and any action the user still needs to take.
