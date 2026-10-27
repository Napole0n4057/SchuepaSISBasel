# Forum anonymity change — 27 October 2026

Reviewed for publication with the user’s explicit permission to commit, push and deploy. The resulting commit and deployment status are reported separately after publication. No production-data operation or migration is required for this change. Dependencies, account permissions, stored content and anonymity preferences were not changed.

## Behaviour and permission enforcement

- Anonymous posts, comments and nested replies retain the public “Anonymous” name and no profile picture.
- The existing post-list, post-detail and comment-list APIs load the signed-in viewer’s current role from `user_roles`. Only `admin` and `spectator` receive `moderation_author_name` for anonymous content. The UI shows “Anonymous · Author: Max Muster” (localized in German).
- Ordinary members receive no anonymous author name, email, account ID or profile picture. Missing/unknown roles also receive no moderation identity; client-supplied roles are ignored. Unauthenticated reads remain unauthorized.
- Anonymous creation responses use the same filtering. This also removes the existing anonymous post-creation response’s exposure of its author’s `user_id` to the posting member.
- Role-dependent GET responses use `Cache-Control: private, no-store` to prevent reuse of privileged responses by caches.
- Non-anonymous display is unchanged. Spectators retain moderation access and cannot publish posts/comments; member/admin publishing permissions are unchanged.
- Added the requested German/English notice in settings and beside the post, comment and reply anonymity controls. A second sentence explicitly includes comments and replies.
- No new endpoints or schema changes.

## Historical identity and privacy limitations

The existing schema has `user_id` on both `forum_posts` and `forum_comments`; both creation handlers already store the authenticated account ID even for anonymous content. Existing content can therefore be linked to the current `auth_users` record where that link still exists.

Historical production rows were not inspected. Both `user_id` columns are nullable, and account deletion can remove the joined account while retaining forum content. If neither a linked account name nor email is available, moderators receive a null identity and see “Author unavailable” / “Autor nicht verfügbar”. The code does not reconstruct or guess missing identities. If the account name is blank but a stored email exists, the moderator label uses that email. Account data reflects the current account, not a preserved name/email snapshot from the publication date.

Anonymity is against ordinary readers, not administrators/spectators or database operators. The API cannot prevent an author from identifying themselves in the content or a moderator from sharing information they can legitimately access.

## Validation

- `npx vitest run`: **216 tests passed in 27 files**, including 40 new parameterized API cases covering the three reading APIs and both creation APIs; ordinary/missing/unknown roles, admins, spectators, spoofed roles/author IDs, unauthenticated access, identified content and missing historical identity. Existing thread and moderation tests also pass; the comment UI test checks moderator labels on both a root comment and a reply.
- `npm run typecheck`: passed.
- `npm run build`: passed for client and server. Existing React Router future-flag warnings and a development-heartbeat sourcemap warning remain non-blocking.
- `git diff --check`: passed.
- Permission tests use mocked authentication/database responses; no live production or browser/account validation was performed.

## Publication review

The publication candidate was assembled from committed `main` plus only the anonymity files listed below and only the anonymity translation hunk in `src/i18n.jsx`. The unrelated admin edits and account-creation translations are excluded. In this isolated candidate, all **211 tests in 26 files** and typecheck passed; the production build also passed. The earlier 216-test result above included five unrelated, uncommitted admin tests. Render’s existing service builds `apps/web` with `npm install --legacy-peer-deps && npm run build`, starts with `npm run start`, and has no pre-deploy command; no migration command is being introduced.

## Files changed for this request

Paths below are relative to `apps/web/`:

| File | Purpose |
| --- | --- |
| `src/app/api/utils/forumAuthor.js` | Shared server-side identity filtering |
| `src/app/api/forum/posts/list/route.js` | Database role lookup, filtering and no-store response |
| `src/app/api/forum/posts/get/route.js` | Database role lookup, filtering and no-store response |
| `src/app/api/forum/comments/list/route.js` | Database role lookup, filtering and no-store response |
| `src/app/api/forum/posts/create/route.js` | Filter anonymous creation responses |
| `src/app/api/forum/comments/create/route.js` | Role-aware creation response |
| `src/components/ForumAuthorIdentity.jsx` | Shared discreet moderation label |
| `src/components/AnonymityNotice.jsx` | Shared anonymity notice |
| `src/app/forum/page.jsx` | Post-list label and composer notice |
| `src/app/forum/[id]/page.jsx` | Post-detail label |
| `src/components/ForumComment.jsx` | Comment/reply labels and reply notice |
| `src/components/ForumComments.jsx` | Comment composer notice |
| `src/app/settings/page.jsx` | Notice near anonymous-posting setting |
| `src/i18n.jsx` | German/English labels and notice |
| `src/app/api/forum/anonymity.test.js` | New role/privacy API regression tests |
| `src/app/api/utils/forumAuthor.test.js` | Stored-email fallback test |
| `src/app/api/forum/comments/list/route.test.js` | Accommodate database role lookup |
| `src/components/ForumComments.test.jsx` | Verify labels for root comments and replies |
| `CHANGE_REPORT_20261027_ANONYMITY.md` | This change and validation report |

Pre-existing local changes in `src/app/admin/page.jsx`, `src/app/admin/page.test.jsx` and the account-creation translations in `src/i18n.jsx` were preserved. They were included in the full working-tree checks but were not authored for this request.
