# CITYFLOW development

Use the existing checkout; do not create a worktree unless requested. Node >=20 is required.

- Edit application HTML in `src/index.html`, TypeScript/CSS in `src/`.
- Root `index.html` and `assets/` are generated production files committed to support GitHub Pages `main / root`. Never hand-edit them.
- `npm run dev` serves source through Vite with `src` as root. `npm run build` builds and checks `dist/` without replacing the committed root site.
- Before delivering application changes, run `npm test` and `npm run publish:root`. The latter builds, validates, synchronizes root HTML/assets and validates that root. Include updated generated files in the same delivery as source changes.
- Test both `dist/` and the actual committed main/root using a plain static server. A Vite-only pass does not prove branch-based Pages works.
- There is no blocking loading screen or hard startup timeout. A delayed module must become playable automatically when it arrives; failures use the visible menu's inline retry notice.
- Browser scripts use an external Playwright installation selected by `PLAYWRIGHT_MODULE`; do not add a large application dependency solely for QA.

- User-facing text is Spanish. Keep stable internal station/mode/phase IDs when editing copy.
- Urban/relaxed start with 3 stations and 1 line by default. Use `#progressive-city` to select full-city play; specialized modes already use the full city.
- Keep onboarding optional and nonblocking. Do not reintroduce a loading screen or timed startup lock.
- Policies apply at stations, not mid-leg. Passenger conservation and budget validation must remain covered when changing operations.

- Route drafts must not mutate live routes, fleets or planners until Apply. Apply and Discard both retain pause, including after resuming from the menu.
- Operating incidents are optional except in rush mode; keep separate best-score keys and preserve the user's non-rush preference.
- Run history is optional, validated local data, limited to eight summaries; storage failures must not block gameplay.
