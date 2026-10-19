# Voting and notification changes — 19 October 2026

Local changes only. No commit, push, deployment, migration execution or stored database changes were made. Authentication code, dependencies and existing styling remain unchanged.

## Changes

- `src/studentClasses.js` now supplies the programmes, years and twelve canonical class names. Class administration and the voting form/filter reuse these definitions. New vote requests accept only Gym 1–6 and Int 1–6.
- `src/app/api/utils/voteAccess.js` shares the server-side access predicates used by vote listing, casting and notifications. `/api/votes/list` also supplies the existing detail, results and personal voting-history data; there are no separate detail/results endpoints. Inaccessible active votes are filtered before options, counts or history are fetched.
- Members see school-wide active votes and active votes matching at least one assigned class. Members without a class do not receive restricted active votes. Existing admin/spectator oversight and admin-only permissions are retained. Spectators cannot submit votes.
- Completed class votes and results are readable across classes. Existing admin-only restrictions still apply, including in history. Voting closes at the exact deadline or when `is_active` is false/null. Eligibility and UTC deadlines are checked again within the insert/upsert, including a deadline check when an existing ballot is updated. Existing administrator soft-delete controls are retained.
- The voting page moves an expired vote to the existing Past Votes section while open, refreshes its results, and removes voting controls. Existing charts and history layout are retained. Signed-out visitors see the existing sign-in prompt.
- Small 8px dots in school blue (`#093388`) appear beside the home navigation cards for Votes/Forum. The official blog remains on the home page: its dot appears beside its heading and beside the existing home links on Votes/Forum. A section is marked seen after its content loads; the blog is marked seen when its heading enters view. German/English accessible labels use the existing language system.
- `/api/notifications` returns only latest timestamps for permitted content. Vote timestamps use the same server access filter and include only active votes. Forum/blog retain their existing read permissions. The endpoint requires authentication and disables response caching.
- Notification read timestamps are stored per account in browser local storage, with in-session fallback if storage is unavailable. Requests run once on load, on focus/visibility return, and every minute while visible. Read state synchronises between tabs. There are no new tables, dependencies or external services.

## Database compatibility and required migration

The configured database was inspected in a read-only transaction before implementation. It contained three votes and one class association, labelled `G4`. The live constraint accepted only the legacy class labels; `student_classes` uses Gym/Int and years 1–6.

`sql/migrations/20261019_vote_class_names.sql` expands only the `vote_classes.class_name` check constraint to accept canonical labels alongside the existing legacy labels. `sql/schema.sql` reflects that constraint. Apply this migration before enabling new canonical class votes, after approval and validation on a separate test database. It has **not** been applied.

No class associations, ballots, deadlines or audiences were rewritten. A legacy label such as `G4` is not guessed to mean a particular Gym/Int class. If such a vote is active, it remains restricted and fails closed for members until the school confirms an explicit mapping in a separately reviewed data change. Admin/spectator oversight remains available. Once completed, the normal cross-class history rule applies.

## Validation

- `npm run typecheck`: passed.
- `npx vitest run`: 120 tests passed across 22 files. Added/updated coverage includes canonical class creation, authentication, access-denied results, spectator and direct-request restrictions, read/write deadline races, past results without ballots, live expiry, notification filtering, per-section clearing, persistence, account isolation, cross-tab updates, storage failures and both languages.
- `node --env-file=.env scripts/check-vote-access.mjs`: 32 PostgreSQL checks passed. Synthetic CTE fixtures exercise class/role visibility, missing classes, legacy labels, multi-class audiences, direct lookups, school-wide votes, completed/deleted votes, write eligibility and deadline boundaries. Every statement runs in a read-only transaction. The eligibility SELECT is executed; the complete upsert is validated with EXPLAIN **without ANALYZE**.
- `npm run build`: passed. Existing React Router future-flag notices and a sourcemap warning in the unchanged development heartbeat module remain non-fatal.
- Browser verification used an isolated local preview with synthetic in-memory data and blocked API mutations. Checked the existing desktop layout and a 390px mobile viewport, blue-dot styling, clearing on visits, both languages and read-only past results. No horizontal overflow appeared in the checked views.

## Remaining limits

- Notification read state is local to each browser/device and resets if browser storage is cleared. Updates can take up to one minute or until focus returns. Existing content is initially unread in a browser with no saved visits. If local storage is disabled, visits persist only for the current page session.
- Admin-only history intentionally keeps its existing role restriction; completing a class vote removes only its class restriction. Administrators retain their existing deletion permissions.
- The legacy `G4` association needs an explicitly confirmed mapping if it is to be usable by members while active.
- No migration DDL, real ballot insert/update, concurrent database write or authenticated production browser flow was executed. These need an isolated test database before release; production changes remain subject to approval.

## Browser previews

These show synthetic content rather than production data:

- [Desktop navigation](/Users/viggonapoleon/.codex/visualizations/2026/10/19/01a152ff-49ce-7321-a818-d973cdb8e08e/sis-desktop-notifications.jpg)
- [Mobile navigation](/Users/viggonapoleon/.codex/visualizations/2026/10/19/01a152ff-49ce-7321-a818-d973cdb8e08e/sis-mobile-notifications.jpg)
- [Mobile past results](/Users/viggonapoleon/.codex/visualizations/2026/10/19/01a152ff-49ce-7321-a818-d973cdb8e08e/sis-mobile-results.jpg)
