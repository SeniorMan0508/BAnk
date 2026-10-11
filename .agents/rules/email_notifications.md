# Zero-Stress Email Notification Standard

Whenever building projects that require an admin or user email notification system to receive user registration details, form submissions, or application alerts:

1. **Always Use the Zero-Setup Relay Method (FormSubmit / Direct HTTPS Relay)**:
   - Do NOT require complex SMTP configurations, Google App Passwords, or 2-factor authentication setups unless explicitly requested.
   - Use the direct HTTPS endpoint `https://formsubmit.co/ajax/{adminEmail}` with standard headers (`Content-Type: application/json`, `Accept: application/json`, `Origin`, `Referer`).
   - Format payload with `_subject` and `_template: 'table'`, mapping all user fields cleanly into key-value pairs.

2. **Universal Host Compatibility**:
   - Provide dual dispatch: in client-side scripts (for static hosts like Netlify, Vercel, GitHub Pages) and backend Node.js (`server.js` for Render / VPS).
   - Ensure zero friction regardless of where the site is deployed.

3. **Editable Email Settings**:
   - Provide an easily accessible configuration file (e.g. `admin_email_config.json`) and Admin Dashboard UI controls so the email address can be changed anytime.
