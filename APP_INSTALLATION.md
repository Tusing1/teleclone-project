# StudyGram mobile installation

The frontend is an installable PWA. Publish it to Cloudflare, then open
https://studdybuddyapp.com/install on the target phone. Android installation uses
the captured browser prompt or browser menu. iPhone/iPad installation uses Safari
Share → Add to Home Screen → Open as Web App (when offered) → Add.

The manifest has a stable app ID, standalone display, and dedicated normal,
maskable and Apple icons. The service worker precaches the application shell,
not authenticated Supabase responses. Offline downloads remain account scoped.
Updates are user-controlled and cannot reload an established call.

## Device access

Optional iPhone download: /downloads/StudyGram.mobileconfig is a removable,
unsigned profile containing exactly one com.apple.webClip.managed payload.
It embeds only the public HTTPS URL, StudyGram label and icon; no MDM, certificates,
VPN, accounts or permissions. Users review/install it themselves in Settings.
Safari home-screen installation remains the default. This is a shortcut, not
an IPA; physical iPhone installation remains unverified. Regenerate after a
brand/domain change with scripts/build-webclip.py (Python standard library).

Microphone checks require an explicit button tap and stop all acquired tracks
immediately. Browser permission alone does not prove OS access. Permission is
owned by the device/browser: the web app cannot grant it silently, guarantee
retention forever, or bypass denial. Localhost and the production website are
different permission origins. Speaker/headphone/Bluetooth routing is controlled
by the device; the call's audio button only mutes playback.

Background microphone operation and incoming-call presentation when the app is
closed are not guaranteed by a PWA. Push notifications are separate from an
active WebRTC session. Calls/new messages require a working network and backend.

## Native packages are a separate release

Existing capacitor.config.ts identifies com.studygram.app. This pass does not
generate or sign an APK/AAB/IPA. Android needs the Android SDK/JDK, native project,
device testing and a release signing key. iOS needs macOS/Xcode, Apple signing,
provisioning and device testing. Native microphone/audio-session/background-call
integrations must be implemented and tested, not assumed from wrapping a website.
Do not distribute a manifest or guide as though it were a native installer.

## Brand exports

The generated master is assets/brand/studygram-master.png. Run
scripts/build-brand-icons.py with Pillow to mechanically export public/brand
icons and compatibility icons. The master is intentionally not publicly served
or precached. Shared BrandMark is used in app entry, chats and installation.

## Current verification scope

Automated tests cover call invitation consent, local microphone cleanup,
signaling failures, install prompt lifecycle, immediate microphone-check cleanup,
recording mixer, push/TURN contracts and icon dimensions. Browser design previews
do not place calls. A live two-account audio/recording test and actual Android/iOS
home-screen installation still need real-device verification before claims of
full native-like behavior.
