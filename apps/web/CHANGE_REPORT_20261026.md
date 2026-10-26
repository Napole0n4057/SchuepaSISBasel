# SIS Basel focused class, voting and permission fixes — 26 October 2026

Local implementation only. No commits, pushes, deployment, migrations or database writes were performed. Authentication, existing ballots, historical audiences, profile pictures and unrelated features were preserved.

## Existing permissions found

| Capability | Admin before changes | Spectator before changes | Member before changes |
| --- | --- | --- | --- |
| Read blog/forum | Yes | Yes | Yes |
| Read active votes | All, including admin-only | All, including admin-only | School-wide or matching stored class; incorrect class labels undermined matching |
| Read closed votes | All | All | Class restrictions lifted, but admin-only polls still hidden |
| Cast votes | Yes, including across classes | Denied | Eligible polls |
| Create forum posts/comments | Yes | Incorrectly allowed by APIs and UI | Yes |
| Publish blog/create polls | Yes | No | No |
| Delete forum posts/comments | Yes | No | No |
| Edit content/delete blog | No dedicated controls/endpoints | No | No |
| Create/delete accounts | Yes | No | No |
| Reset passwords | Member targets only | No | No |
| Assign classes | Member targets only | Member targets only | No |
| Change roles | Yes; demotion lacked last-admin protection | No | No |

Account deletion had a last-admin check outside its transaction, leaving a concurrency gap. General account details editing was missing. Blog UI showed only the latest three posts, although its API returned all posts.

## Read-only data audit

The configured Neon connection was inspected in an explicit read-only transaction, returning aggregate counts only:

- 1 admin, 1 spectator and 2 member accounts.
- 2 existing class assignments: `programme = Gym`, `year = 4`.
- 1 vote audience labelled `G4`; that poll was closed at inspection time.
- `student_classes` had no canonical class-name column; programme/year were required.

**Manual decision required:** choose the correct canonical class for each of the two legacy account assignments. No automatic equivalence between `Gym 4` and a required class is inferred. They remain preserved and flagged for mapping, cannot access class-restricted active votes until assigned, and are skipped by annual progression. The existing `G4` poll audience already matches an exact required name and is retained unchanged. Other databases/branches must be audited separately; this inspection does not certify both testing and production.

## Implemented behavior

- `src/studentClasses.js` is the shared application source for exactly twelve class names and both independent tracks: `S1 → S2 → G1 → G2 → G3 → G4` and `Pre-IB 1 → Pre-IB 2 → Pre-IB 3 → IBDP 1 → IBDP 2 → IBDP 3`.
- Account creation, bulk import, account class editing, poll audiences and vote filters use exact names. Legacy Gym/Int inputs are rejected for new assignments, not silently translated. CSV/TSV imports accept `name,email,password,class`; whitespace imports accept `email password full class name`. Omitted class means NULL. Existing import files with programme/year require explicit revision.
- Any role can have no class, shown as “No class” / “Keine Klasse.” Class managers can explicitly clear assignments. Admins can assign classes to all roles; spectators can assign them only to member/spectator accounts.
- Annual processing retains the existing calendar, member-only progression and once-per-year marker. It advances exact canonical classes within their track, skips unassigned/legacy records, and retains final-year students in G4/IBDP 3 with a review flag. Final classes also show a review label in the class UI. Staff accounts do not automatically progress.
- Shared SQL controls active vote list, direct detail/results lookup (`/api/votes/list?vote_id=...`), notifications and casting. Exact class equality prevents parallel-year leakage. Multiple audiences use an OR match. Unassigned/legacy members see school-wide active polls only. Existing admin-only active polls remain restricted to admin/spectator viewing and admin casting.
- Admins and spectators see every active poll; spectators cannot cast. Admin voting behavior is preserved. Deadline and eligibility checks run inside the insert/upsert as well as the initial request checks.
- Every signed-in user can see closed, nondeleted polls, including formerly admin-only polls. Past results contain aggregate option counts, never ballot rows or even a personal option selection. Existing soft-deleted polls remain excluded.
- Spectators can create member/spectator accounts, edit names/emails, reset passwords, assign/clear classes, and delete member/spectator accounts. Admin accounts are excluded from spectator management lists and protected inside mutation SQL. Spectators cannot alter any role, including their own. Details editing rejects injected role fields.
- Account mutations serialize on the role table and repeat actor/target checks after acquiring the lock. Admin demotion and deletion share the last-admin safeguard. This covers concurrent application management requests; direct database administration is outside these application controls. Account deletion retains forum/blog/voting content and ballots, with class records removed by the existing account foreign-key cascade.
- Admins retain complete account/role management, including resetting admin/spectator passwords. Names/emails stay synchronized across user, role and credentials-account records; case-insensitive collision checks prevent duplicate login identities during managed changes.
- Spectators can read all blog posts in the UI, moderate/edit/delete blog and forum content, but cannot publish posts/comments/blog articles, create polls or vote. Existing safe recursive forum deletions are reused. Member participation remains available. UI controls follow those permissions, including nested replies.

