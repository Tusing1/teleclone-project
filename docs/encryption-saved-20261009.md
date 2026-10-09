# Saved Messages and private-text encryption — 9 October 2026

## Findings

The live Ward King conversation on the sender's account showed an encrypted-message placeholder and a WebCrypto OperationError. A separate receiving Wardking session was not available to verify. Source inspection found:

- Every incoming sender reused the cache key `userId_sender`, so one sender's ECDH key could be reused for a different sender.
- Outgoing history used the sender's public key instead of the recipient's, preventing the sender from reading their own encrypted messages after reload.
- Independent hook instances did not share initialization state. New browsers/domains without the private key automatically upserted a replacement published key.
- Encryption failures silently fell back to plaintext; send UI cleared drafts and could remain stuck when a send threw.
- The unused standalone encrypt helper exported a newly generated, unrelated public key.

## Implemented locally (not pushed or released)

Shared per-account encryption snapshots and serialized initialization; actual private-key/peer-public-key cache identity; correct public half derived from the local private key; recipient public key included in new message metadata; legacy outgoing fallback uses the current contact key. Existing local keys can still attempt history decryption even when the published key differs, but sending is blocked until recovery. First-time setup uses INSERT, never replacement UPSERT. Missing/mismatched keys are explained and never automatically reset. Private text fails closed rather than silently downgrading to plaintext. Failed sends retain the draft and release the sending state.

This does not implement multi-device pairing or key backup/recovery. Lost private keys cannot be reconstructed from a published public key. Legacy outgoing messages whose recipient key rotated before the recipient key was included in metadata may remain unreadable. No account key was reset or exported in this pass.

Both Saved opening and stopped-recording saving now use `src/lib/savedMessages.ts`. It prefers the new transactional RPC and can read an existing self-chat while that RPC is absent. It never falls back to the legacy cleanup Edge Function. Existing duplicate chats are retained, and the oldest self-chat is selected consistently. If lookup fails, the code fails closed.

## Deployed backend

User explicitly approved `supabase/migrations/20261009120000_safe_saved_messages.sql`. The exact draft was executed through the hosted SQL editor; UI reported Query succeeded. Read-only checks confirmed routine existence, authenticated execute access, anonymous denial, auth.uid account scoping, and advisory-lock serialization. Screenshot: workspace parent `studygram-safe-saved-verified.png`.

The routine returns only the actor's single-participant direct chat, or creates the conversation and owner membership in one transaction. No existing messages or chats are moved/deleted. The old create-conversation Edge Function's local safety patch is still not deployed. Existing released clients still use that old route for recording saves until the frontend update ships; do not claim legacy clients are corrected by deploying the RPC alone.

## Verification

TypeScript and all 86 tests passed. Eight new tests use actual Node WebCrypto for hi round trips, multiple senders, wrong-account rejection, sender history and legacy fallback, missing/mismatched key preservation, concurrent setup, retained local-key setup, and standalone helper key identity. Saved tests cover missing-RPC fail-closed behavior and SQL/source safeguards. Existing call/direct-chat test harnesses gained mocks for the new Saved import without changing assertions. Production/PWA build passed (61 precache entries). Browserslist age warning is non-blocking.

Local server restarted on http://127.0.0.1:8080/. The browser tool blocked reload of an old localhost error tab; no workaround was attempted. Local visual verification and a real receiving-device round trip remain pending. No test messages were sent, no calls started, no existing chat data deleted, and no frontend commit/push/deploy was performed.
