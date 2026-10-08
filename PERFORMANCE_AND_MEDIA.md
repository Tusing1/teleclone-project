# Responsiveness and built-in media pass

- Message history uses an account-scoped, in-memory React Query cache (cleared on sign-out). The newest 80 messages load first; older pages are available on demand. Query cursors use creation time and ID to preserve ordering.
- Profiles and comment counts load in parallel. Opening comments does not wait for a full inbox refresh. Closed dialogs do not fetch data, and most load as separate chunks.
- Linked discussions are hidden from the inbox. Text, file, and voice comments always reference their channel post, including replies to other comments.
- Images, PDFs, common audio/video, and plain text open inside StudyGram. PDF tools/worker load separately. PDFs scroll continuously with only nearby page canvases mounted, and show first-page thumbnails. The reader resolves its cached/network source before mounting to avoid destroying an active document worker. Unrenderable formats use labeled file-type tiles and download fallback, not external viewers.
- Audio preferences apply to new calls. Recording requires permission acknowledgement and mixes local/remote audio, including participants arriving during the recording. This requires a real two-device test.

## Media and settings refinement

- Image bubbles have no padded frame; optional captions have their own spacing. Channel comments are a full-width footer inside each post, with no fake participant avatars.
- Images open on a full-screen black stage without a visible filename bar; tap the image to toggle download/zoom controls. Close remains available.
- The shared message editor supports replacing an attachment and changing/clearing its caption while keeping the message ID and replies. Existing encrypted text is re-encrypted rather than writing plaintext over ciphertext. Failed saves retain the editor; old uploaded files are not automatically deleted because forwards may still reference them.
- Group/channel profiles use theme tokens, larger avatars, grouped management rows, and opt-in info editing. Help & Support and the placeholder version row have been removed; privacy, installation, and call preferences remain.
- Browser verified: Asadi photo bubble/viewer/editor, continuous five-page PDF scrolling, channel settings. No live message replacement/save or destructive management actions were performed.

## Deployment requirement

Apply `supabase/migrations/20261007120000_channel_post_comments.sql` to enforce valid channel-post references at the database boundary and add message/thread indexes. The migration is prepared locally; it has not been applied to the hosted database. It preserves existing orphan discussion messages.

## Remaining work

- Verify recording audio on two devices and Safari/Android, including ending a call while recording, storage errors, and Saved messages delivery.
- Add dedicated Word/Office rendering if desired; DOC/DOCX currently show a file-type preview tile with a download fallback.
- Replace the inbox's all-message summary scan with an indexed server-side latest-message/unread summary. Cold authenticated startup still requires network requests.
- Performance tests on deployed production builds and slower devices; local Vite development mode is not representative of mobile production speed.

## Private offline files, channel controls and voice sessions

- “Save offline” pins an account-scoped IndexedDB blob inside StudyGram. Nothing is exported to the gallery or system Downloads. The left menu’s Downloaded list opens these local blobs in the built-in viewers. Automatic 30-day/size cleanup does not remove explicit saves. Storage persistence is best-effort; clearing site/app data, uninstalling or OS eviction can still remove copies. This is browser/WebView storage, not a native filesystem implementation or a guaranteed permanent phone folder.
- Do not cache authenticated Supabase responses in a shared service-worker cache. Workbox still precaches the application/PDF worker and imports the push handlers in production.
- Channel publishing/editing/forwarding is admin-only in the UI. Apply 20261007200000_channel_publish_and_call_controls.sql for actual server enforcement, call host controls, membership checks, and private signaling/participant policies. It is NOT applied to the hosted project yet.
- Channel reactions, views and sent time share one compact row; inbox bubbles use less vertical padding. Comment headers display the root attachment thumbnail and the existing channel avatar; group avatar data is unchanged.
- Direct calls and group/channel rooms share the WebRTC engine with one peer connection per remote participant, targeted signaling, queued early ICE, subscription readiness/replay, join locking, cancellation checks, and stable cleanup. Existing transport is WebRTC plus Metered TURN, not a managed conferencing SFU. Relay configuration failure now shows a warning.
- Leaving closes local tracks, peer connections and signaling, then synchronizes departure. Ending a room requires host/admin rights and reports backend failure. Noise suppression applies constraints to the existing track. Navigation away currently leaves the voice session: background/global call persistence and native incoming-call integration are separate work.
- Incoming direct-call alerts expire after 45 seconds; group/channel sessions use an Open notification rather than ringing every subscriber. Browser autoplay failure shows a tap-to-hear control.
- send-push-notification now uses encrypted VAPID web push instead of placeholder success. Deploy that function and configure matching VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT; existing subscriptions must match that key pair. get-turn-credentials requires working Metered secrets. No secrets were changed, notifications sent, shared calls started, or hosted migrations deployed in this pass.
- Browser verification: saved a pre-existing PDF via Save offline, found it in Downloaded, inspected channel comment thumbnail/profile photo. Seven automated media/call tests and TypeScript/build checks pass; simulated signaling/media tests are not a substitute for two real devices on different networks.

Next controlled test: deploy the prepared server changes, then use a host and member device to join/leave/rejoin, end for everyone, record/stop/save, and check foreground/background notification delivery on Android and installed iOS PWA. Browser push is not native Android/iOS call notification support.
