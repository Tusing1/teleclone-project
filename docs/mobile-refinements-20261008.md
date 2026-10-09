# StudyGram mobile refinements — 8 October 2026

Local implementation is based on released main commit 3ed85991e9a583c38770bd79a9bac88f97337d6c. This pass has NOT been committed, pushed or deployed.

## Implemented

- Shared audio playback and now-playing source navigation; cache object URLs belong to the provider, account-scoped positions, actual playback event state, late-load cancellation.
- Fresh Realtime presence with 90-second expiry; persistent login flags no longer drive green dots. Hidden/offline tabs untrack; separate devices retain independent presence.
- Continuous PDF reading with two-finger zoom preview and committed rendering; desktop zoom controls remain for keyboard access.
- Saved-offline state removes download controls. Device file thumbnails and audio metadata prefer cached blobs. Downloads can be removed with confirmation without deleting originals.
- Per-account/per-device 1 GB or 5 GB storage budget; six-month automatic cache retention, no app expiry for explicitly saved files, pinned downloads never automatically evicted, same-tab writes serialized. Browser quotas/eviction and cleared site data still apply; disk space is not reserved.
- Course, qualification, calendar year, study year and semester at signup/profile; optional institution, cohort, language and review date. Reminder asks for review; it never automatically promotes students.
- Selected interests only in the normal profile view; discovery shows only interests actually stored on the candidate, without greyed unselected choices.
- Checked livestream-ended insertion errors; ended notices never offer Join.
- Bottom Profile replaced by Settings; profile editing is inside Settings and no longer reloads the document. Removed duplicate sidebar Settings entry.
- Direct-chat View Profile now shows the contact read-only instead of opening your own editor. Saved has its own label/description/input and no meaningless self-call action.
- Blue links with safe HTTP(S) parsing, multiple-link/punctuation handling and channel preview cards. URL-derived previews are not fetched Open Graph metadata; YouTube can have a thumbnail.
- Theme-matched embedded link viewer with close/reload/explicit external fallback; no fake back/forward or popup permission. Websites may refuse embedding. Internal origin and insecure mixed-content links are not embedded.
- Recorder MIME/extension consistency (including Safari audio/mp4 → m4a); recording library preserves file formats and supplies conversation sources.
- Channel pin/unpin UI and backend guard prepared; channels show one pinned post, with its full preview available even outside loaded history.

## Backend status — approved update applied 9 October 2026

Initial read-only Lovable SQL inspection confirmed profiles.study_details and conversations.pinned_message_id were absent. Existing conversations policies authorize administrator updates and participant reads.

Following explicit user approval, the exact additive transactional update from `supabase/manual-deployment/20261008_study_profiles_and_channel_pins.sql` was executed in the hosted SQL editor. The UI reported Query succeeded. A subsequent read-only verification returned true for all six checks: study-profile column, pin column, profile validation constraint, enabled registration study trigger, enabled pin guard trigger, and guard function containing actor/admin and own-channel message checks. Existing account metadata study details are backfilled into public profiles. Existing access policies were not replaced. No messages or accounts were deleted. Actual multi-account pin/unpin remains an end-to-end test, not covered by schema inspection.

Individual migration sources:

- `supabase/migrations/20261008180000_study_details.sql`
- `supabase/migrations/20261008200000_channel_pins.sql`

`supabase/functions/create-conversation/index.ts` has a separate LOCAL safety fix: opening Saved Messages no longer moves or deletes duplicate existing self-chats. Previous cleanup ignored errors moving messages before deleting chats. This function must be redeployed separately; SQL does not deploy Edge Functions. Hosted function detail exposes analytics/logs/View code, but no deployment control; View code opens a Read only editor with an Upgrade button. No hosted code was edited and no Lovable chat request was sent. Do not claim the remote function has been corrected yet. Do not run a destructive duplicate consolidation.

Saved Messages is the owner's cloud self-chat, used for manual forwarded messages and stopped recordings. Device Downloaded is independent, account-scoped local storage. Recorded-file saving has code-level checks but no fresh real microphone/call test in this pass.

## Verification / limits

TypeScript, all 78 tests and the production/PWA build passed. Tests include storage eviction/replacement/concurrent writes, account isolation, real provider autoplay rejection/cancellation, URL parsing, recorder upload format, pin guard and non-destructive Saved lookup. The build still reports an outdated Browserslist database, not a build failure.

390 × 844 browser inspection confirmed Settings and its two storage limits, opening a previously saved 58 KB PDF, no download control on that file, and continuous reading through page 3 of 5. Physical two-finger PDF zoom still needs Android/iPhone testing. Actual multi-account presence and real call/recording audio still need device testing; no members were called and no messages were sent in this pass.

Screenshots in workspace parent: studygram-mobile-settings-preview.png, studygram-database-update-ready.png (draft only), and studygram-database-update-verified.png (all six hosted verification checks passed).

The approved database prerequisite is now verified. Frontend changes remain local/uncommitted/unpushed and the Saved function fix remains undeployed. The approval in this turn was for the database update, not a new frontend/function release.
