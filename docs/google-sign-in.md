# Google sign-in setup

Parko uses Google Identity Services in the web login and verifies the returned ID token in the API. The browser client ID is public configuration; the API accepts only tokens whose audience matches its configured client ID.

## Google Cloud

1. Select or create the Google Cloud project that owns Parko's OAuth consent screen.
2. Configure the consent screen with the public Parko app name, support email, and privacy policy URL `https://parko-app.vercel.app/privacy`.
3. Create an OAuth client of type **Web application**.
4. Add these authorized JavaScript origins:
- `https://parko-app.vercel.app`
- `https://parko-app-git-main-doooriiaans-projects.vercel.app` for the current branch preview
- `http://localhost:5173` for local development
5. Copy the Web client ID. Do not create a client secret for this browser flow and do not put any secret in a `VITE_` variable.

## Deployment variables

Use the exact same Web client ID in both services:

- Vercel, for Production and Preview builds: `VITE_GOOGLE_CLIENT_ID`
- Render API service: `GOOGLE_CLIENT_ID`

Redeploy the Vercel frontend and Render API after setting the variables. For another production domain, add its exact HTTPS origin in Google Cloud and set that domain as an authorized origin. Preview domains must also be explicitly allowed if Google sign-in is expected there.

## Verify before release

- Test a new Google account: it should create a Parko account only from the **Regjistrohu** tab, after terms/privacy consent.
- Test an existing Parko email: its verified Google identity should link to that account and sign in.
- Test a Google email with no Parko account from **Hyr**: the app should ask the user to register instead of silently creating an account.
- Test sign-out, refresh/reload, account deletion, and the Privacy Policy URL on the deployed domain.
- Google sign-in is currently web-only. The Android app continues to use the email/password flow until a native Google Sign-In SDK and Android OAuth client are configured.
