# StudyGram

StudyGram is a student-first communication and study workspace combining Telegram-style messaging with Google Meet-style live study sessions.

## Product pillars

- Direct messages, study groups, and broadcast channels with discussion spaces.
- Audio-first group calls, session recording, and shared recordings.
- PDF, audio, and shared-file viewers inside conversations.
- StudyBuddies matching and friend-to-friend conversations.
- StudyLabs games, rewards, tokens, and an AI study assistant.
- Installable PWA with Capacitor targets for Android and iOS.

## Local development

```sh
npm ci
npm run dev
```

The local app runs at `http://127.0.0.1:8080/`.

## Production build

```sh
npm run build
```

## Mobile builds

The app uses Capacitor. Android builds can be prepared with Android Studio. iOS builds require macOS, Xcode, and an Apple Developer account.

## Environment

The frontend requires the Supabase values in `.env`. The AI Edge Function uses `AI_API_KEY`, with optional `AI_API_URL` and `AI_MODEL` values. Push notifications can use `VAPID_SUBJECT` for the contact address in VAPID tokens.
