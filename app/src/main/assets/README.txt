VIBESHORT V18 - NO PYTHON + YOUTUBE API + NO-REPEAT

1. Extract this ZIP.
2. Open the VibeShort folder.
3. Double-click START_VIBESHORT.bat.
4. Python is NOT required. The launcher uses Windows PowerShell.
5. Keep the Command Prompt window open while using VibeShort.
6. The browser opens automatically at localhost.
7. Open Setup and enter your YouTube Data API v3 key.
8. The app keeps a persistent list of served/watched YouTube IDs to reduce repeats.

IMPORTANT:
- Do NOT double-click index.html for YouTube playback testing.
- Always start with START_VIBESHORT.bat so the page is served over HTTP.
- If a port is busy, the launcher automatically tries 5501 through 5510.


V18 UPDATES
- Sound autoplay is attempted for every Short. Modern browsers/Android WebView can block autoplay with sound until the first user gesture; VibeShort now unlocks sound on the first tap/touch and keeps subsequent Shorts playing with audio.
- Added visible Sound toggle and "Tap to enable sound & autoplay" control.
- Added Forgot password flow using Supabase Auth resetPasswordForEmail().
- Added password reset screen using Supabase Auth updateUser().
- Existing Shorts features retained: For You feed, Following, upload, search, profiles, follow, like, comments, save, share, report, notifications, watch history, moderation/admin, Supabase feed, YouTube feed and no-repeat tracking.

ANDROID APP
- This web build is mobile-ready and can be wrapped as an Android app with Capacitor or Android Studio WebView.
- For a production APK, use the included VibeShort_Android folder (if present in the parent package) or import the web assets into an Android WebView project.
- Supabase and YouTube features require Internet permission.