## Migration — approval required before application

File: `sql/migrations/20261026_classes_and_permissions.sql`.

- Transactional and repeatable; adds nullable `student_classes.class_name` and `review_required`, and permits NULL legacy programme/year values.
- Adds canonical-name and assignment-shape constraints. Legacy programme/year rows remain intact; new canonical assignments use NULL legacy columns. An explicit class save replaces the selected account's legacy fields only after a manager chooses a class or no class.
- Expands the vote audience constraint to include all twelve names while retaining old labels. `NOT VALID` preserves unexpected historical labels and still checks new writes; the API accepts only canonical names. No poll audience, ballot or user assignment is rewritten by migration.
- No account/role/content data migration is needed. `sql/schema.sql` reflects the new structure.
- Requires the baseline student-class tables from 15 October. This migration supersedes the optional audience-only `20261019_vote_class_names.sql`; that older file is not needed first and must not be applied afterward, because it omits Pre-IB 3/IBDP 3.
- Apply and verify on Neon **testing first**, then apply to **production only after approval**, before releasing this code. The code requires the added columns. No migration was executed in this task.
- `node --env-file=.env scripts/audit-class-mappings.mjs` provides a repeatable, aggregate-only read-only audit before or after migration. Review each database separately and assign legacy accounts manually through the management UI after migration/release.

## Validation

- `npx vitest run`: **170 tests passed in 25 files**. Coverage includes all twelve names, both progressions, optional classes and imports, role escalation attempts, account permissions, spectator moderation/participation, nested reply controls, vote detail access, deadlines and aggregate-only past results.
- `npm run typecheck`: passed.
- `npm run build`: passed. Existing React Router future-flag notices and development-heartbeat sourcemap warning remain nonfatal.
- Read-only PostgreSQL voting verification: **40 checks passed**, using synthetic CTE fixtures and the actual visibility/write predicates. Covers G3 versus G2/IBDP 2, multiple audiences, unassigned accounts, admin/spectator behavior, school-wide polls, expired/inactive polls, deadlines, direct lookups, legacy audiences and closed admin-only polls. The upsert was planned with EXPLAIN without ANALYZE, never executed.
- Read-only account SQL verification: **26 checks passed**, including actor/target scope, spectator self-promotion prevention, last-admin predicates, and EXPLAIN without ANALYZE for role, password, details and deletion statements.
- `git diff --check`: passed.

Limits: migration execution, canonical-class writes, real authenticated browser workflows, and concurrent mutation tests were deliberately not run against a database. The new class/progression SQL needs integration verification on an isolated testing branch after the migration is approved and applied. UI behavior has component-test coverage, not a new authenticated browser audit. No production data was changed.

## Decisions remaining

1. Confirm the intended canonical classes for the two legacy Gym/year-4 assignments.
2. Approve migration application and integration checks on testing, then production when ready.
3. Approve any later publication separately; nothing was committed, pushed or deployed here.

No blog images, About page, organigram or profile-picture changes were implemented.
