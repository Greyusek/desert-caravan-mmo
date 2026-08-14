# Desert Caravan MMO — TODO

This file tracks the next concrete, reviewable tasks. The longer-term direction and milestone exit criteria remain in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## In progress

- [x] Establish GitHub-driven CI (`npm ci` → TypeScript build → automated tests).
- [x] Normalize repository line endings for Windows and Linux.
- [x] `WORLD-001`: generate a deterministic seeded world containing ten initial cities.
- [ ] Open and merge the feature PR after CI succeeds.

## Next

- [ ] `WORLD-002`: add deterministic hidden static objects (oasis, mine, ruins, cave).
- [ ] Define object discovery checks against the caravan's real route and detection radius.
- [x] Add a checkpoint demo for reproducing a world from its seed.

## Maintenance rules

- Keep tasks small enough for one feature or fix branch and one pull request.
- Add automated tests for functional work wherever practical.
- Mark work complete only after the build and test suite pass in CI.
- Update this list when a PR changes priorities; do not copy the full roadmap here.
