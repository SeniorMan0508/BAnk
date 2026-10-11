# Project Rules & Guidelines

## 1. Zero-Stress Email Notification Standard
Whenever building projects that require an admin or recipient email to receive form submissions, user registrations, credentials, or notifications:
- **Always use the zero-setup relay method** (`FormSubmit / Direct HTTPS Relay`).
- Do **NOT** require complex SMTP setups, Google App Passwords, or 2-factor authentication configurations.
- Dual-dispatch on both client-side JavaScript (for static hosts like Netlify/Vercel/GitHub Pages) and backend Node.js (for Render/VPS).
- Always include an editable config file (`admin_email_config.json`) and Admin Dashboard UI controls so the email address can be changed anytime.

## 2. Automatic Deletion on User Rejection
Whenever an admin rejects an applicant or user:
- The user must be **automatically and completely deleted** from the database (`database.json`), accounts ledger, and credentials vaults.
- They must not linger in a "rejected" status.
- Any subsequent login attempt with their credentials must immediately return `"User does not exist"`.

## 3. No Automatic Git Push
- **Never push code to GitHub or any remote repository automatically.**
- All fixes, refactoring, and test executions must be performed and verified strictly in the local workspace.
- `git push` must ONLY be executed when the user explicitly gives direct instructions to push the code.


