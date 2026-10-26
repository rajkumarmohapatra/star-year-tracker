# Community backend setup

The community UI uses Firebase Authentication and Cloud Firestore. It does not store shared messages in localStorage and does not post until a real backend is configured.

1. Connect the Firebase plugin and create/select the app's Firebase project. Choose the no-billing Spark plan where available. Do not enable Analytics unless wanted.
2. Register a web app and copy its public web config into `firebase-config.js` as `window.STAR_YEAR_FIREBASE_CONFIG = { ... };`. Never use an Admin SDK or service-account private key in this file.
3. Enable Google and Email/Password sign-in in Authentication. Choose the owner's support email for Google sign-in. Add `rajkumarmohapatra.github.io` to Authentication's authorized domains. Add localhost only for local testing.
4. Create a default Cloud Firestore database in production mode and choose its region deliberately; database location cannot simply be changed later.
5. Deploy the rules using `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID` or publish the contents of `firestore.rules` in the console. Do not use test-mode rules.
6. Test two accounts in separate browser sessions: Google login, email registration and verification, password reset, comments, chat synchronization, own-message deletion, reports, sign-out, and permission failures. Verify the 10-second posting limit, cross-account delete denial, missing/extra-field denial, and spoofed author denial in the Rules emulator before launch.
7. Commit the public config and UI files to main. GitHub Pages serves the UI; Firebase stores the messages.

## Data and moderation

Public posts are stored in `channels/comments/messages` and `channels/chat/messages` with a Firebase UID, chosen public name, text, and server timestamp. Email addresses are not copied into posts. Verified accounts may post, and only the author may delete a message through the website. Display names are user-chosen, not verified identities. Each channel displays its latest 100 posts.

Reports are stored under each message's `reports` collection and are only visible to administrators through Firebase console/Admin tooling. Monitor these reports regularly; there is no automated moderation or email notification. Administrators can remove inappropriate messages from the console. Deleting a message does not automatically remove its reports subcollection, so clean up associated reports when required.

The rules enforce a shared 10-second per-account posting interval using an atomic transaction. They reject public edits, impersonated UIDs, unverified posting, and unbounded feed queries. This is basic abuse protection, not a substitute for moderation or App Check. Public reads use Firebase quota; monitor usage before promoting the site broadly.

Before Play Store publication, add a complete privacy policy, community terms, and account/data deletion workflow, and review the store's current user-generated-content requirements.

## Current status

Backend configuration is pending. Disabled posting is intentional until Authentication, database rules, and a real project are ready. No successful multi-user backend test has been performed yet.
