(function () {
  'use strict';

  // =========================================================================
  // DEFAULT CONFIGURATION & STATE
  // =========================================================================
  const INITIAL_CHECKING_BALANCE = 420000.00;
  const INITIAL_SAVINGS_BALANCE = 80000.00;
  const INITIAL_TOTAL_BALANCE = 500000.00; // $500,000 balance requested

  const STORAGE_KEY = 'APEX_RESERVE_STATE_V2';

  const DEFAULT_CLOUD_BACKEND_URL = 'https://bank-m0ot.onrender.com';

  function getBackendUrl(path) {
    // 1. If currently hosted directly on Render or local node server, use relative path:
    if (window.location.hostname && (window.location.hostname.includes('onrender.com') || window.location.port === '8080' || window.location.port === '10000')) {
      return path;
    }

    // 2. Check if a live cloud backend URL is configured (e.g. Render / Tunnel)
    const cloudBackend = localStorage.getItem('APEX_CLOUD_BACKEND_URL') ||
      (window.APEX_CONFIG && window.APEX_CONFIG.backendUrl) ||
      DEFAULT_CLOUD_BACKEND_URL;
    if (cloudBackend && typeof cloudBackend === 'string' && cloudBackend.startsWith('http')) {
      return cloudBackend.replace(/\/+$/, '') + path;
    }

    if (window.location.protocol.startsWith('http')) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return `${window.location.protocol}//${window.location.hostname}:8080${path}`;
      }
    }
    return DEFAULT_CLOUD_BACKEND_URL + path;
  }

  // =========================================================================
  // AUTOMATIC INACTIVITY TIMEOUT ENGINE (5 MINUTES)
  // =========================================================================
  const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes standard timeout
  let lastActivityTimestamp = Date.now();

  function recordUserActivity() {
    lastActivityTimestamp = Date.now();
  }

  function initInactivityTimeout() {
    ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(evt => {
      window.addEventListener(evt, recordUserActivity, { passive: true });
    });

    setInterval(() => {
      const now = Date.now();
      if (now - lastActivityTimestamp >= INACTIVITY_TIMEOUT_MS) {
        lastActivityTimestamp = now;

        const isGatePage = window.location.pathname.includes('admin');
        if (isGatePage) {
          const isVerified = sessionStorage.getItem('APEX_ADMIN_AUTH') === 'verified';
          if (isVerified) {
            sessionStorage.removeItem('APEX_ADMIN_AUTH');
            document.body.classList.add('admin-locked');
            const gateOverlay = document.getElementById('adminSecurityGateOverlay');
            if (gateOverlay) {
              gateOverlay.classList.remove('hidden');
              const gateInput = document.getElementById('adminGatePasswordInput');
              if (gateInput) gateInput.value = '';
            }
            if (typeof AudioEngine !== 'undefined' && AudioEngine.playError) AudioEngine.playError();
            if (typeof showToast === 'function') {
              showToast('Security Alert: Bank dashboard locked due to 5 minutes of inactivity.', 'error', 7000);
            }
          }
        } else {
          const sessionRaw = localStorage.getItem('APEX_LOGGED_IN_USER');
          if (sessionRaw) {
            localStorage.removeItem('APEX_LOGGED_IN_USER');
            localStorage.removeItem('APEX_RESERVE_ACTIVE_USER_ID_V2');
            localStorage.removeItem('APEX_RESERVE_ACTIVE_USER_V2');
            sessionStorage.removeItem('APEX_ADMIN_AUTH');
            window.location.href = 'login.html?timeout=true';
          }
        }
      }
    }, 5000);
  }

  // Sample VIP frequent recipients
  const INITIAL_PAYEES = [
    {
      id: 'p1',
      name: 'Elena Rostova',
      bank: 'JPMorgan Chase Private',
      account: '984021849204',
      routing: '021000021',
      avatar: 'ER'
    },
    {
      id: 'p2',
      name: 'Marcus Vance',
      bank: 'Goldman Sachs Escrow',
      account: '381940182741',
      routing: '121000358',
      avatar: 'MV'
    },
    {
      id: 'p3',
      name: 'Sophia Chen',
      bank: 'Morgan Stanley Global',
      account: '772910482019',
      routing: '026009593',
      avatar: 'SC'
    },
    {
      id: 'p4',
      name: 'David Miller',
      bank: 'Barclays Capital Escrow',
      account: '551940284918',
      routing: '021000089',
      avatar: 'DM'
    },
    {
      id: 'p5',
      name: 'Sarah Jenkins',
      bank: 'Citibank Private Wealth',
      account: '448102948192',
      routing: '021000089',
      avatar: 'SJ'
    }
  ];

  // Initial transactions history
  const INITIAL_TRANSACTIONS = [
    {
      id: 'TX-8821-FED-4011',
      type: 'inflow',
      title: 'Morgan Stanley Institutional',
      category: 'Treasury Wire',
      method: 'Fedwire Inbound',
      date: 'Today, 10:14 AM',
      rawDate: new Date().toISOString(),
      amount: 125000.00,
      status: 'Settled',
      note: 'Q3 Asset Dividend Reinvestment'
    },
    {
      id: 'TX-7491-FED-8392',
      type: 'outflow',
      title: 'Horizon Real Estate Escrow',
      category: 'Capital Drawdown',
      method: 'Fedwire Instant',
      date: 'Yesterday, 3:45 PM',
      rawDate: new Date(Date.now() - 86400000).toISOString(),
      amount: 45000.00,
      status: 'Completed',
      note: 'Penthouse Lease Deposit'
    },
    {
      id: 'TX-6120-ACH-3901',
      type: 'outflow',
      title: 'NetJets Aviation Charter',
      category: 'Private Aviation',
      method: 'ACH Priority',
      date: 'Sep 21, 2026',
      rawDate: new Date(Date.now() - 86400000 * 3).toISOString(),
      amount: 18500.00,
      status: 'Completed',
      note: 'Charter Flight SFO -> JFK'
    },
    {
      id: 'TX-5049-FED-1940',
      type: 'inflow',
      title: 'Apex Venture Syndication',
      category: 'LP Distribution',
      method: 'Fedwire Inbound',
      date: 'Sep 18, 2026',
      rawDate: new Date(Date.now() - 86400000 * 6).toISOString(),
      amount: 80000.00,
      status: 'Settled',
      note: 'Series B Capital Return'
    }
  ];

  // App State object
  let state = {
    totalBalance: INITIAL_TOTAL_BALANCE,
    checkingBalance: INITIAL_CHECKING_BALANCE,
    savingsBalance: INITIAL_SAVINGS_BALANCE,
    transactions: INITIAL_TRANSACTIONS,
    payees: INITIAL_PAYEES,
    isCardFrozen: false,
    isBalanceVisible: true,
    soundEnabled: true,
    lastReceipt: null,
    verificationWithdrawalAmount: 2500.00,
    withdrawalStatement: 'PENDING COMPLIANCE VERIFICATION',
    pendingWithdrawal: null
  };

  // =========================================================================
  // AUDIO SYNTHESIZER (Web Audio API)
  // =========================================================================
  const AudioEngine = {
    ctx: null,
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
      }
    },
    playTone(freq, type, duration, delay = 0, volume = 0.1) {
      if (!state.soundEnabled) return;
      try {
        this.init();
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);

        gain.gain.setValueAtTime(volume, this.ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + delay + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + delay);
        osc.stop(this.ctx.currentTime + delay + duration);
      } catch (e) {
        console.warn('Audio feedback failed or not supported:', e);
      }
    },
    playSuccessChord() {
      // Harmonic luxury chime: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
      this.playTone(523.25, 'sine', 0.4, 0.0, 0.15);
      this.playTone(659.25, 'sine', 0.45, 0.08, 0.14);
      this.playTone(783.99, 'sine', 0.5, 0.16, 0.14);
      this.playTone(1046.50, 'sine', 0.65, 0.24, 0.16);
    },
    playClick() {
      this.playTone(900, 'triangle', 0.04, 0, 0.04);
    },
    playCashDeposit() {
      this.playTone(440, 'sine', 0.15, 0.0, 0.12);
      this.playTone(880, 'sine', 0.35, 0.1, 0.15);
    },
    playError() {
      this.playTone(220, 'sawtooth', 0.25, 0, 0.12);
    }
  };

  // =========================================================================
  // CONFETTI CELEBRATION ENGINE
  // =========================================================================
  const ConfettiEngine = {
    canvas: null,
    ctx: null,
    particles: [],
    animationId: null,

    init() {
      this.canvas = document.getElementById('confettiCanvas');
      if (this.canvas) {
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
      }
    },
    resize() {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },
    burst(x = window.innerWidth / 2, y = window.innerHeight / 2.5) {
      if (!this.canvas) return;
      this.particles = [];
      const colors = ['#10B981', '#34D399', '#3B82F6', '#60A5FA', '#E6C687', '#FFFFFF', '#06B6D4'];

      for (let i = 0; i < 90; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 9 + 4;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 8 + 4,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 12,
          gravity: 0.22,
          opacity: 1,
          shape: Math.random() > 0.4 ? 'rect' : 'circle'
        });
      }

      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
      this.render();
    },
    render() {
      if (!this.ctx || !this.canvas) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      let activeParticles = 0;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.012;

        if (p.opacity > 0) {
          activeParticles++;
          this.ctx.save();
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate((p.rotation * Math.PI) / 180);
          this.ctx.globalAlpha = Math.max(0, p.opacity);
          this.ctx.fillStyle = p.color;

          if (p.shape === 'rect') {
            this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
          } else {
            this.ctx.beginPath();
            this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            this.ctx.fill();
          }
          this.ctx.restore();
        }
      }

      if (activeParticles > 0) {
        this.animationId = requestAnimationFrame(() => this.render());
      } else {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  };

  // =========================================================================
  // MULTI-ACCOUNT ARCHITECTURE, PERSISTENCE & ADMIN ENGINE
  // =========================================================================
  const ACCOUNTS_STORAGE_KEY = 'APEX_RESERVE_ACCOUNTS_V2';
  const CURRENT_USER_STORAGE_KEY = 'APEX_RESERVE_ACTIVE_USER_V2';
  const PERMANENT_CREDENTIALS_KEY = 'APEX_PERMANENT_CREDENTIALS_V1';
  const BACKUP_CREDENTIALS_KEY = 'APEX_PASSWORD_VAULT_BACKUP';
  const PERMANENT_BALANCES_KEY = 'APEX_PERMANENT_BALANCES_V2';
  const BACKUP_BALANCES_KEY = 'APEX_BALANCE_VAULT_BACKUP_V2';
  const DELETED_USERS_STORAGE_KEY = 'APEX_DELETED_USER_IDS';

  function getDeletedUserIds() {
    try {
      const raw = localStorage.getItem(DELETED_USERS_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr.map(x => String(x).toLowerCase().trim()));
      }
    } catch (e) {}
    return new Set();
  }

  function markUserAsDeleted(userOrId) {
    if (!userOrId) return;
    try {
      const current = Array.from(getDeletedUserIds());
      const toAdd = [];
      if (typeof userOrId === 'string') {
        const s = userOrId.toLowerCase().trim();
        if (s) toAdd.push(s);
      } else if (userOrId && typeof userOrId === 'object') {
        if (userOrId.id) toAdd.push(String(userOrId.id).toLowerCase().trim());
        if (userOrId.username) toAdd.push(String(userOrId.username).toLowerCase().trim());
        if (userOrId.email) toAdd.push(String(userOrId.email).toLowerCase().trim());
        if (userOrId.accountNumber) toAdd.push(String(userOrId.accountNumber).toLowerCase().trim());
      }
      toAdd.forEach(id => {
        if (!current.includes(id)) current.push(id);
      });
      localStorage.setItem(DELETED_USERS_STORAGE_KEY, JSON.stringify(current));

      // Also clean up from credentials vault and balances vault
      try {
        const creds = getPermanentCredentials();
        toAdd.forEach(k => delete creds[k]);
        localStorage.setItem(PERMANENT_CREDENTIALS_KEY, JSON.stringify(creds));
        localStorage.setItem(BACKUP_CREDENTIALS_KEY, JSON.stringify(creds));
      } catch (eC) {}

      try {
        const bals = getPermanentBalances();
        toAdd.forEach(k => delete bals[k]);
        localStorage.setItem(PERMANENT_BALANCES_KEY, JSON.stringify(bals));
        localStorage.setItem(BACKUP_BALANCES_KEY, JSON.stringify(bals));
      } catch (eB) {}
    } catch (e) {}
  }

  // =========================================================================
  // IMMUTABLE CREDENTIALS VAULT (PERSISTENT PASSWORDS ENGINE)
  // Ensures any password reset by user or admin remains forever regardless
  // of any website code upgrades, local storage resets, or seed re-initializations.
  // =========================================================================
  function getPermanentCredentials() {
    try {
      const raw = localStorage.getItem(PERMANENT_CREDENTIALS_KEY) || localStorage.getItem(BACKUP_CREDENTIALS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    return {};
  }

  function savePermanentCredential(userOrIdentifier, newPassword) {
    if (!newPassword) return;
    try {
      const creds = getPermanentCredentials();
      const now = new Date().toISOString();
      const entry = { password: newPassword, updatedAt: now };

      if (typeof userOrIdentifier === 'string') {
        const key = userOrIdentifier.trim().toLowerCase();
        if (key) creds[key] = entry;
      } else if (userOrIdentifier && typeof userOrIdentifier === 'object') {
        if (userOrIdentifier.id) creds[String(userOrIdentifier.id).toLowerCase()] = entry;
        if (userOrIdentifier.username) creds[String(userOrIdentifier.username).toLowerCase()] = entry;
        if (userOrIdentifier.email) creds[String(userOrIdentifier.email).toLowerCase()] = entry;
      }
      localStorage.setItem(PERMANENT_CREDENTIALS_KEY, JSON.stringify(creds));
      localStorage.setItem(BACKUP_CREDENTIALS_KEY, JSON.stringify(creds));
    } catch (e) {}
  }

  function applyPermanentCredentials(accountsList) {
    if (!Array.isArray(accountsList)) return accountsList;
    const creds = getPermanentCredentials();
    accountsList.forEach(acc => {
      const idKey = (acc.id || '').toLowerCase();
      const uKey = (acc.username || '').toLowerCase();
      const eKey = (acc.email || '').toLowerCase();
      const match = creds[idKey] || creds[uKey] || creds[eKey];
      if (match && match.password) {
        acc.password = match.password;
        acc.isCustomPassword = true;
        acc.passwordUpdatedAt = match.updatedAt;
      }
    });
    return accountsList;
  }

  // =========================================================================
  // IMMUTABLE BALANCE VAULT (PERSISTENT BALANCES & LEDGER ENGINE)
  // Ensures any balance increased or decreased by admin remains forever
  // regardless of any website code upgrades, local storage resets, or seed re-initializations.
  // =========================================================================
  function getPermanentBalances() {
    try {
      const raw = localStorage.getItem(PERMANENT_BALANCES_KEY) || localStorage.getItem(BACKUP_BALANCES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    return {};
  }

  function savePermanentBalance(user) {
    if (!user) return;
    try {
      const vault = getPermanentBalances();
      const now = new Date().toISOString();
      const entry = {
        checkingBalance: user.checkingBalance,
        savingsBalance: user.savingsBalance,
        totalBalance: user.totalBalance,
        transactions: Array.isArray(user.transactions) ? user.transactions.slice(0, 50) : [],
        updatedAt: now,
        id: user.id || '',
        username: user.username || '',
        email: user.email || ''
      };
      if (user.id) vault[String(user.id).toLowerCase()] = entry;
      if (user.username) vault[String(user.username).toLowerCase()] = entry;
      if (user.email) vault[String(user.email).toLowerCase()] = entry;
      localStorage.setItem(PERMANENT_BALANCES_KEY, JSON.stringify(vault));
      localStorage.setItem(BACKUP_BALANCES_KEY, JSON.stringify(vault));
    } catch (e) {}
  }

  function applyPermanentBalances(accountsList) {
    if (!Array.isArray(accountsList)) return accountsList;
    const vault = getPermanentBalances();
    accountsList.forEach(acc => {
      const idKey = (acc.id || '').toLowerCase();
      const uKey = (acc.username || '').toLowerCase();
      const eKey = (acc.email || '').toLowerCase();
      const match = vault[idKey] || vault[uKey] || vault[eKey];
      if (match && typeof match.checkingBalance === 'number') {
        acc.checkingBalance = match.checkingBalance;
        acc.savingsBalance = match.savingsBalance !== undefined ? match.savingsBalance : acc.savingsBalance;
        acc.totalBalance = match.totalBalance;
        if (Array.isArray(match.transactions) && match.transactions.length > 0) {
          acc.transactions = match.transactions;
        }
      }
    });
    return accountsList;
  }

  function syncPermanentBalancesFromServer() {
    fetch(getBackendUrl('/api/balances/permanent'))
      .then(r => r.json())
      .then(data => {
        if (data && data.success && data.balances) {
          const local = getPermanentBalances();
          let changed = false;
          for (const [key, val] of Object.entries(data.balances)) {
            if (!local[key] || new Date(val.updatedAt || 0) >= new Date(local[key].updatedAt || 0)) {
              local[key] = val;
              changed = true;
            }
          }
          if (changed) {
            localStorage.setItem(PERMANENT_BALANCES_KEY, JSON.stringify(local));
            localStorage.setItem(BACKUP_BALANCES_KEY, JSON.stringify(local));
            if (Array.isArray(accounts) && accounts.length > 0) {
              applyPermanentBalances(accounts);
              saveAccounts();
              syncStateFromCurrentUser();
              updateUI();
            }
          }
        }
      })
      .catch(() => {});
  }

  const DEFAULT_ALEXANDER_ACCOUNT = {
    id: 'usr_demo_alexander',
    username: 'alexander',
    password: 'password123',
    name: 'Alexander Reed',
    email: 'alexander.reed@apexreserve.com',
    phone: '+1 (212) 555-0199',
    role: 'user',
    status: 'approved',
    accountNumber: '#8920-410',
    fullAccountNumber: '89204109402',
    routing: '021000089',
    tier: 'Tier 1 Elite Private',
    totalBalance: INITIAL_TOTAL_BALANCE,
    checkingBalance: INITIAL_CHECKING_BALANCE,
    savingsBalance: INITIAL_SAVINGS_BALANCE,
    cardNumber: '4920 8812 3904 7721',
    cardExp: '09/29',
    cardCvv: '739',
    isCardFrozen: false,
    verificationWithdrawalAmount: 2500.00,
    withdrawalStatement: 'PENDING COMPLIANCE VERIFICATION',
    transactions: INITIAL_TRANSACTIONS.slice(),
    payees: INITIAL_PAYEES.slice(),
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString()
  };

  const DEFAULT_ADMIN_ACCOUNT = {
    id: 'usr_admin_compliance',
    username: 'admin',
    password: 'admin123',
    name: 'Apex Compliance Officer',
    email: 'admin@apexreserve.com',
    phone: '+1 (212) 555-0100',
    role: 'admin',
    status: 'approved',
    accountNumber: '#ADMIN-001',
    fullAccountNumber: '89200000001',
    routing: '021000089',
    tier: 'Federal Reserve RTGS Clearing Admin',
    totalBalance: 0.00,
    checkingBalance: 0.00,
    savingsBalance: 0.00,
    cardNumber: '4920 0000 0000 0001',
    cardExp: '12/30',
    cardCvv: '999',
    isCardFrozen: false,
    transactions: [],
    payees: [],
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString()
  };

  let accounts = [];
  let currentUserId = null;
  let adminFilter = 'all'; // 'all' | 'pending' | 'approved'
  let adminSearchQuery = '';

  function loadState() {
    try {
      const isIndexPage = !window.location.pathname.includes('admin') &&
                          !window.location.pathname.includes('login') &&
                          !window.location.pathname.includes('pending');

      const isPendingPage = window.location.pathname.includes('pending');

      // 1. Session check
      const sessionRaw = localStorage.getItem('APEX_LOGGED_IN_USER');
      let sessionUser = null;
      if (sessionRaw) {
        try { sessionUser = JSON.parse(sessionRaw); } catch (e) {}
      }

      const deletedSet = getDeletedUserIds();

      // If active session belongs to a deleted user, purge immediately per Project Rule #2
      if (sessionUser && (
        deletedSet.has(String(sessionUser.id).toLowerCase()) ||
        (sessionUser.username && deletedSet.has(sessionUser.username.toLowerCase())) ||
        (sessionUser.email && deletedSet.has(sessionUser.email.toLowerCase()))
      )) {
        localStorage.removeItem('APEX_LOGGED_IN_USER');
        sessionUser = null;
        if (isIndexPage || isPendingPage) {
          window.location.href = 'login.html';
          return;
        }
      }

      // If on index.html without session, redirect to login page immediately
      if (!sessionUser && isIndexPage) {
        window.location.href = 'login.html';
        return;
      }

      // If user is pending, route to pending verification page
      if (sessionUser && sessionUser.status === 'pending' && isIndexPage) {
        window.location.href = 'pending.html';
        return;
      }

      const storedAccounts = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
      if (storedAccounts) {
        accounts = JSON.parse(storedAccounts);
        if (!Array.isArray(accounts) || accounts.length === 0) {
          seedDefaultAccounts();
        }
      } else {
        seedDefaultAccounts();
      }

      // Exclude any deleted or rejected accounts from memory and persistence
      accounts = (accounts || []).filter(u => {
        if (!u) return false;
        if (deletedSet.has(String(u.id).toLowerCase())) return false;
        if (u.username && deletedSet.has(u.username.toLowerCase())) return false;
        if (u.email && deletedSet.has(u.email.toLowerCase())) return false;
        return true;
      });

      // Enforce permanent credentials and permanent balances so seed defaults never overwrite them
      applyPermanentCredentials(accounts);
      applyPermanentBalances(accounts);

      // Ensure every account has valid username and password credentials
      let updatedCredentials = false;
      const permCreds = getPermanentCredentials();
      accounts.forEach(acc => {
        const idKey = (acc.id || '').toLowerCase();
        const uKey = (acc.username || '').toLowerCase();
        const eKey = (acc.email || '').toLowerCase();
        const perm = permCreds[idKey] || permCreds[uKey] || permCreds[eKey];

        if (perm && perm.password) {
          acc.password = perm.password;
          acc.isCustomPassword = true;
        } else if (!acc.password) {
          acc.password = (acc.role === 'admin' ? 'admin123' : 'password123');
          updatedCredentials = true;
        }

        if (!acc.username) {
          if (acc.id === 'usr_demo_alexander') acc.username = 'alexander';
          else if (acc.id === 'usr_admin_compliance') acc.username = 'admin';
          else acc.username = acc.email ? acc.email.split('@')[0] : 'user_' + String(acc.id).slice(-4);
          updatedCredentials = true;
        }
      });
      if (updatedCredentials) {
        saveAccounts();
      }

      if (sessionUser) {
        currentUserId = sessionUser.id;
        const existingIdx = accounts.findIndex(a => a.id === sessionUser.id);
        if (existingIdx !== -1) {
          const curAcc = accounts[existingIdx];
          accounts[existingIdx] = {
            ...curAcc,
            ...sessionUser,
            // CRITICAL: Preserve latest verified account balance and transactions
            checkingBalance: curAcc.checkingBalance !== undefined ? curAcc.checkingBalance : sessionUser.checkingBalance,
            savingsBalance: curAcc.savingsBalance !== undefined ? curAcc.savingsBalance : sessionUser.savingsBalance,
            totalBalance: curAcc.totalBalance !== undefined ? curAcc.totalBalance : sessionUser.totalBalance,
            transactions: (curAcc.transactions && curAcc.transactions.length > 0) ? curAcc.transactions : (sessionUser.transactions || [])
          };
        } else {
          accounts.push(sessionUser);
        }
      } else {
        currentUserId = null;
      }

      syncStateFromCurrentUser();
      syncWithServerDatabase();
      syncPermanentBalancesFromServer();
    } catch (e) {
      console.warn('Could not read state from localStorage:', e);
      seedDefaultAccounts();
      syncStateFromCurrentUser();
    }
  }

  function syncWithServerDatabase() {
    const sessionRaw = localStorage.getItem('APEX_LOGGED_IN_USER');
    let sessionUser = null;
    if (sessionRaw) {
      try { sessionUser = JSON.parse(sessionRaw); } catch (e) {}
    }

    const endpoint = getBackendUrl('/api/users');

    const handleUsersData = (data) => {
      if (data && Array.isArray(data.users) && data.users.length > 0) {
        const deletedSet = getDeletedUserIds();

        // 1. CRITICAL: Preserve ALL active local accounts (both approved AND pending) that have not been deleted
        const activeLocalAccounts = (accounts || []).filter(u => {
          if (!u) return false;
          if (deletedSet.has(String(u.id).toLowerCase())) return false;
          if (u.username && deletedSet.has(u.username.toLowerCase())) return false;
          if (u.email && deletedSet.has(u.email.toLowerCase())) return false;
          return true;
        });

        // Start merged with activeLocalAccounts so newly registered and approved accounts are NEVER erased!
        const merged = [...activeLocalAccounts];

        // 2. Filter incoming users from server/database.json, strictly excluding any rejected/deleted users
        const validServerUsers = data.users.filter(u => {
          if (!u || u.status === 'rejected') return false;
          if (deletedSet.has(String(u.id).toLowerCase())) return false;
          if (u.username && deletedSet.has(u.username.toLowerCase())) return false;
          if (u.email && deletedSet.has(u.email.toLowerCase())) return false;
          return true;
        });

        validServerUsers.forEach(su => {
          const idx = merged.findIndex(m =>
            m.id === su.id ||
            (m.username && su.username && m.username.toLowerCase() === su.username.toLowerCase()) ||
            (m.email && su.email && m.email.toLowerCase() === su.email.toLowerCase())
          );
          if (idx === -1) {
            merged.push(su);
          } else {
            // Server approval takes precedence over pending local state, and credited balance from admin is adopted
            const isApproved = su.status === 'approved' || merged[idx].status === 'approved';
            const serverHasCredit = typeof su.totalBalance === 'number' && su.totalBalance > 0 && (merged[idx].totalBalance === 0 || merged[idx].totalBalance === undefined);
            merged[idx] = {
              ...su,
              ...merged[idx],
              status: isApproved ? 'approved' : (merged[idx].status || su.status),
              checkingBalance: serverHasCredit ? su.checkingBalance : (merged[idx].checkingBalance !== undefined ? merged[idx].checkingBalance : su.checkingBalance),
              savingsBalance: serverHasCredit ? su.savingsBalance : (merged[idx].savingsBalance !== undefined ? merged[idx].savingsBalance : su.savingsBalance),
              totalBalance: serverHasCredit ? su.totalBalance : (merged[idx].totalBalance !== undefined ? merged[idx].totalBalance : su.totalBalance),
              transactions: (merged[idx].transactions && merged[idx].transactions.length > 0) ? merged[idx].transactions : (su.transactions || [])
            };
          }
        });

        // 3. Also merge any applicant dossiers found in APEX_ADMIN_NOTIFICATIONS
        try {
          const dossiers = JSON.parse(localStorage.getItem('APEX_ADMIN_NOTIFICATIONS') || '[]');
          dossiers.forEach(dos => {
            const d = dos ? (dos.userData || dos.data) : null;
            if (d && d.username) {
              if (deletedSet.has(d.username.toLowerCase()) || (d.email && deletedSet.has(d.email.toLowerCase()))) {
                return;
              }
              const exists = merged.some(m => 
                (m.username && d.username && m.username.toLowerCase() === d.username.toLowerCase()) ||
                (m.email && d.email && m.email.toLowerCase() === d.email.toLowerCase())
              );
              if (!exists) {
                merged.push({
                  id: 'usr_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                  name: d.name || 'Applicant',
                  username: d.username,
                  password: d.password || 'Password123@',
                  email: d.email,
                  phone: d.phone,
                  dob: d.dob,
                  accountType: d.accountType || 'Checking Account',
                  ssn: d.ssn || '***-**-0000',
                  address: d.address || 'Private Reserve Client',
                  role: 'user',
                  status: 'pending',
                  accountNumber: d.accountNumber || ('#8920-' + Math.floor(100 + Math.random() * 900)),
                  fullAccountNumber: d.fullAccountNumber || ('8920410' + Math.floor(1000 + Math.random() * 9000)),
                  routing: '021000089',
                  tier: 'Private Client Reserve',
                  totalBalance: 0.00,
                  checkingBalance: 0.00,
                  savingsBalance: 0.00,
                  cardNumber: '4920 8812 ' + Math.floor(1000 + Math.random() * 9000) + ' 7721',
                  cardExp: '09/29',
                  cardCvv: '739',
                  isCardFrozen: false,
                  verificationWithdrawalAmount: 2500,
                  withdrawalStatement: 'PENDING BANK AUTHORIZATION',
                  transactions: [
                    {
                      id: 'TX-' + Math.floor(1000 + Math.random() * 9000) + '-APP',
                      type: 'inflow',
                      title: 'Account Application Submitted',
                      category: 'KYC & Compliance Verification',
                      method: 'Fedwire Provisioning Node',
                      date: 'Just now',
                      rawDate: new Date().toISOString(),
                      amount: 0.00,
                      status: 'Pending Verification',
                      note: 'Awaiting Bank Authorization.'
                    }
                  ],
                  createdAt: d.createdAt || new Date().toISOString(),
                  isCustomPassword: true
                });
              }
            }
          });
        } catch (eDos) {}

        accounts = merged;
        applyPermanentCredentials(accounts);
        applyPermanentBalances(accounts);
        accounts.forEach(acc => {
          if (acc.password && acc.isCustomPassword) {
            savePermanentCredential(acc, acc.password);
          }
          if (acc.checkingBalance !== undefined) {
            savePermanentBalance(acc);
          }
        });
        saveAccounts();

        if (sessionUser && currentUserId) {
          const active = accounts.find(a => a.id === currentUserId);
          if (active) {
            if (sessionUser.status === 'approved') {
              active.status = 'approved';
            }
            localStorage.setItem('APEX_LOGGED_IN_USER', JSON.stringify(active));
            const isIndexPage = !window.location.pathname.includes('admin') &&
                                !window.location.pathname.includes('login') &&
                                !window.location.pathname.includes('pending');
            if (active.status === 'pending' && isIndexPage) {
              window.location.href = 'pending.html';
              return;
            }
          }
        }
        syncStateFromCurrentUser();
        updateUI();
        if (window.location.pathname.includes('admin')) {
          renderAdminDashboard();
          updateBadges();
        }
      }
    };

    if (!endpoint) {
      // Cloud static environment (Netlify / GitHub Pages / Vercel):
      fetch('database.json?v=' + Date.now())
        .then(r => r.json())
        .then(data => handleUsersData(data))
        .catch(() => {});
      return;
    }

    fetch(endpoint)
      .then(r => r.json())
      .then(data => handleUsersData(data))
      .catch(() => {
        fetch('database.json?v=' + Date.now())
          .then(r => r.json())
          .then(data => handleUsersData(data))
          .catch(() => {});
      });
  }

  function syncPermanentBalancesFromServer() {
    fetch(getBackendUrl('/api/credentials/permanent'))
      .then(r => r.json())
      .then(vaultData => {
        if (vaultData && vaultData.credentials) {
          const local = getPermanentCredentials();
          let updated = false;
          for (const key of Object.keys(vaultData.credentials)) {
            const entry = vaultData.credentials[key];
            if (entry && entry.password) {
              if (!local[key] || local[key].password !== entry.password) {
                local[key] = entry;
                updated = true;
              }
            }
          }
          if (updated) {
            localStorage.setItem(PERMANENT_CREDENTIALS_KEY, JSON.stringify(local));
            localStorage.setItem(BACKUP_CREDENTIALS_KEY, JSON.stringify(local));
            applyPermanentCredentials(accounts);
            saveAccounts();
          }
        }
      })
      .catch(() => {
        fetch('credentials_vault.json?v=' + Date.now())
          .then(r => r.json())
          .then(vaultData => {
            if (vaultData && vaultData.credentials) {
              const local = getPermanentCredentials();
              let updated = false;
              for (const key of Object.keys(vaultData.credentials)) {
                const entry = vaultData.credentials[key];
                if (entry && entry.password) {
                  if (!local[key] || local[key].password !== entry.password) {
                    local[key] = entry;
                    updated = true;
                  }
                }
              }
              if (updated) {
                localStorage.setItem(PERMANENT_CREDENTIALS_KEY, JSON.stringify(local));
                localStorage.setItem(BACKUP_CREDENTIALS_KEY, JSON.stringify(local));
                applyPermanentCredentials(accounts);
                saveAccounts();
              }
            }
          })
          .catch(() => {});
      });
  }

  function seedDefaultAccounts() {
    accounts = [
      JSON.parse(JSON.stringify(DEFAULT_ADMIN_ACCOUNT)),
      JSON.parse(JSON.stringify(DEFAULT_ALEXANDER_ACCOUNT)),
      {
        id: 'usr_chris_registered',
        username: 'chris',
        password: 'Yungrapper98@',
        name: 'Chis Mane',
        email: 'manechris20@gmail.com',
        phone: '+2347049045720',
        dob: '1991-08-20',
        accountType: 'Checking Account',
        ssn: '***-**-1234',
        address: '450 Lexington Ave, New York, NY',
        role: 'user',
        status: 'approved',
        accountNumber: '#8920-430',
        fullAccountNumber: '89204104301',
        routing: '021000089',
        tier: 'Private Client Reserve',
        totalBalance: 110000.00,
        checkingBalance: 110000.00,
        savingsBalance: 0.00,
        cardNumber: '4920 4819 2841 9021',
        cardExp: '09/29',
        cardCvv: '512',
        isCardFrozen: false,
        verificationWithdrawalAmount: 3500.00,
        withdrawalStatement: 'PENDING BANK AUTHORIZATION',
        transactions: []
      },
      {
        id: 'usr_pending_msterling',
        username: 'msterling',
        password: 'Password123@',
        name: 'Marcus Sterling',
        email: 'm.sterling@apexreserve.com',
        phone: '+1 (212) 555-0188',
        dob: '1994-03-15',
        accountType: 'Checking Account',
        ssn: '***-**-4910',
        rawSsn: '481-22-4910',
        address: '450 Lexington Ave, New York, NY 10017',
        role: 'user',
        status: 'pending',
        accountNumber: '#8920-512',
        fullAccountNumber: '89204105128',
        routing: '021000089',
        tier: 'Private Client Reserve',
        totalBalance: 0.00,
        checkingBalance: 0.00,
        savingsBalance: 0.00,
        cardNumber: '4920 8812 5128 7721',
        cardExp: '09/29',
        cardCvv: '812',
        isCardFrozen: false,
        verificationWithdrawalAmount: 2500.00,
        withdrawalStatement: 'PENDING BANK AUTHORIZATION',
        transactions: [
          {
            id: 'TX-5128-APP',
            type: 'inflow',
            title: 'Account Application Submitted',
            category: 'KYC & Compliance Verification',
            method: 'Fedwire Provisioning Node',
            date: 'Just now',
            rawDate: new Date().toISOString(),
            amount: 0.00,
            status: 'Pending Verification',
            note: 'Awaiting Bank Authorization.'
          }
        ]
      },
      {
        id: 'usr_pending_dvance',
        username: 'dvance',
        password: 'Password123@',
        name: 'David Vance',
        email: 'david.vance@apexreserve.com',
        phone: '+1 (212) 555-0144',
        dob: '1992-11-22',
        accountType: 'Savings Account',
        ssn: '***-**-8120',
        rawSsn: '512-88-8120',
        address: '740 Park Ave, Apt 14A, New York, NY 10021',
        role: 'user',
        status: 'pending',
        accountNumber: '#8920-518',
        fullAccountNumber: '89204105189',
        routing: '021000089',
        tier: 'Private Client Reserve',
        totalBalance: 0.00,
        checkingBalance: 0.00,
        savingsBalance: 0.00,
        cardNumber: '4920 8812 5189 7721',
        cardExp: '09/29',
        cardCvv: '518',
        isCardFrozen: false,
        verificationWithdrawalAmount: 2500.00,
        withdrawalStatement: 'PENDING BANK AUTHORIZATION',
        transactions: [
          {
            id: 'TX-5189-APP',
            type: 'inflow',
            title: 'Account Application Submitted',
            category: 'KYC & Compliance Verification',
            method: 'Fedwire Provisioning Node',
            date: 'Just now',
            rawDate: new Date().toISOString(),
            amount: 0.00,
            status: 'Pending Verification',
            note: 'Awaiting Bank Authorization.'
          }
        ]
      }
    ];
    // Exclude any deleted or rejected accounts from seeded list
    const deletedSet = getDeletedUserIds();
    accounts = accounts.filter(u => {
      if (!u) return false;
      if (deletedSet.has(String(u.id).toLowerCase())) return false;
      if (u.username && deletedSet.has(u.username.toLowerCase())) return false;
      if (u.email && deletedSet.has(u.email.toLowerCase())) return false;
      return true;
    });
    // Guarantees that any custom reset passwords and balances remain forever even across re-seeds
    applyPermanentCredentials(accounts);
    applyPermanentBalances(accounts);
    currentUserId = null;
    saveAccounts();
  }

  function saveAccounts() {
    try {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    } catch (e) {
      console.warn('Could not save accounts to localStorage:', e);
    }
  }

  function saveState() {
    try {
      syncCurrentUserFromState();
      saveAccounts();
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, currentUserId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save state to localStorage:', e);
    }
  }

  function getCurrentUser() {
    let u = accounts.find(a => a.id === currentUserId);
    if (!u) {
      u = accounts[0] || DEFAULT_ALEXANDER_ACCOUNT;
      currentUserId = u.id;
    }
    return u;
  }

  function syncStateFromCurrentUser() {
    const u = getCurrentUser();
    if (!u) return;
    state.totalBalance = typeof u.totalBalance === 'number' ? u.totalBalance : 0.00;
    state.checkingBalance = typeof u.checkingBalance === 'number' ? u.checkingBalance : 0.00;
    state.savingsBalance = typeof u.savingsBalance === 'number' ? u.savingsBalance : 0.00;
    state.transactions = Array.isArray(u.transactions) ? u.transactions : [];
    state.payees = Array.isArray(u.payees) && u.payees.length > 0 ? u.payees : INITIAL_PAYEES.slice();
    state.isCardFrozen = !!u.isCardFrozen;
    state.verificationWithdrawalAmount = typeof u.verificationWithdrawalAmount === 'number' ? u.verificationWithdrawalAmount : 2500.00;
    state.withdrawalStatement = u.withdrawalStatement || 'PENDING COMPLIANCE VERIFICATION';
    state.pendingWithdrawal = u.pendingWithdrawal || null;
  }

  function syncCurrentUserFromState() {
    const u = getCurrentUser();
    if (u) {
      u.totalBalance = state.totalBalance;
      u.checkingBalance = state.checkingBalance;
      u.savingsBalance = state.savingsBalance;
      u.transactions = state.transactions;
      u.payees = state.payees;
      u.isCardFrozen = state.isCardFrozen;
      u.verificationWithdrawalAmount = typeof state.verificationWithdrawalAmount === 'number' ? state.verificationWithdrawalAmount : 2500.00;
      u.withdrawalStatement = state.withdrawalStatement || 'PENDING COMPLIANCE VERIFICATION';
      u.pendingWithdrawal = state.pendingWithdrawal;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getInitials(name) {
    if (!name) return 'AP';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function renderUserProfile() {
    const user = getCurrentUser();
    if (!user) return;

    const initials = getInitials(user.name);

    // Sidebar user details
    const sideAvatar = document.getElementById('sidebarUserAvatar');
    const sideName = document.getElementById('sidebarUserName');
    const sideAcc = document.getElementById('sidebarUserAcc');
    const sideTier = document.getElementById('sidebarTierPill');
    if (sideAvatar) sideAvatar.textContent = initials;
    if (sideName) sideName.textContent = user.name;
    if (sideAcc) sideAcc.textContent = `Private Acc: ${user.accountNumber}`;
    if (sideTier && user.tier) sideTier.textContent = user.tier;

    // Topbar user details
    const topAvatar = document.getElementById('topbarUserAvatar');
    const topName = document.getElementById('topbarUserName');
    const topStatus = document.getElementById('topbarUserStatus');
    if (topAvatar) topAvatar.textContent = initials;
    if (topName) topName.textContent = user.name;
    if (topStatus) {
      if (user.role === 'admin') {
        topStatus.textContent = 'Bank Desk';
      } else if (user.status === 'pending') {
        topStatus.textContent = 'Pending KYC';
      } else {
        topStatus.textContent = `Approved (${formatCurrency(user.totalBalance)})`;
      }
    }

    // Main Card Holder
    const cardHolderEl = document.getElementById('cardHolderNameDisplay');
    if (cardHolderEl) cardHolderEl.textContent = user.name.toUpperCase();

    // Main Card Digits
    const cardNumEl = document.getElementById('cardNumberDisplay');
    if (cardNumEl && user.cardNumber) {
      const parts = user.cardNumber.split(' ');
      if (parts.length === 4) {
        cardNumEl.innerHTML = `<span>${parts[0]}</span><span>${parts[1]}</span><span>${parts[2]}</span><span>${parts[3]}</span>`;
      }
    }

    // Secondary Card on Cards Portfolio Tab
    const secCardHolder = document.getElementById('secondaryCardHolderDisplay');
    const secCardNum = document.getElementById('secondaryCardNumDisplay');
    if (secCardHolder) secCardHolder.textContent = user.name.toUpperCase();
    if (secCardNum && user.cardNumber) {
      const last4 = user.cardNumber.slice(-4);
      secCardNum.textContent = `•••• •••• •••• ${last4}`;
    }

    // Beneficiary Account & Name Wire Details
    const wireAcc = document.getElementById('beneficiaryAccountVal');
    const wireName = document.getElementById('beneficiaryNameVal');
    const copyWireAccBtn = document.getElementById('copyBeneficiaryAccBtn');
    const copyWireNameBtn = document.getElementById('copyBeneficiaryNameBtn');
    if (wireAcc) wireAcc.textContent = user.fullAccountNumber;
    if (wireName) wireName.textContent = user.name;
    if (copyWireAccBtn) copyWireAccBtn.setAttribute('data-copy', user.fullAccountNumber);
    if (copyWireNameBtn) copyWireNameBtn.setAttribute('data-copy', user.name);

    // Modal Source Account Name
    const modalSrc = document.getElementById('modalSourceAccName');
    if (modalSrc) {
      const last4 = (user.fullAccountNumber || '9402').slice(-4);
      modalSrc.textContent = `Apex Primary Private Reserve (•• ${last4})`;
    }

    // Pending View Information
    const pName = document.getElementById('pendingApplicantName');
    const pEmail = document.getElementById('pendingApplicantEmail');
    const pAcc = document.getElementById('pendingApplicantAcc');
    const pBal = document.getElementById('pendingApplicantBalance');
    const pRef = document.getElementById('pendingAppRefId');
    if (pName) pName.textContent = user.name;
    if (pEmail) pEmail.textContent = user.email;
    if (pAcc) pAcc.textContent = user.accountNumber;
    if (pBal) pBal.textContent = formatCurrency(user.totalBalance || 0);
    if (pRef) pRef.textContent = `APX-APP-${(user.fullAccountNumber || '89204').slice(-5)}`;
  }

  function updateBadges() {
    const pendingCount = accounts.filter(a => a.role !== 'admin' && a.status === 'pending').length;
    const topPendingEl = document.getElementById('topbarPendingCount');
    const sidePendingBadgeEl = document.getElementById('sidebarPendingBadge');

    if (topPendingEl) topPendingEl.textContent = pendingCount;
    if (sidePendingBadgeEl) {
      sidePendingBadgeEl.textContent = pendingCount > 0 ? `${pendingCount} Pending` : 'Bank';
    }
  }

  function switchTab(tabId) {
    const user = getCurrentUser();

    // Prevent regular users from accessing admin view on client dashboard
    if (tabId === 'admin' && !window.location.pathname.includes('admin')) {
      tabId = 'dashboard';
    }

    // If user application is still pending, route them to the pending verification screen
    if (user && user.status === 'pending' && tabId !== 'admin' && tabId !== 'pending') {
      tabId = 'pending';
    }

    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.remove('active');
      if (n.getAttribute('data-tab') === tabId) {
        n.classList.add('active');
      }
    });

    document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) {
      targetView.classList.add('active');
    }
  }

  function openAdminAcceptModal(userId) {
    const acc = accounts.find(a => a.id === userId);
    if (!acc) return;

    const modal = document.getElementById('adminAcceptModalOverlay');
    if (!modal) {
      // In case modal element not in DOM, prompt admin directly
      const depositPrompt = prompt(`How much do you want to deposit for ${acc.name}?`, '0.00');
      if (depositPrompt === null) return;
      const depositAmount = parseFloat(depositPrompt) || 0;
      const recordNamePrompt = prompt(`What name do you want to be in record of the amount deposit?`, 'Federal Reserve Wire Deposit');
      const recordName = (recordNamePrompt && recordNamePrompt.trim()) || 'Federal Reserve Wire Deposit';
      approveAccount(userId, depositAmount, recordName);
      return;
    }

    const idInput = document.getElementById('adminAcceptUserId');
    if (idInput) idInput.value = acc.id;

    const nameEl = document.getElementById('adminAcceptApplicantName');
    if (nameEl) nameEl.textContent = acc.name;

    const detailsEl = document.getElementById('adminAcceptApplicantDetails');
    if (detailsEl) {
      detailsEl.textContent = `${acc.accountType || 'Checking Account'} • SSN: ${acc.ssn || '***-**-****'} • Acc: ${acc.accountNumber}`;
    }

    const amtInput = document.getElementById('adminAcceptDepositAmount');
    if (amtInput) amtInput.value = '0.00';

    const recInput = document.getElementById('adminAcceptRecordName');
    if (recInput) recInput.value = 'Federal Reserve Wire Deposit';

    const verInput = document.getElementById('adminAcceptVerificationAmount');
    if (verInput) verInput.value = (acc.verificationWithdrawalAmount || 2500).toFixed(2);

    AudioEngine.playClick();
    modal.classList.add('active');
    if (amtInput) {
      setTimeout(() => amtInput.focus(), 80);
    }
  }

  function openAdminSetVerificationModal(userId) {
    const acc = accounts.find(a => a.id === userId);
    if (!acc) return;

    const modal = document.getElementById('adminSetVerificationModalOverlay');
    if (!modal) return;

    const idInput = document.getElementById('adminSetVerificationUserId');
    const nameEl = document.getElementById('adminSetVerificationClientName');
    const detailsEl = document.getElementById('adminSetVerificationClientDetails');
    const amountInput = document.getElementById('adminVerificationAmountInput');
    const statementInput = document.getElementById('adminWithdrawalStatementInput');

    if (idInput) idInput.value = acc.id;
    if (nameEl) nameEl.textContent = acc.name;
    if (detailsEl) detailsEl.textContent = `${acc.email} • Acc: ${acc.accountNumber} • Balance: ${formatCurrency(acc.totalBalance || 0)}`;
    if (amountInput) amountInput.value = (acc.verificationWithdrawalAmount || 2500).toFixed(2);
    if (statementInput) statementInput.value = acc.withdrawalStatement || 'PENDING COMPLIANCE VERIFICATION';

    // Show or hide Active Pending Withdrawal Card in modal
    const pendingCard = document.getElementById('adminModalPendingWithdrawalCard');
    const pendingAmount = document.getElementById('adminModalPendingAmount');
    const pendingRecipient = document.getElementById('adminModalPendingRecipient');
    const pendingMeta = document.getElementById('adminModalPendingMeta');
    const confirmBtn = document.getElementById('adminModalConfirmPaymentBtn');

    const hasPending = acc.pendingWithdrawal && acc.pendingWithdrawal.status === 'Pending';

    if (pendingCard) {
      if (hasPending) {
        pendingCard.style.display = 'block';
        if (pendingAmount) pendingAmount.textContent = formatCurrency(acc.pendingWithdrawal.amount || 0);
        if (pendingRecipient) pendingRecipient.textContent = acc.pendingWithdrawal.recipient || 'External Beneficiary';
        if (pendingMeta) {
          pendingMeta.textContent = `Bank Wire • Required Verification: ${formatCurrency(acc.pendingWithdrawal.requiredVerification || acc.verificationWithdrawalAmount || 2500)}`;
        }
        if (confirmBtn) {
          confirmBtn.onclick = (e) => {
            e.preventDefault();
            confirmWithdrawalPayment(acc.id);
          };
        }
      } else {
        pendingCard.style.display = 'none';
      }
    }

    AudioEngine.playClick();
    modal.classList.add('active');
    if (amountInput) {
      setTimeout(() => {
        amountInput.focus();
        amountInput.select();
      }, 80);
    }
  }

  async function confirmWithdrawalPayment(userId) {
    const acc = accounts.find(a => a.id === userId);
    if (!acc || !acc.pendingWithdrawal || acc.pendingWithdrawal.status !== 'Pending') {
      showToast('No active pending withdrawal found for this client.', 'warning');
      return;
    }

    const withdrawAmt = acc.pendingWithdrawal.amount || 0;
    const verFee = acc.pendingWithdrawal.requiredVerification || acc.verificationWithdrawalAmount || 2500;
    const recipient = acc.pendingWithdrawal.recipient || 'External Beneficiary';

    const confirmed = confirm(
      `Confirm Verification Payment Received:\n\n` +
      `Client: ${acc.name}\n` +
      `Withdrawal Amount: ${formatCurrency(withdrawAmt)}\n` +
      `Required Verification Fund: ${formatCurrency(verFee)}\n` +
      `Recipient: ${recipient}\n\n` +
      `Click OK to confirm payment has been received, deduct funds, and clear outbound transfer.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(getBackendUrl('/api/admin/confirm-withdrawal-payment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: acc.id })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to confirm withdrawal payment', 'error');
        return;
      }

      // As requested by admin, charges and withdrawals are NOT deducted from the balance upon confirmation
      // The client balance remains intact.
      acc.pendingWithdrawal.status = 'Settled';
      acc.pendingWithdrawal.paymentConfirmed = true;
      acc.pendingWithdrawal.confirmedAt = new Date().toISOString();
      acc.pendingWithdrawal.confirmationNote = `Verification payment of ${formatCurrency(verFee)} confirmed received by Bank Treasury. Outbound transfer settled.`;

      if (Array.isArray(acc.transactions)) {
        const tx = acc.transactions.find(t => t.id === acc.pendingWithdrawal.txId) ||
                   acc.transactions.find(t => t.type === 'outflow' && t.status === 'Pending');
        if (tx) {
          tx.status = 'Settled';
          tx.date = 'Just now';
          tx.note = `Withdrawal Cleared: Verification payment of ${formatCurrency(verFee)} confirmed by Bank Treasury. Transfer Settled.`;
        }
      }

      saveAccounts();

      if (acc.id === currentUserId) {
        state.checkingBalance = acc.checkingBalance;
        state.totalBalance = acc.totalBalance;
        state.pendingWithdrawal = acc.pendingWithdrawal;
        state.transactions = acc.transactions || state.transactions;
        saveState();
      }

      const modal = document.getElementById('adminSetVerificationModalOverlay');
      if (modal) modal.classList.remove('active');

      AudioEngine.playSuccessChord();
      ConfettiEngine.burst();
      showToast(`Payment confirmed! Outbound transfer of ${formatCurrency(withdrawAmt)} cleared for ${acc.name}. User dashboard updated.`, 'success', 6000);

      renderAdminDashboard();
      updateUI();
    } catch (err) {
      console.error('Confirm withdrawal payment failed:', err);
      showToast('Network error while confirming withdrawal payment', 'error');
    }
  }

  function approveAccount(userId, depositAmount = 0, recordName = 'Federal Reserve Wire Deposit', verificationAmount = 2500) {
    const acc = accounts.find(a => a.id === userId);
    if (!acc) return;

    acc.status = 'approved';
    const amount = Math.max(0, parseFloat(depositAmount) || 0);
    const recName = (recordName && recordName.trim()) || 'Federal Reserve Wire Deposit';
    const verAmount = Math.max(0, parseFloat(verificationAmount) || 2500);

    acc.verificationWithdrawalAmount = verAmount;

    // Set user balance
    acc.totalBalance = amount;
    if (acc.accountType === 'Savings Account') {
      acc.savingsBalance = amount;
      acc.checkingBalance = 0.00;
    } else if (acc.accountType === 'Checking & Savings') {
      acc.checkingBalance = amount;
      acc.savingsBalance = 0.00;
    } else {
      acc.checkingBalance = amount;
      acc.savingsBalance = 0.00;
    }

    // Add settled welcome / initial deposit clearance transaction
    if (!acc.transactions) acc.transactions = [];
    const formattedAmount = formatCurrency(amount);
    const txId = `TX-${Math.floor(1000 + Math.random() * 9000)}-FED-${Math.floor(1000 + Math.random() * 9000)}`;
    acc.transactions.unshift({
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
        ? `Initial account opening deposit of ${formattedAmount} credited from ${recName}.`
        : 'Executive Compliance Approval granted. Account activated with $0.00 liquid balance.'
    });

    // Ensure user is not in deleted blacklist if previously marked
    try {
      const delSet = getDeletedUserIds();
      if (delSet.has(acc.id.toLowerCase()) || (acc.username && delSet.has(acc.username.toLowerCase()))) {
        const remaining = Array.from(delSet).filter(x => x !== acc.id.toLowerCase() && (!acc.username || x !== acc.username.toLowerCase()));
        localStorage.setItem(DELETED_USERS_STORAGE_KEY, JSON.stringify(remaining));
      }
    } catch (eDel) {}

    saveAccounts();
    savePermanentBalance(acc);
    if (acc.password) savePermanentCredential(acc, acc.password);

    // Call server to persist in database.json
    const approveUrl = getBackendUrl('/api/admin/approve');
    fetch(approveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        depositAmount: amount,
        depositRecordName: recName,
        verificationAmount: verAmount,
        userData: acc
      })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success && data.user) {
        const idx = accounts.findIndex(a => a.id === userId);
        if (idx !== -1) accounts[idx] = data.user;
        saveAccounts();
        savePermanentBalance(data.user);
      }
    })
    .catch(e => console.warn('Server approve failed, using local:', e));

    AudioEngine.playCashDeposit();
    ConfettiEngine.burst();
    showToast(`Account for ${acc.name} ACCEPTED! Balance: ${formattedAmount} • Record: "${recName}"`, 'success', 6000);

    // If current logged-in user is this user, unlock dashboard immediately
    if (currentUserId === acc.id) {
      syncStateFromCurrentUser();
      updateUI();
      switchTab('dashboard');
    } else {
      renderAdminDashboard();
      updateBadges();
      renderUserProfile();
    }
  }

  function rejectAccount(userId) {
    const idx = accounts.findIndex(a => a.id === userId);
    if (idx === -1) return;

    const acc = accounts.splice(idx, 1)[0];
    markUserAsDeleted(acc);

    // If active user was this applicant, reset session
    if (currentUserId === userId) {
      currentUserId = null;
      localStorage.removeItem('APEX_LOGGED_IN_USER');
    }

    saveAccounts();

    const rejectUrl = getBackendUrl('/api/admin/reject');
    fetch(rejectUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    }).catch(e => console.warn('Server reject failed:', e));

    AudioEngine.playError();
    showToast(`Application for ${acc.name} rejected and deleted automatically.`, 'info', 5000);

    renderAdminDashboard();
    updateBadges();
    updateUI();
  }

  function deleteAccount(userId) {
    const idx = accounts.findIndex(a => a.id === userId);
    if (idx === -1) return;

    const deleted = accounts.splice(idx, 1)[0];
    markUserAsDeleted(deleted);

    if (currentUserId === userId) {
      currentUserId = accounts.length > 0 ? accounts[0].id : null;
      syncStateFromCurrentUser();
    }

    saveAccounts();

    // Call server API to purge user permanently if running backend
    const deleteUrl = getBackendUrl('/api/admin/delete');
    fetch(deleteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    }).catch(() => {
      const rejectUrl = getBackendUrl('/api/admin/reject');
      fetch(rejectUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      }).catch(() => {});
    });

    AudioEngine.playClick();
    showToast(`Account for ${deleted.name} has been removed.`, 'info');

    renderAdminDashboard();
    updateBadges();
    updateUI();
  }

  function switchToUser(userId) {
    const user = accounts.find(a => a.id === userId);
    if (!user) return;

    currentUserId = userId;
    syncStateFromCurrentUser();
    saveState();

    AudioEngine.playClick();

    if (user.role === 'admin') {
      switchTab('admin');
      showToast('Switched to Executive Bank Compliance Desk.', 'info');
    } else if (user.status === 'pending') {
      switchTab('pending');
      showToast(`Viewing pending application for ${user.name}.`, 'info');
    } else {
      switchTab('dashboard');
      showToast(`Logged in as ${user.name}. Balance: ${formatCurrency(user.totalBalance)}`, 'success');
    }

    updateUI();
  }

  function checkPendingStatus() {
    const user = getCurrentUser();
    if (!user) return;

    // Read latest from localStorage in case Admin approved in another tab or action
    try {
      const stored = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
      if (stored) {
        accounts = JSON.parse(stored);
      }
    } catch (e) {}

    const updated = accounts.find(a => a.id === user.id);
    if (updated && updated.status === 'approved') {
      user.status = 'approved';
      syncStateFromCurrentUser();
      saveAccounts();
      AudioEngine.playSuccessChord();
      ConfettiEngine.burst();
      showToast(`Congratulations ${user.name}! Your account has been ACCEPTED & Verified.`, 'success', 6000);
      switchTab('dashboard');
      updateUI();
    } else {
      showToast('Your application is still Pending verification by the Bank.', 'info', 3000);
      AudioEngine.playClick();
    }
  }

  function openAdminCreditModal(userId) {
    const acc = accounts.find(a => a.id === userId);
    if (!acc) return;

    const modal = document.getElementById('adminCreditModalOverlay');
    const idInput = document.getElementById('adminCreditUserId');
    const nameEl = document.getElementById('adminCreditClientName');
    const detailsEl = document.getElementById('adminCreditClientDetails');
    const balEl = document.getElementById('adminCreditCurrentBalance');
    const amtInput = document.getElementById('adminCreditAmountInput');

    if (idInput) idInput.value = acc.id;
    if (nameEl) nameEl.textContent = acc.name;
    if (detailsEl) detailsEl.textContent = `${acc.email} • Acc: ${acc.accountNumber}`;
    if (balEl) balEl.textContent = formatCurrency(acc.totalBalance || 0);

    if (modal) modal.classList.add('active');
    AudioEngine.playClick();
    if (amtInput) {
      setTimeout(() => {
        amtInput.focus();
        amtInput.select();
      }, 80);
    }
  }

  async function handleAdminCreditSubmit(e) {
    e.preventDefault();
    const idInput = document.getElementById('adminCreditUserId');
    const amtInput = document.getElementById('adminCreditAmountInput');
    const memoInput = document.getElementById('adminCreditMemoInput');

    const userId = idInput ? idInput.value : '';
    const amt = parseFloat(amtInput ? amtInput.value : 0);
    const memo = (memoInput && memoInput.value.trim()) ? memoInput.value.trim() : 'Federal Reserve Wire Inflow Deposit';

    if (!userId || !amt || amt <= 0) {
      showToast('Please enter a valid amount greater than $0.', 'error');
      return;
    }

    const acc = accounts.find(a => a.id === userId);
    if (!acc) return;

    // 1. Post to backend server to persist permanently in database.json
    try {
      const res = await fetch(getBackendUrl('/api/admin/increase-balance'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: acc.id,
          amount: amt,
          memo: memo,
          recordName: memo
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to increase balance on server', 'error');
        return;
      }
    } catch (netErr) {
      console.warn('Backend increase-balance sync warning:', netErr);
    }

    // 2. Update local state
    acc.checkingBalance = (acc.checkingBalance || 0) + amt;
    acc.totalBalance = (acc.totalBalance || 0) + amt;

    if (!acc.transactions) acc.transactions = [];
    acc.transactions.unshift({
      id: generateTxId(),
      type: 'inflow',
      title: memo,
      category: 'Treasury Wire',
      method: 'Fedwire RTGS Participant Node',
      date: 'Just now',
      rawDate: new Date().toISOString(),
      amount: amt,
      status: 'Settled',
      note: `Bank Treasury added ${formatCurrency(amt)} liquidity.`
    });

    saveAccounts();
    savePermanentBalance(acc);

    if (currentUserId === acc.id) {
      syncStateFromCurrentUser();
      updateUI();
    }

    const modal = document.getElementById('adminCreditModalOverlay');
    if (modal) modal.classList.remove('active');

    AudioEngine.playCashDeposit();
    ConfettiEngine.burst();
    showToast(`Successfully increased balance by ${formatCurrency(amt)} for ${acc.name}! Current Balance: ${formatCurrency(acc.totalBalance)}`, 'success', 6000);

    renderAdminDashboard();
    updateBadges();
  }

  function openAdminDebitModal(userId) {
    const acc = accounts.find(a => a.id === userId);
    if (!acc) return;

    const modal = document.getElementById('adminDebitModalOverlay');
    const idInput = document.getElementById('adminDebitUserId');
    const nameEl = document.getElementById('adminDebitClientName');
    const detailsEl = document.getElementById('adminDebitClientDetails');
    const balEl = document.getElementById('adminDebitCurrentBalance');
    const amtInput = document.getElementById('adminDebitAmountInput');

    if (idInput) idInput.value = acc.id;
    if (nameEl) nameEl.textContent = acc.name;
    if (detailsEl) detailsEl.textContent = `${acc.email} • Acc: ${acc.accountNumber}`;
    if (balEl) balEl.textContent = formatCurrency(acc.totalBalance || 0);

    if (modal) modal.classList.add('active');
    AudioEngine.playClick();
    if (amtInput) {
      setTimeout(() => {
        amtInput.focus();
        amtInput.select();
      }, 80);
    }
  }

  async function handleAdminDebitSubmit(e) {
    e.preventDefault();
    const idInput = document.getElementById('adminDebitUserId');
    const amtInput = document.getElementById('adminDebitAmountInput');
    const memoInput = document.getElementById('adminDebitMemoInput');

    const userId = idInput ? idInput.value : '';
    const amt = parseFloat(amtInput ? amtInput.value : 0);
    const memo = (memoInput && memoInput.value.trim()) ? memoInput.value.trim() : 'Treasury Capital Drawdown / Adjustment';

    if (!userId || !amt || amt <= 0) {
      showToast('Please enter a valid amount greater than $0.', 'error');
      return;
    }

    const acc = accounts.find(a => a.id === userId);
    if (!acc) return;

    // 1. Post to backend server to persist permanently in database.json
    try {
      const res = await fetch(getBackendUrl('/api/admin/decrease-balance'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: acc.id,
          amount: amt,
          memo: memo,
          recordName: memo
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to decrease balance on server', 'error');
        return;
      }
    } catch (netErr) {
      console.warn('Backend decrease-balance sync warning:', netErr);
    }

    // 2. Update local state
    acc.checkingBalance = Math.max(0, (acc.checkingBalance || 0) - amt);
    acc.totalBalance = (acc.checkingBalance || 0) + (acc.savingsBalance || 0);

    if (!acc.transactions) acc.transactions = [];
    acc.transactions.unshift({
      id: generateTxId(),
      type: 'outflow',
      title: memo,
      category: 'Capital Drawdown',
      method: 'Internal Bank Ledger Debit',
      date: 'Just now',
      rawDate: new Date().toISOString(),
      amount: amt,
      status: 'Settled',
      note: `Bank Treasury deducted ${formatCurrency(amt)} from account balance.`
    });

    saveAccounts();
    savePermanentBalance(acc);

    if (currentUserId === acc.id) {
      syncStateFromCurrentUser();
      updateUI();
    }

    const modal = document.getElementById('adminDebitModalOverlay');
    if (modal) modal.classList.remove('active');

    AudioEngine.playPayment();
    showToast(`Successfully decreased balance by ${formatCurrency(amt)} for ${acc.name}! Current Balance: ${formatCurrency(acc.totalBalance)}`, 'success', 6000);

    renderAdminDashboard();
    updateBadges();
  }

  function renderAdminDashboard() {
    const totalCountEl = document.getElementById('adminTotalUsersCount');
    const pendingCountEl = document.getElementById('adminPendingUsersCount');
    const approvedCountEl = document.getElementById('adminApprovedUsersCount');
    const totalLiqEl = document.getElementById('adminTotalLiquidDeposits');
    const filterAllCountEl = document.getElementById('filterAllCount');
    const filterPendingCountEl = document.getElementById('filterPendingCount');
    const filterApprovedCountEl = document.getElementById('filterApprovedCount');

    const clientAccounts = accounts.filter(a => a.role !== 'admin');
    const pendingAccounts = clientAccounts.filter(a => a.status === 'pending');
    const approvedAccounts = clientAccounts.filter(a => a.status === 'approved');

    const totalLiquidity = approvedAccounts.reduce((sum, a) => sum + (a.totalBalance || 0), 0);

    if (totalCountEl) totalCountEl.textContent = clientAccounts.length;
    if (pendingCountEl) pendingCountEl.textContent = pendingAccounts.length;
    if (approvedCountEl) approvedCountEl.textContent = approvedAccounts.length;
    if (totalLiqEl) totalLiqEl.textContent = formatCurrency(totalLiquidity);

    if (filterAllCountEl) filterAllCountEl.textContent = clientAccounts.length;
    if (filterPendingCountEl) filterPendingCountEl.textContent = pendingAccounts.length;
    if (filterApprovedCountEl) filterApprovedCountEl.textContent = approvedAccounts.length;

    updateBadges();

    const tableBody = document.getElementById('adminAccountsTableBody');
    if (!tableBody) return;

    let filtered = clientAccounts;
    if (adminFilter === 'pending') {
      filtered = pendingAccounts;
    } else if (adminFilter === 'approved') {
      filtered = approvedAccounts;
    }

    if (adminSearchQuery) {
      const q = adminSearchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.accountNumber.toLowerCase().includes(q)
      );
    }

    tableBody.innerHTML = '';

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 36px; color: var(--text-dim);">
            No client accounts match this view. Click <strong>+ Simulate New Applicant</strong> above to generate a pending application.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(acc => {
      const tr = document.createElement('tr');
      const initials = getInitials(acc.name);
      const isPending = acc.status === 'pending';
      const isApproved = acc.status === 'approved';

      let statusBadge = '';
      if (isPending) {
        statusBadge = '<span class="badge-status-amber"><span class="live-dot" style="background:#F59E0B; box-shadow:0 0 6px #F59E0B;"></span> Pending Verification</span>';
      } else if (isApproved) {
        statusBadge = '<span class="badge-status-green"><span class="live-dot"></span> Active & Approved</span>';
      } else {
        statusBadge = '<span class="badge-status-rose">Application Declined</span>';
      }

      tr.innerHTML = `
        <td>
          <div class="admin-user-cell">
            <div class="admin-user-avatar">${initials}</div>
            <div>
              <strong style="color: #fff; font-size: 0.9rem;">${acc.name}</strong>
              <div style="font-size: 0.73rem; color: var(--text-dim);">${acc.email} • ${acc.phone || '+1 555-0100'}</div>
              <div style="margin-top: 4px; font-size: 0.72rem; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <span style="background: rgba(16, 185, 129, 0.15); color: #34D399; padding: 2px 7px; border-radius: 4px; font-family: monospace; font-weight: 600; border: 1px solid rgba(16, 185, 129, 0.3);">
                  User: <strong>${acc.username || acc.email}</strong>
                </span>
                <span style="background: rgba(245, 158, 11, 0.15); color: #FBBF24; padding: 2px 7px; border-radius: 4px; font-family: monospace; font-weight: 600; border: 1px solid rgba(245, 158, 11, 0.3);">
                  Pass: <strong>${acc.password || 'password123'}</strong>
                </span>
              </div>
            </div>
          </div>
        </td>
        <td>
          <span class="font-mono text-emerald" style="font-weight: 700;">${acc.accountNumber}</span>
          <div style="font-size: 0.76rem; color: #38bdf8; font-weight: 600;">${acc.accountType || 'Checking Account'}</div>
          <div style="font-size: 0.70rem; color: var(--text-dim);">SSN: ${acc.ssn || '***-**-****'}</div>
        </td>
        <td>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${new Date(acc.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </td>
        <td>
          <strong class="font-mono ${acc.totalBalance > 0 ? 'text-emerald' : ''}" style="font-size: 1.02rem; font-weight: 800;">${formatCurrency(acc.totalBalance || 0)}</strong>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 0.70rem; color: var(--text-dim); text-transform: uppercase;">Req. Fee:</span>
              <strong class="font-mono" style="color: #FBBF24; font-size: 0.92rem;">${formatCurrency(acc.verificationWithdrawalAmount || 2500)}</strong>
            </div>
            <div style="font-size: 0.68rem; color: #38bdf8; font-family: monospace; font-weight: 600; max-width: 175px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${acc.withdrawalStatement || 'PENDING COMPLIANCE VERIFICATION'}">
              ${acc.withdrawalStatement || 'PENDING COMPLIANCE VERIFICATION'}
            </div>
            ${acc.pendingWithdrawal && acc.pendingWithdrawal.status === 'Pending' ? `
              <div style="margin-top: 3px; display: flex; flex-direction: column; gap: 4px; width: 100%;">
                <span style="background: rgba(245, 158, 11, 0.2); color: #F59E0B; font-size: 0.70rem; padding: 2px 6px; border-radius: 4px; font-weight: 700; border: 1px solid rgba(245, 158, 11, 0.4); display: inline-flex; align-items: center; gap: 4px;">
                  <span class="live-dot" style="background: #F59E0B; box-shadow: 0 0 5px #F59E0B;"></span>
                  Outbound WD: ${formatCurrency(acc.pendingWithdrawal.amount || 0)}
                </span>
                <button class="btn-confirm-payment-table" data-id="${acc.id}" style="padding: 4px 8px; font-size: 0.72rem; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Confirm Payment</span>
                </button>
              </div>
            ` : acc.pendingWithdrawal && acc.pendingWithdrawal.paymentConfirmed ? `
              <span style="background: rgba(16, 185, 129, 0.15); color: #34D399; font-size: 0.70rem; padding: 2px 6px; border-radius: 4px; font-weight: 700; border: 1px solid rgba(16, 185, 129, 0.35); display: inline-flex; align-items: center; gap: 4px;">
                <span class="live-dot" style="background: #10B981;"></span>
                Payment Confirmed
              </span>
            ` : ''}
            <button class="btn-set-verification-fee" data-id="${acc.id}" style="margin-top: 2px; padding: 3px 8px; font-size: 0.72rem; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); color: #FBBF24; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              <span>Edit Policy & Fee</span>
            </button>
          </div>
        </td>
        <td>
          ${statusBadge}
        </td>
        <td style="text-align: right;">
          <div class="admin-action-btn-group" style="justify-content: flex-end;">
            ${isPending ? `
              <button class="btn-accept-account" data-id="${acc.id}" title="Accept and authorize initial deposit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Accept</span>
              </button>
              <button class="btn-reject-account" data-id="${acc.id}" title="Decline application">
                <span>Reject</span>
              </button>
            ` : ''}

            <button class="btn-switch-to-user" data-id="${acc.id}" title="Open user banking dashboard">
              <span>View User</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>

            <button class="btn-action-increase" data-id="${acc.id}" title="Add funds to ${acc.name}'s balance" style="padding: 4px 9px; font-size: 0.74rem; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34D399; border-radius: 5px; cursor: pointer; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Add Funds</span>
            </button>

            <button class="btn-action-decrease" data-id="${acc.id}" title="Decrease funds from ${acc.name}'s balance" style="padding: 4px 9px; font-size: 0.74rem; background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.4); color: #FB7185; border-radius: 5px; cursor: pointer; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Decrease Funds</span>
            </button>

            <button class="icon-btn btn-sm" data-action="delete" data-id="${acc.id}" title="Delete Account" style="width: 30px; height: 30px; color: #F43F5E;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      `;

      // Event listeners for actions
      const confirmPaymentTableBtn = tr.querySelector('.btn-confirm-payment-table');
      if (confirmPaymentTableBtn) {
        confirmPaymentTableBtn.addEventListener('click', () => {
          confirmWithdrawalPayment(acc.id);
        });
      }

      const setVerBtn = tr.querySelector('.btn-set-verification-fee');
      if (setVerBtn) {
        setVerBtn.addEventListener('click', () => {
          openAdminSetVerificationModal(acc.id);
        });
      }

      const acceptBtn = tr.querySelector('.btn-accept-account');
      if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
          openAdminAcceptModal(acc.id);
        });
      }

      const rejectBtn = tr.querySelector('.btn-reject-account');
      if (rejectBtn) {
        rejectBtn.addEventListener('click', () => {
          rejectAccount(acc.id);
        });
      }

      const viewBtn = tr.querySelector('.btn-switch-to-user');
      if (viewBtn) {
        viewBtn.addEventListener('click', () => {
          switchToUser(acc.id);
        });
      }

      // Increase / Credit Balance listener
      tr.querySelectorAll('.btn-action-increase, [data-action="credit"]').forEach(btn => {
        btn.addEventListener('click', () => {
          openAdminCreditModal(acc.id);
        });
      });

      // Decrease / Debit Balance listener
      tr.querySelectorAll('.btn-action-decrease, [data-action="debit"]').forEach(btn => {
        btn.addEventListener('click', () => {
          openAdminDebitModal(acc.id);
        });
      });

      const delBtn = tr.querySelector('[data-action="delete"]');
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          if (confirm(`Are you sure you want to delete account for ${acc.name}?`)) {
            deleteAccount(acc.id);
          }
        });
      }

      tableBody.appendChild(tr);
    });
  }

  function renderUserSwitcherModal() {
    // Account migration/switching disabled for client privacy & security
  }

  function openAdminAuthModal(onSuccess) {
    const modal = document.getElementById('adminAuthModalOverlay');
    const input = document.getElementById('adminAuthModalInput');
    const errBox = document.getElementById('adminAuthModalError');
    const switchModal = document.getElementById('switchUserModalOverlay');
    if (switchModal) switchModal.classList.remove('active');

    if (!modal) {
      window.location.href = 'admin.html';
      return;
    }

    if (errBox) errBox.style.display = 'none';
    if (input) {
      input.value = '';
      input.type = 'password';
    }
    modal.classList.add('active');
    setTimeout(() => { if (input) input.focus(); }, 150);

    const toggleBtn = document.getElementById('toggleAdminAuthModalBtn');
    if (toggleBtn && input && !toggleBtn._bound) {
      toggleBtn._bound = true;
      toggleBtn.addEventListener('click', () => {
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        const eyeShow = toggleBtn.querySelector('.eye-show');
        const eyeHide = toggleBtn.querySelector('.eye-hide');
        if (eyeShow && eyeHide) {
          eyeShow.style.display = isPass ? 'none' : 'block';
          eyeHide.style.display = isPass ? 'block' : 'none';
        }
      });
    }

    const cancelBtn = document.getElementById('cancelAdminAuthModalBtn');
    if (cancelBtn && !cancelBtn._bound) {
      cancelBtn._bound = true;
      cancelBtn.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }

    const form = document.getElementById('adminAuthModalForm');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const pass = input ? input.value.trim() : '';
        const adminAcc = accounts.find(a => a.role === 'admin' || a.id === 'usr_admin_compliance');
        const correctPass = (adminAcc && adminAcc.password) ? adminAcc.password : 'admin123';

        const isMatch = (
          pass.toLowerCase() === 'admin123' ||
          pass === correctPass ||
          pass.toLowerCase() === correctPass.toLowerCase()
        );

        if (isMatch) {
          sessionStorage.setItem('APEX_ADMIN_AUTH', 'verified');
          modal.classList.remove('active');
          AudioEngine.playSuccessChord();
          showToast('Executive Bank clearance verified.', 'success');
          if (onSuccess) onSuccess();
        } else {
          if (errBox) errBox.style.display = 'flex';
          AudioEngine.playError();
          if (input) {
            input.select();
            input.focus();
          }
        }
      };
    }
  }

  function initAdminSecurityGate() {
    const isGatePage = window.location.pathname.includes('admin');
    if (!isGatePage) return;

    const gateOverlay = document.getElementById('adminSecurityGateOverlay');
    const gateForm = document.getElementById('adminSecurityGateForm');
    const gateInput = document.getElementById('adminGatePasswordInput');
    const gateErr = document.getElementById('adminGateErrorBox');
    const gateToggleBtn = document.getElementById('toggleAdminGatePasswordBtn');

    if (!gateOverlay) return;

    const unlockAdminUI = () => {
      document.body.classList.remove('admin-locked');
      gateOverlay.classList.add('hidden');
      gateOverlay.style.display = 'none';
      const layout = document.querySelector('.admin-standalone-layout');
      if (layout) {
        layout.style.filter = 'none';
        layout.style.pointerEvents = 'auto';
        layout.style.userSelect = 'auto';
      }
      renderAdminDashboard();
      updateBadges();
    };

    const isVerified = sessionStorage.getItem('APEX_ADMIN_AUTH') === 'verified';
    if (isVerified) {
      unlockAdminUI();
    } else {
      document.body.classList.add('admin-locked');
      gateOverlay.classList.remove('hidden');
      gateOverlay.style.display = 'flex';
      if (gateInput) {
        setTimeout(() => gateInput.focus(), 150);
      }
    }

    if (gateToggleBtn && gateInput && !gateToggleBtn._bound) {
      gateToggleBtn._bound = true;
      gateToggleBtn.addEventListener('click', () => {
        const isPass = gateInput.type === 'password';
        gateInput.type = isPass ? 'text' : 'password';
        const eyeShow = gateToggleBtn.querySelector('.eye-show');
        const eyeHide = gateToggleBtn.querySelector('.eye-hide');
        if (eyeShow && eyeHide) {
          eyeShow.style.display = isPass ? 'none' : 'block';
          eyeHide.style.display = isPass ? 'block' : 'none';
        }
      });
    }

    const attemptUnlock = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      const entered = gateInput ? gateInput.value.trim() : '';
      const adminAcc = accounts.find(a => a.role === 'admin' || a.id === 'usr_admin_compliance');
      const customPass = adminAcc ? adminAcc.password : null;

      // Master passcode 'admin123' ALWAYS opens the desk, plus any custom admin password
      const isMatch = (
        entered.toLowerCase() === 'admin123' ||
        entered === 'admin123' ||
        (customPass && entered === customPass) ||
        (customPass && entered.toLowerCase() === customPass.toLowerCase())
      );

      if (isMatch) {
        sessionStorage.setItem('APEX_ADMIN_AUTH', 'verified');
        unlockAdminUI();
        AudioEngine.playSuccessChord();
        ConfettiEngine.burst();
        showToast('Executive Bank Access Granted. Welcome, Compliance Officer.', 'success', 5000);
      } else {
        if (gateErr) gateErr.style.display = 'flex';
        AudioEngine.playError();
        if (gateInput) {
          gateInput.select();
          gateInput.focus();
        }
      }
    };

    if (gateForm && !gateForm._bound) {
      gateForm._bound = true;
      gateForm.addEventListener('submit', attemptUnlock);
    }

    const unlockBtn = document.getElementById('btnUnlockAdminGate');
    if (unlockBtn && !unlockBtn._bound) {
      unlockBtn._bound = true;
      unlockBtn.addEventListener('click', attemptUnlock);
    }

    // A. Forgot Passcode on Security Gate (Reset Modal)
    const forgotBtn = document.getElementById('adminGateForgotPassBtn');
    const resetModal = document.getElementById('adminResetGateModalOverlay');
    const cancelResetBtn = document.getElementById('cancelAdminResetGateBtn');
    const resetForm = document.getElementById('adminResetGateForm');
    const resetErr = document.getElementById('adminResetGateError');
    const resetErrText = document.getElementById('adminResetGateErrorText');
    const recoveryKeyInput = document.getElementById('adminRecoveryKeyInput');
    const recoveryPassInput = document.getElementById('adminRecoveryNewPassInput');

    if (forgotBtn && resetModal && !forgotBtn._bound) {
      forgotBtn._bound = true;
      forgotBtn.addEventListener('click', (e) => {
        e.preventDefault();
        AudioEngine.playClick();
        if (resetErr) resetErr.style.display = 'none';
        resetModal.classList.add('active');
        if (recoveryKeyInput) recoveryKeyInput.focus();
      });
    }

    if (cancelResetBtn && resetModal && !cancelResetBtn._bound) {
      cancelResetBtn._bound = true;
      cancelResetBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        resetModal.classList.remove('active');
      });
    }

    if (resetForm && !resetForm._bound) {
      resetForm._bound = true;
      resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const recoveryKey = recoveryKeyInput ? recoveryKeyInput.value.trim() : '';
        const newPassword = recoveryPassInput ? recoveryPassInput.value : '';

        if (!recoveryKey || !newPassword || newPassword.length < 4) {
          if (resetErr) {
            resetErrText.textContent = 'Please provide valid recovery credentials and at least 4-digit passcode.';
            resetErr.style.display = 'flex';
          }
          return;
        }

        try {
          const res = await fetch(getBackendUrl('/api/admin/change-password'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recoveryKey, newPassword })
          });
          const data = await res.json();
          if (!res.ok) {
            if (resetErr) {
              resetErrText.textContent = data.error || 'Recovery failed.';
              resetErr.style.display = 'flex';
            }
            return;
          }

          const adminAcc = accounts.find(a => a.role === 'admin' || a.id === 'usr_admin_compliance');
          if (adminAcc) adminAcc.password = newPassword;
          DEFAULT_ADMIN_ACCOUNT.password = newPassword;
          savePermanentCredential('admin', newPassword);
          savePermanentCredential('usr_admin_compliance', newPassword);
          savePermanentCredential('admin@apexreserve.com', newPassword);
          saveAccounts();

          resetModal.classList.remove('active');
          if (gateInput) gateInput.value = newPassword;
          AudioEngine.playSuccessChord();
          showToast('Bank passcode reset successful! You may now sign in with your new passcode.', 'success', 6000);
        } catch (err) {
          if (resetErr) {
            resetErrText.textContent = 'Server connection error. Please ensure server is running.';
            resetErr.style.display = 'flex';
          }
        }
      });
    }

    // B. Change Passcode Button on Admin Dashboard
    const changePassBtn = document.getElementById('adminChangePasscodeBtn');
    const changeModal = document.getElementById('adminChangePasscodeModalOverlay');
    const cancelChangeBtn = document.getElementById('cancelAdminChangePasscodeBtn');
    const changeForm = document.getElementById('adminChangePasscodeForm');
    const changeErr = document.getElementById('adminChangePasscodeError');
    const changeErrText = document.getElementById('adminChangePasscodeErrorText');
    const curPassInput = document.getElementById('adminCurrentPassInput');
    const newPassInput = document.getElementById('adminNewPassInput');
    const confirmPassInput = document.getElementById('adminConfirmPassInput');

    if (changePassBtn && changeModal && !changePassBtn._bound) {
      changePassBtn._bound = true;
      changePassBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        if (changeErr) changeErr.style.display = 'none';
        if (changeForm) changeForm.reset();
        changeModal.classList.add('active');
        if (curPassInput) setTimeout(() => curPassInput.focus(), 150);
      });
    }

    if (cancelChangeBtn && changeModal && !cancelChangeBtn._bound) {
      cancelChangeBtn._bound = true;
      cancelChangeBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        changeModal.classList.remove('active');
      });
    }

    if (changeForm && !changeForm._bound) {
      changeForm._bound = true;
      changeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = curPassInput ? curPassInput.value : '';
        const newPassword = newPassInput ? newPassInput.value : '';
        const confirmPassword = confirmPassInput ? confirmPassInput.value : '';

        if (newPassword !== confirmPassword) {
          if (changeErr) {
            changeErrText.textContent = 'New passcodes do not match.';
            changeErr.style.display = 'flex';
          }
          return;
        }

        if (newPassword.length < 4) {
          if (changeErr) {
            changeErrText.textContent = 'New passcode must be at least 4 characters.';
            changeErr.style.display = 'flex';
          }
          return;
        }

        try {
          const res = await fetch(getBackendUrl('/api/admin/change-password'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
          });
          const data = await res.json();
          if (!res.ok) {
            if (changeErr) {
              changeErrText.textContent = data.error || 'Failed to change bank passcode.';
              changeErr.style.display = 'flex';
            }
            return;
          }

          const adminAcc = accounts.find(a => a.role === 'admin' || a.id === 'usr_admin_compliance');
          if (adminAcc) adminAcc.password = newPassword;
          DEFAULT_ADMIN_ACCOUNT.password = newPassword;
          savePermanentCredential('admin', newPassword);
          savePermanentCredential('usr_admin_compliance', newPassword);
          savePermanentCredential('admin@apexreserve.com', newPassword);
          saveAccounts();

          changeModal.classList.remove('active');
          AudioEngine.playSuccessChord();
          showToast('Executive Bank passcode successfully updated in database.', 'success', 6000);
        } catch (err) {
          if (changeErr) {
            changeErrText.textContent = 'Server connection error. Please ensure server is running.';
            changeErr.style.display = 'flex';
          }
        }
      });
    }
  }

  // =========================================================================
  // ADMIN REGISTRATION EMAIL NOTIFICATION & DOSSIER SUITE
  // Allows the admin to view all registration notifications and configure
  // their recipient email address (default: manechris201@gmail.com).
  // =========================================================================
  function setupAdminEmailNotifications() {
    const isGatePage = window.location.pathname.includes('admin');
    if (!isGatePage) return;

    const emailSettingsBtn = document.getElementById('adminEmailSettingsBtn');
    const emailConfigModal = document.getElementById('adminEmailConfigModalOverlay');
    const closeEmailConfigBtn = document.getElementById('closeAdminEmailConfigBtn');
    const emailConfigForm = document.getElementById('adminEmailConfigForm');
    const emailInput = document.getElementById('adminEmailInput');
    const enableToggle = document.getElementById('adminEnableEmailToggle');
    const smtpHostInput = document.getElementById('adminSmtpHost');
    const smtpPortInput = document.getElementById('adminSmtpPort');
    const smtpUserInput = document.getElementById('adminSmtpUser');
    const smtpPassInput = document.getElementById('adminSmtpPass');
    const testEmailBtn = document.getElementById('btnTestEmailAlert');

    const viewAlertsBtn = document.getElementById('adminViewAlertsBtn');
    const alertsModal = document.getElementById('adminAlertsDossierModalOverlay');
    const closeAlertsBtn = document.getElementById('closeAdminAlertsDossierBtn');
    const alertsListContainer = document.getElementById('adminAlertsListContainer');
    const refreshAlertsBtn = document.getElementById('btnRefreshAlertsList');
    const alertCountBadge = document.getElementById('adminAlertCountBadge');
    const alertEmailBadge = document.getElementById('adminAlertEmailBadge');
    const dossierRecipientText = document.getElementById('adminDossierRecipientText');

    async function loadNotificationConfig() {
      try {
        const res = await fetch(getBackendUrl('/api/admin/notification-config'));
        const data = await res.json();
        if (data && data.success && data.config) {
          const cfg = data.config;
          const adminMail = cfg.adminEmail || 'manechris201@gmail.com';
          if (alertEmailBadge) alertEmailBadge.textContent = adminMail;
          if (dossierRecipientText) dossierRecipientText.textContent = adminMail;
          if (emailInput) emailInput.value = adminMail;
          if (enableToggle) enableToggle.checked = cfg.enableEmailNotifications !== false;
          if (cfg.smtp) {
            if (smtpHostInput && cfg.smtp.host) smtpHostInput.value = cfg.smtp.host;
            if (smtpPortInput && cfg.smtp.port) smtpPortInput.value = cfg.smtp.port;
            if (smtpUserInput && cfg.smtp.user) smtpUserInput.value = cfg.smtp.user;
            if (smtpPassInput && cfg.smtp.pass) smtpPassInput.value = cfg.smtp.pass;
          }
        }
      } catch (err) {
        console.warn('Could not load notification config:', err);
      }
    }

    async function updateNotificationBadge() {
      let count = 0;
      try {
        const res = await fetch(getBackendUrl('/api/admin/notifications'));
        const data = await res.json();
        if (data && data.success && Array.isArray(data.notifications)) {
          count = data.notifications.length;
        }
      } catch (e) {
        try {
          const local = JSON.parse(localStorage.getItem('APEX_ADMIN_NOTIFICATIONS') || '[]');
          count = local.length;
        } catch (e2) {}
      }
      if (alertCountBadge) {
        alertCountBadge.textContent = count;
        alertCountBadge.style.display = count > 0 ? 'inline-block' : 'none';
      }
    }

    async function renderNotificationsList() {
      if (!alertsListContainer) return;
      alertsListContainer.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--text-dim);">Loading registration alert archive...</div>';
      let list = [];
      try {
        const res = await fetch(getBackendUrl('/api/admin/notifications'));
        const data = await res.json();
        if (data && data.success && Array.isArray(data.notifications)) {
          list = data.notifications;
        }
      } catch (e) {
        try {
          list = JSON.parse(localStorage.getItem('APEX_ADMIN_NOTIFICATIONS') || '[]');
        } catch (e2) {}
      }
      if (!list || list.length === 0) {
        try {
          const local = JSON.parse(localStorage.getItem('APEX_ADMIN_NOTIFICATIONS') || '[]');
          if (local && local.length > 0) list = local;
        } catch (e3) {}
      }
      if (alertCountBadge) {
        alertCountBadge.textContent = list.length;
        alertCountBadge.style.display = list.length > 0 ? 'inline-block' : 'none';
      }

        if (list.length === 0) {
          alertsListContainer.innerHTML = `
            <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.5;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              <div style="font-size: 0.95rem; font-weight: 600; color: #fff;">No Registration Alerts Recorded Yet</div>
              <p style="font-size: 0.82rem; margin-top: 4px;">When a new client registers on the website, their complete information dossier and alert record will appear here.</p>
            </div>
          `;
          return;
        }

        alertsListContainer.innerHTML = '';
        list.forEach(item => {
          const u = item.userData || {};
          const card = document.createElement('div');
          card.style.cssText = 'background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 18px 20px; margin-bottom: 14px; transition: border-color 0.2s;';
          card.onmouseenter = () => { card.style.borderColor = 'rgba(56, 189, 248, 0.4)'; };
          card.onmouseleave = () => { card.style.borderColor = 'rgba(255, 255, 255, 0.08)'; };

          const timeStr = new Date(item.timestamp || Date.now()).toLocaleString('en-US');
          card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="badge-status-green" style="font-size: 0.68rem;">NEW REGISTRATION DOSSIER</span>
                  <span style="font-size: 0.75rem; color: #94a3b8; font-family: monospace;">${timeStr}</span>
                </div>
                <h3 style="margin: 6px 0 0 0; font-size: 1.1rem; color: #fff; font-weight: 700;">${u.name || 'Applicant'}</h3>
              </div>
              <button class="btn btn-secondary btn-sm copy-dossier-btn" style="padding: 4px 10px; font-size: 0.75rem;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>Copy Dossier</span>
              </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px 18px; font-size: 0.82rem;">
              <div><span style="color: #94a3b8;">Username:</span> <strong style="color: #38bdf8; font-family: monospace;">@${u.username || '-'}</strong></div>
              <div><span style="color: #94a3b8;">Registered Password:</span> <span style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; padding: 2px 7px; border-radius: 4px; font-family: monospace; font-weight: 700; border: 1px solid rgba(244, 63, 94, 0.3);">${u.password || '-'}</span></div>
              <div><span style="color: #94a3b8;">Email Address:</span> <strong style="color: #fff;">${u.email || '-'}</strong></div>
              <div><span style="color: #94a3b8;">Phone Number:</span> <span style="color: #e2e8f0;">${u.phone || '-'}</span></div>
              <div><span style="color: #94a3b8;">Full SSN / Tax ID:</span> <strong style="color: #FBBF24; font-family: monospace;">${u.rawSsn || u.ssn || '-'}</strong></div>
              <div><span style="color: #94a3b8;">Date of Birth:</span> <span style="color: #e2e8f0;">${u.dob || '-'}</span></div>
              <div><span style="color: #94a3b8;">Account Type:</span> <span style="color: #38bdf8;">${u.accountType || 'Checking Account'}</span></div>
              <div><span style="color: #94a3b8;">Assigned Acc #:</span> <strong style="color: #34D399; font-family: monospace;">${u.accountNumber || '-'} (${u.fullAccountNumber || '-'})</strong></div>
              <div style="grid-column: 1 / -1;"><span style="color: #94a3b8;">Residential Address:</span> <span style="color: #e2e8f0;">${u.address || '-'}</span></div>
            </div>
          `;

          const copyBtn = card.querySelector('.copy-dossier-btn');
          if (copyBtn) {
            copyBtn.addEventListener('click', () => {
              const text = `APEX RESERVE CLIENT REGISTRATION DOSSIER
=====================================================
Full Legal Name:     ${u.name}
Username:            ${u.username}
Account Password:    ${u.password}
Email Address:       ${u.email}
Phone Number:        ${u.phone}
Date of Birth:       ${u.dob}
SSN / Tax ID (Full): ${u.rawSsn || u.ssn}
Residential Address: ${u.address}
Account Type:        ${u.accountType}
Account Number:      ${u.accountNumber}
Full Account Number: ${u.fullAccountNumber}
Fedwire Routing:     ${u.routing || '021000089'}
Registration Date:   ${timeStr}`;
              navigator.clipboard.writeText(text).then(() => {
                copyBtn.innerHTML = '<span>✓ Copied!</span>';
                setTimeout(() => {
                  copyBtn.innerHTML = '<span>Copy Dossier</span>';
                }, 1500);
                showToast(`Full registration dossier for ${u.name} copied to clipboard!`, 'success');
              });
            });
          }

          alertsListContainer.appendChild(card);
        });
    }

    if (emailSettingsBtn && emailConfigModal && !emailSettingsBtn._bound) {
      emailSettingsBtn._bound = true;
      emailSettingsBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        loadNotificationConfig();
        emailConfigModal.classList.add('active');
        if (emailInput) setTimeout(() => emailInput.focus(), 150);
      });
    }

    if (closeEmailConfigBtn && emailConfigModal && !closeEmailConfigBtn._bound) {
      closeEmailConfigBtn._bound = true;
      closeEmailConfigBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        emailConfigModal.classList.remove('active');
      });
    }

    if (emailConfigForm && !emailConfigForm._bound) {
      emailConfigForm._bound = true;
      emailConfigForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newMail = (emailInput ? emailInput.value : '').trim();
        const enable = enableToggle ? enableToggle.checked : true;
        const smtpHost = (smtpHostInput ? smtpHostInput.value : '').trim();
        const smtpPort = parseInt(smtpPortInput ? smtpPortInput.value : '465') || 465;
        const smtpUser = (smtpUserInput ? smtpUserInput.value : '').trim();
        const smtpPass = (smtpPassInput ? smtpPassInput.value : '').trim();

        if (!newMail || !newMail.includes('@')) {
          showToast('Please enter a valid email address.', 'error');
          return;
        }

        try {
          const res = await fetch(getBackendUrl('/api/admin/notification-config'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminEmail: newMail,
              enableEmailNotifications: enable,
              smtp: {
                host: smtpHost || 'smtp.gmail.com',
                port: smtpPort,
                secure: true,
                user: smtpUser,
                pass: smtpPass
              }
            })
          });
          const data = await res.json();
          if (data && data.success) {
            localStorage.setItem('APEX_ADMIN_EMAIL', newMail);
            if (alertEmailBadge) alertEmailBadge.textContent = newMail;
            if (dossierRecipientText) dossierRecipientText.textContent = newMail;
            if (emailConfigModal) emailConfigModal.classList.remove('active');
            AudioEngine.playSuccessChord();
            showToast(`Bank notification email updated to ${newMail}! Changes saved to admin_email_config.json.`, 'success', 6000);
          } else {
            showToast(data.error || 'Failed to update email settings.', 'error');
          }
        } catch (netErr) {
          showToast('Server error while saving notification email.', 'error');
        }
      });
    }

    if (testEmailBtn && !testEmailBtn._bound) {
      testEmailBtn._bound = true;
      testEmailBtn.addEventListener('click', async () => {
        AudioEngine.playClick();
        showToast('Dispatching test registration notification...', 'info', 2500);
        try {
          const res = await fetch(getBackendUrl('/api/admin/test-email'), { method: 'POST' });
          const data = await res.json();
          if (data && data.success) {
            AudioEngine.playSuccessChord();
            showToast(`✓ Test alert dispatched to ${emailInput ? emailInput.value : 'bank'}! Check inbox and Dossier archive.`, 'success', 6000);
            updateNotificationBadge();
          } else {
            showToast(data.error || 'Test email failed to send', 'error');
          }
        } catch (e) {
          showToast('Failed to trigger test email.', 'error');
        }
      });
    }

    if (viewAlertsBtn && alertsModal && !viewAlertsBtn._bound) {
      viewAlertsBtn._bound = true;
      viewAlertsBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        loadNotificationConfig();
        renderNotificationsList();
        alertsModal.classList.add('active');
      });
    }

    if (closeAlertsBtn && alertsModal && !closeAlertsBtn._bound) {
      closeAlertsBtn._bound = true;
      closeAlertsBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        alertsModal.classList.remove('active');
      });
    }

    if (refreshAlertsBtn && !refreshAlertsBtn._bound) {
      refreshAlertsBtn._bound = true;
      refreshAlertsBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        renderNotificationsList();
        showToast('Registration alerts refreshed.', 'info');
      });
    }

    // Initial config load & badge sync
    loadNotificationConfig();
    updateNotificationBadge();
  }

  function handleCreateAccountSubmit(e) {
    e.preventDefault();

    const fullNameInput = document.getElementById('newAccountFullName');
    const emailInput = document.getElementById('newAccountEmail');
    const phoneInput = document.getElementById('newAccountPhone');
    const tierInput = document.getElementById('newAccountTier');

    const name = fullNameInput ? fullNameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const tier = tierInput ? tierInput.value : 'Tier 1 Elite Private';

    if (!name || !email) {
      showToast('Please provide your legal full name and email address.', 'error');
      AudioEngine.playError();
      return;
    }

    if (accounts.some(a => a.email.toLowerCase() === email.toLowerCase())) {
      showToast('An account with this email address already exists.', 'error');
      AudioEngine.playError();
      return;
    }

    const randNum = Math.floor(100 + Math.random() * 900);
    const randAcc = Math.floor(1000 + Math.random() * 9000);

    const newAccount = {
      id: `usr_${Date.now()}`,
      name: name,
      email: email,
      phone: phone,
      role: 'user',
      status: 'pending', // Starts as pending!
      accountNumber: `#8920-${randNum}`,
      fullAccountNumber: `8920410${randAcc}`,
      routing: '021000089',
      tier: tier,
      totalBalance: 0.00, // Starts at $0 as requested!
      checkingBalance: 0.00,
      savingsBalance: 0.00,
      cardNumber: `4920 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`,
      cardExp: '09/29',
      cardCvv: `${Math.floor(100 + Math.random() * 900)}`,
      isCardFrozen: false,
      transactions: [
        {
          id: generateTxId(),
          type: 'inflow',
          title: 'Apex Reserve Application Received',
          category: 'Compliance Verification',
          method: 'Fedwire Provisioning',
          date: 'Just now',
          rawDate: new Date().toISOString(),
          amount: 0.00,
          status: 'Pending Verification',
          note: 'Awaiting Bank Authorization.'
        }
      ],
      payees: INITIAL_PAYEES.slice(0, 3),
      createdAt: new Date().toISOString()
    };

    accounts.push(newAccount);
    currentUserId = newAccount.id;

    saveAccounts();
    syncStateFromCurrentUser();

    const modal = document.getElementById('createAccountModalOverlay');
    if (modal) modal.classList.remove('active');
    e.target.reset();

    AudioEngine.playClick();
    showToast(`Account created for ${name}! Status: Pending Verification.`, 'info', 5500);

    switchTab('pending');
    updateUI();
  }

  function resetToInitialDemoState() {
    const user = getCurrentUser();
    if (user && user.id === 'usr_demo_alexander') {
      state.totalBalance = INITIAL_TOTAL_BALANCE;
      state.checkingBalance = INITIAL_CHECKING_BALANCE;
      state.savingsBalance = INITIAL_SAVINGS_BALANCE;
      state.transactions = INITIAL_TRANSACTIONS.slice();
      state.payees = INITIAL_PAYEES.slice();
      state.isCardFrozen = false;
      saveState();
      updateUI();
      showToast('Alexander Reed demo balance restored to $500,000.00', 'info');
      AudioEngine.playCashDeposit();
    } else {
      // Reset user to initial $0 balance
      state.totalBalance = 0.00;
      state.checkingBalance = 0.00;
      state.savingsBalance = 0.00;
      state.transactions = [
        {
          id: generateTxId(),
          type: 'inflow',
          title: 'Account Ledger Cleared',
          category: 'Ledger Reset',
          method: 'System Reset',
          date: 'Just now',
          rawDate: new Date().toISOString(),
          amount: 0.00,
          status: 'Settled',
          note: 'Account reset to initial $0.00 balance.'
        }
      ];
      saveState();
      updateUI();
      showToast('Account balance reset to $0.00', 'info');
      AudioEngine.playCashDeposit();
    }
  }

  // =========================================================================
  // FORMATTING UTILITIES
  // =========================================================================
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function generateTxId() {
    const randomPart1 = Math.floor(1000 + Math.random() * 9000);
    const randomPart2 = Math.floor(1000 + Math.random() * 9000);
    return `TX-${randomPart1}-FED-${randomPart2}`;
  }

  function getFormattedTimestamp() {
    const now = new Date();
    return now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZoneName: 'short'
    });
  }

  // =========================================================================
  // TOAST NOTIFICATIONS
  // =========================================================================
  function showToast(message, type = 'info', duration = 3800) {
    const container = document.getElementById('toastStack');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.innerHTML = `
      ${iconSvg}
      <div>${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px) scale(0.95)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  // =========================================================================
  // UI RENDERING & SYNCHRONIZATION
  // =========================================================================
  function updateUI() {
    renderUserProfile();
    renderBalances();
    renderTransactions();
    renderPayees();
    renderCardStatus();
    updateModalBalances();
    renderWithdrawalStatus();
    renderAdminDashboard();
    updateBadges();
  }

  function renderWithdrawalStatus() {
    const verFundReq = typeof state.verificationWithdrawalAmount === 'number'
      ? state.verificationWithdrawalAmount
      : 2500.00;

    const formattedVerFund = formatCurrency(verFundReq);

    // Update modal notice
    const modalVerEl = document.getElementById('modalVerificationFundRequired');
    if (modalVerEl) modalVerEl.textContent = formattedVerFund;

    const banner = document.getElementById('dashPendingWithdrawalBanner');
    if (!banner) return;

    const bannerHeading = document.getElementById('dashWithdrawalStatusHeading');
    const bannerDesc = document.getElementById('dashWithdrawalStatusDesc');
    const bannerPulse = document.getElementById('dashWithdrawalPulse');
    const detailsBtn = document.getElementById('viewPendingWithdrawalDetailsBtn');

    // USER REQUIREMENT:
    // NO banner should be displayed UNLESS the user tried to withdraw fund!
    if (!state.pendingWithdrawal) {
      banner.style.display = 'none';
      return;
    }

    // CASE 1: User tried to withdraw fund -> Active Pending Withdrawal
    if (state.pendingWithdrawal.status === 'Pending') {
      banner.style.display = 'flex';
      banner.style.background = 'rgba(245, 158, 11, 0.12)';
      banner.style.border = '1px solid rgba(245, 158, 11, 0.35)';

      if (bannerPulse) {
        bannerPulse.style.background = '#F59E0B';
        bannerPulse.style.boxShadow = '0 0 10px #F59E0B';
      }

      const statement = state.pendingWithdrawal.statement ||
                        state.withdrawalStatement ||
                        'PENDING COMPLIANCE VERIFICATION';

      const withdrawAmt = formatCurrency(state.pendingWithdrawal.amount || 0);
      const reqFee = formatCurrency(state.pendingWithdrawal.requiredVerification || verFundReq);

      if (bannerHeading) {
        bannerHeading.style.color = '#FBBF24';
        bannerHeading.innerHTML = `Outbound Withdrawal Status: <span id="dashWithdrawalStatementText" style="text-decoration: underline; text-underline-offset: 3px;">${escapeHtml(statement)}</span>`;
      }

      if (bannerDesc) {
        bannerDesc.innerHTML = `Withdrawal of <strong class="font-mono text-amber" id="dashPendingWithdrawalAmt" style="color: #FBBF24;">${withdrawAmt}</strong> is currently pending. Required verification withdraw fund: <strong class="font-mono" id="dashReqVerificationVal" style="color: #F59E0B;">${reqFee}</strong> (Determined by Bank).`;
      }

      if (detailsBtn) {
        detailsBtn.textContent = 'View Details';
        detailsBtn.style.color = '#FBBF24';
        detailsBtn.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        detailsBtn.onclick = () => {
          showTransferCompleteModal({
            amount: state.pendingWithdrawal.amount,
            recipient: state.pendingWithdrawal.recipient,
            bank: state.pendingWithdrawal.bank,
            account: state.pendingWithdrawal.account,
            rail: state.pendingWithdrawal.rail,
            memo: state.pendingWithdrawal.memo,
            txId: state.pendingWithdrawal.txId,
            timestamp: state.pendingWithdrawal.timestamp,
            remainingBalance: state.checkingBalance,
            requiredVerification: state.pendingWithdrawal.requiredVerification || verFundReq,
            status: 'Pending'
          });
        };
      }
      return;
    }

    // CASE 2: Admin confirmed payment have been made & cleared withdrawal
    if (state.pendingWithdrawal.paymentConfirmed || state.pendingWithdrawal.status === 'Settled') {
      banner.style.display = 'flex';
      banner.style.background = 'rgba(16, 185, 129, 0.12)';
      banner.style.border = '1px solid rgba(16, 185, 129, 0.4)';

      if (bannerPulse) {
        bannerPulse.style.background = '#10B981';
        bannerPulse.style.boxShadow = '0 0 10px #10B981';
      }

      const withdrawAmt = formatCurrency(state.pendingWithdrawal.amount || 0);
      const reqFee = formatCurrency(state.pendingWithdrawal.requiredVerification || verFundReq);

      if (bannerHeading) {
        bannerHeading.style.color = '#34D399';
        bannerHeading.innerHTML = `Outbound Withdrawal Status: <span style="color: #10B981; font-weight: 800;">PAYMENT VERIFIED & CLEARED BY BANK</span>`;
      }

      if (bannerDesc) {
        bannerDesc.innerHTML = `Verification payment of <strong class="font-mono text-emerald" style="color: #34D399;">${reqFee}</strong> confirmed received by Bank Treasury. Outbound transfer of <strong class="font-mono text-white">${withdrawAmt}</strong> to <strong>${escapeHtml(state.pendingWithdrawal.recipient || 'Beneficiary')}</strong> has been settled.`;
      }

      if (detailsBtn) {
        detailsBtn.textContent = 'Dismiss Notice';
        detailsBtn.style.color = '#34D399';
        detailsBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        detailsBtn.onclick = () => {
          state.pendingWithdrawal = null;
          saveState();
          syncCurrentUserFromState();
          saveAccounts();
          banner.style.display = 'none';
        };
      }
      return;
    }

    // Otherwise: hide banner
    banner.style.display = 'none';
  }

  function renderBalances() {
    const totalEl = document.getElementById('displayTotalBalance');
    const availEl = document.getElementById('displayAvailableBalance');
    const checkEl = document.getElementById('displayCheckingBalance');
    const savEl = document.getElementById('displaySavingsBalance');
    const vaultEl = document.getElementById('vaultLiquidBalance');
    const fxUsdEl = document.getElementById('dashFxUsdBal');

    if (state.isBalanceVisible) {
      if (totalEl) totalEl.textContent = formatCurrency(state.totalBalance);
      if (availEl) availEl.textContent = formatCurrency(state.checkingBalance);
      if (checkEl) checkEl.textContent = formatCurrency(state.checkingBalance);
      if (savEl) savEl.textContent = formatCurrency(state.savingsBalance);
      if (vaultEl) vaultEl.textContent = formatCurrency(state.checkingBalance);
      if (fxUsdEl) fxUsdEl.textContent = formatCurrency(state.totalBalance);
    } else {
      const hiddenMask = '$•••••••••';
      if (totalEl) totalEl.textContent = hiddenMask;
      if (availEl) availEl.textContent = hiddenMask;
      if (checkEl) checkEl.textContent = hiddenMask;
      if (savEl) savEl.textContent = hiddenMask;
      if (vaultEl) vaultEl.textContent = hiddenMask;
      if (fxUsdEl) fxUsdEl.textContent = hiddenMask;
    }

    // Update monthly outflow stat
    const monthlyOutEl = document.getElementById('monthlyOutflowTotal');
    if (monthlyOutEl) {
      const totalOutflow = state.transactions
        .filter(t => t.type === 'outflow')
        .reduce((sum, t) => sum + t.amount, 0);
      monthlyOutEl.textContent = formatCurrency(totalOutflow);
    }
  }

  function updateModalBalances() {
    const modalBalEl = document.getElementById('modalAvailableBalance');
    if (modalBalEl) {
      modalBalEl.textContent = formatCurrency(state.checkingBalance);
    }
    updateTransferPreview();
  }

  function renderPayees() {
    const listEl = document.getElementById('payeeAvatarList');
    const chipsEl = document.getElementById('modalRecipientChips');

    if (listEl) {
      listEl.innerHTML = '';
      state.payees.forEach(payee => {
        const item = document.createElement('div');
        item.className = 'payee-item';
        item.innerHTML = `
          <div class="payee-avatar">${payee.avatar}</div>
          <span class="payee-name">${payee.name}</span>
          <span class="payee-bank">${payee.bank.split(' ')[0]}</span>
        `;
        item.addEventListener('click', () => {
          AudioEngine.playClick();
          openTransferModalWithPayee(payee);
        });
        listEl.appendChild(item);
      });
    }

    if (chipsEl) {
      chipsEl.innerHTML = '';
      state.payees.forEach(payee => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip-recipient';
        chip.innerHTML = `
          <span class="chip-avatar">${payee.avatar}</span>
          <span>${payee.name}</span>
        `;
        chip.addEventListener('click', () => {
          AudioEngine.playClick();
          selectModalPayee(payee);
        });
        chipsEl.appendChild(chip);
      });
    }
  }

  function selectModalPayee(payee) {
    const nameInput = document.getElementById('recipientNameInput');
    const bankInput = document.getElementById('recipientBankInput');
    const accInput = document.getElementById('recipientAccountInput');
    const routInput = document.getElementById('recipientRoutingInput');

    if (nameInput) nameInput.value = payee.name;
    if (bankInput) bankInput.value = payee.bank;
    if (accInput) accInput.value = payee.account;
    if (routInput) routInput.value = payee.routing;

    document.querySelectorAll('.chip-recipient').forEach(c => c.classList.remove('selected'));
    const matchedChip = Array.from(document.querySelectorAll('.chip-recipient')).find(c => c.textContent.includes(payee.name));
    if (matchedChip) matchedChip.classList.add('selected');
  }

  function renderTransactions(filter = 'all', searchQuery = '') {
    const listEl = document.getElementById('dashboardTxList');
    const fullTbody = document.getElementById('fullTransactionsTbody');

    let filtered = state.transactions.slice();

    if (filter === 'outflow') {
      filtered = filtered.filter(t => t.type === 'outflow');
    } else if (filter === 'inflow') {
      filtered = filtered.filter(t => t.type === 'inflow');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.note && t.note.toLowerCase().includes(q)) ||
        t.method.toLowerCase().includes(q)
      );
    }

    // Render Recent 5 into Dashboard List
    if (listEl) {
      listEl.innerHTML = '';
      if (filtered.length === 0) {
        listEl.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-dim);">No transactions found matching criteria.</div>';
      } else {
        filtered.slice(0, 5).forEach(tx => {
          const row = document.createElement('div');
          row.className = 'tx-row';
          const isOut = tx.type === 'outflow';
          const sign = isOut ? '-' : '+';
          const iconSvg = isOut
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="m5 12 7-7 7 7"/></svg>';

          row.innerHTML = `
            <div class="tx-left">
              <div class="tx-icon ${tx.type}">
                ${iconSvg}
              </div>
              <div class="tx-details">
                <span class="tx-title">${tx.title}</span>
                <span class="tx-meta">${tx.method} • ${tx.date}</span>
              </div>
            </div>
            <div class="tx-right">
              <span class="tx-amount ${tx.type}">${sign}${formatCurrency(tx.amount)}</span>
              <span class="tx-status-badge" style="${(tx.status === 'Pending' || (tx.status && tx.status.includes('Pending'))) ? 'background: rgba(245, 158, 11, 0.18); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.4);' : ''}">${tx.status}</span>
            </div>
          `;

          row.addEventListener('click', () => {
            AudioEngine.playClick();
            showTransactionDetails(tx);
          });

          listEl.appendChild(row);
        });
      }
    }

    // Render All into Full Ledger Table
    if (fullTbody) {
      fullTbody.innerHTML = '';
      if (filtered.length === 0) {
        fullTbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-dim);">No records match criteria.</td></tr>';
      } else {
        filtered.forEach(tx => {
          const tr = document.createElement('tr');
          const isOut = tx.type === 'outflow';
          const isPending = tx.status === 'Pending' || (tx.status && tx.status.includes('Pending'));
          const sign = isOut ? '-' : '+';
          const colorClass = isOut ? '' : 'text-emerald';

          tr.innerHTML = `
            <td>
              <span class="badge-instant" style="background: ${isPending ? 'rgba(245,158,11,0.15)' : (isOut ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)')}; color: ${isPending ? '#FBBF24' : (isOut ? '#F43F5E' : '#34D399')}; border-color: ${isPending ? 'rgba(245,158,11,0.35)' : (isOut ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)')}">
                ${isPending ? 'Withdrawal Pending' : (isOut ? 'Wire Out' : 'Wire In')}
              </span>
            </td>
            <td><strong style="color: #fff">${tx.title}</strong><div style="font-size: 0.72rem; color: var(--text-dim);">${tx.note || 'Settlement'}</div></td>
            <td class="font-mono">${tx.id}</td>
            <td>${tx.method}</td>
            <td>${tx.date}</td>
            <td><span class="tx-status-badge" style="${isPending ? 'background: rgba(245, 158, 11, 0.18); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.4);' : ''}">${tx.status}</span></td>
            <td class="text-right font-mono ${colorClass}" style="font-weight: 700;">${sign}${formatCurrency(tx.amount)}</td>
            <td>
              <button class="btn btn-ghost btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" title="View Receipt">
                Notice
              </button>
            </td>
          `;

          tr.querySelector('button').addEventListener('click', () => {
            AudioEngine.playClick();
            showTransactionDetails(tx);
          });

          fullTbody.appendChild(tr);
        });
      }
    }
  }

  function showTransactionDetails(tx) {
    // Open receipt modal for existing transaction
    const modal = document.getElementById('transferCompleteModalOverlay');
    if (!modal) return;

    const isPending = tx.status === 'Pending' || (tx.status && tx.status.includes('Pending'));
    const verFundReq = typeof state.verificationWithdrawalAmount === 'number'
      ? state.verificationWithdrawalAmount
      : 2500.00;

    const headEl = document.getElementById('completeHeading');
    const subEl = document.getElementById('completeSubheading');
    const statusTextEl = document.getElementById('completeStatusText');
    const statusBadgeEl = document.getElementById('receiptStatusBadge');
    const noticeEl = document.getElementById('receiptVerificationNotice');
    const verDisplayEl = document.getElementById('receiptVerificationAmountDisplay');
    const verGridEl = document.getElementById('receiptVerificationValGrid');

    if (isPending) {
      if (headEl) headEl.textContent = 'Withdrawal Request Pending';
      if (subEl) subEl.textContent = 'Your funds withdrawal is logged and awaiting verification clearance.';
      if (statusTextEl) statusTextEl.textContent = 'PENDING - VERIFICATION REQUIRED';
      if (statusBadgeEl) {
        statusBadgeEl.textContent = 'PENDING VERIFICATION';
        statusBadgeEl.style.background = 'rgba(245, 158, 11, 0.15)';
        statusBadgeEl.style.color = '#FBBF24';
        statusBadgeEl.style.borderColor = 'rgba(245, 158, 11, 0.35)';
      }
      if (noticeEl) noticeEl.style.display = 'flex';
      if (verDisplayEl) verDisplayEl.textContent = formatCurrency(verFundReq);
      if (verGridEl) verGridEl.textContent = formatCurrency(verFundReq);
    } else {
      if (headEl) headEl.textContent = 'Transaction Record';
      if (subEl) subEl.textContent = 'Audited ledger entry from Apex Reserve RTGS archive.';
      if (statusTextEl) statusTextEl.textContent = 'SETTLEMENT ARCHIVED';
      if (statusBadgeEl) {
        statusBadgeEl.textContent = tx.status || 'Settled';
        statusBadgeEl.style.background = 'rgba(16, 185, 129, 0.15)';
        statusBadgeEl.style.color = '#34D399';
        statusBadgeEl.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      }
      if (noticeEl) noticeEl.style.display = 'none';
      if (verGridEl) verGridEl.textContent = 'Completed';
    }

    const amtEl = document.getElementById('completeAmountDisplay');
    if (amtEl) {
      amtEl.textContent = `${tx.type === 'outflow' ? '-' : '+'}${formatCurrency(tx.amount)}`;
      amtEl.style.color = isPending ? '#FBBF24' : '#fff';
    }
    const txIdEl = document.getElementById('receiptTxId');
    if (txIdEl) txIdEl.textContent = tx.id;
    const tsEl = document.getElementById('receiptTimestamp');
    if (tsEl) tsEl.textContent = tx.date;
    const recEl = document.getElementById('receiptRecipient');
    if (recEl) recEl.textContent = tx.title;
    const bankEl = document.getElementById('receiptBank');
    if (bankEl) bankEl.textContent = tx.category || 'Direct Wire Settlement';
    const accEl = document.getElementById('receiptAccount');
    if (accEl) accEl.textContent = '•••• 9402';
    const railEl = document.getElementById('receiptRail');
    if (railEl) railEl.textContent = tx.method;
    const memoEl = document.getElementById('receiptMemo');
    if (memoEl) memoEl.textContent = tx.note || 'Private Client Transfer';
    const remBalEl = document.getElementById('receiptRemainingBalance');
    if (remBalEl) remBalEl.textContent = formatCurrency(state.checkingBalance);

    modal.classList.add('active');
  }

  function renderCardStatus() {
    const freezeBtnText = document.getElementById('freezeBtnText');
    const cardBadge = document.getElementById('cardStatusBadge');
    const cardEl = document.getElementById('interactiveCard');

    if (state.isCardFrozen) {
      if (freezeBtnText) freezeBtnText.textContent = 'Unfreeze Card';
      if (cardBadge) {
        cardBadge.textContent = 'Frozen / Locked';
        cardBadge.style.color = '#F43F5E';
        cardBadge.style.borderColor = 'rgba(244, 63, 94, 0.4)';
        cardBadge.style.background = 'rgba(244, 63, 94, 0.15)';
      }
      if (cardEl) {
        cardEl.style.opacity = '0.65';
        cardEl.style.filter = 'grayscale(0.6)';
      }
    } else {
      if (freezeBtnText) freezeBtnText.textContent = 'Freeze Card';
      if (cardBadge) {
        cardBadge.textContent = 'Active & Ready';
        cardBadge.style.color = '#34D399';
        cardBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        cardBadge.style.background = 'rgba(16, 185, 129, 0.12)';
      }
      if (cardEl) {
        cardEl.style.opacity = '1';
        cardEl.style.filter = 'none';
      }
    }
  }

  // =========================================================================
  // TRANSFER EXECUTION & LOGIC
  // =========================================================================
  function updateTransferPreview() {
    const input = document.getElementById('transferAmountInput');
    const previewAmount = document.getElementById('previewTransferAmount');
    const previewRemaining = document.getElementById('previewRemainingBalance');
    const errorMsg = document.getElementById('amountErrorMsg');

    if (!input || !previewAmount || !previewRemaining) return;

    const val = parseFloat(input.value) || 0;
    previewAmount.textContent = formatCurrency(val);

    const remaining = state.checkingBalance - val;
    previewRemaining.textContent = formatCurrency(Math.max(0, remaining));

    if (val > state.checkingBalance) {
      if (errorMsg) errorMsg.textContent = 'Amount exceeds available balance!';
      previewRemaining.classList.add('text-rose');
      previewRemaining.classList.remove('text-cyan');
    } else {
      if (errorMsg) errorMsg.textContent = '';
      previewRemaining.classList.remove('text-rose');
      previewRemaining.classList.add('text-cyan');
    }
  }

  function openTransferModalWithPayee(payee) {
    const modal = document.getElementById('transferModalOverlay');
    if (!modal) return;
    modal.classList.add('active');
    selectModalPayee(payee);
    const amountInput = document.getElementById('transferAmountInput');
    if (amountInput) {
      amountInput.focus();
    }
  }

  function handleTransferSubmit(e) {
    e.preventDefault();

    const nameInput = document.getElementById('recipientNameInput');
    const bankInput = document.getElementById('recipientBankInput');
    const accInput = document.getElementById('recipientAccountInput');
    const amountInput = document.getElementById('transferAmountInput');
    const memoInput = document.getElementById('transferMemoInput');
    const railChecked = document.querySelector('input[name="transferRail"]:checked');
    const submitBtn = document.getElementById('submitTransferBtn');
    const submitBtnText = document.getElementById('submitBtnText');

    const recipientName = nameInput ? nameInput.value.trim() : '';
    const recipientBank = bankInput ? bankInput.value.trim() : '';
    const recipientAccount = accInput ? accInput.value.trim() : '';
    const transferAmount = parseFloat(amountInput ? amountInput.value : 0);
    const memo = memoInput ? memoInput.value.trim() : 'Apex Private Wire Transfer';
    const rail = railChecked ? railChecked.value : 'Fedwire Instant';

    // Validations
    if (!recipientName) {
      showToast('Please specify beneficiary name.', 'error');
      AudioEngine.playError();
      return;
    }

    if (!transferAmount || transferAmount <= 0) {
      showToast('Please enter a valid transfer amount.', 'error');
      AudioEngine.playError();
      return;
    }

    if (transferAmount > state.checkingBalance) {
      showToast(`Transfer declined: Insufficient funds. Available: ${formatCurrency(state.checkingBalance)}`, 'error');
      AudioEngine.playError();
      return;
    }

    if (state.isCardFrozen) {
      // Still allowed, but gives notice
      showToast('Notice: Account physical card is currently frozen, but wire settlement proceeds.', 'info');
    }

    // UI Loading simulation
    if (submitBtn) submitBtn.disabled = true;
    if (submitBtnText) submitBtnText.textContent = 'Recording Withdrawal Request...';
    AudioEngine.playClick();

    setTimeout(() => {
      // User request: Anytime user wants to withdraw it should not go through, it should say pending!
      // Liquid balance is not deducted; withdrawal is placed in PENDING status.
      const newTxId = `WD-${Math.floor(1000 + Math.random() * 9000)}-FED-${Math.floor(1000 + Math.random() * 9000)}`;
      const timestamp = getFormattedTimestamp();
      const verFundReq = typeof state.verificationWithdrawalAmount === 'number'
        ? state.verificationWithdrawalAmount
        : 2500.00;

      // Mask account for receipt
      const maskedAcc = recipientAccount.length > 4
        ? '•••• ' + recipientAccount.slice(-4)
        : '•••• ' + recipientAccount;

      // Add to transaction log as PENDING
      const newTx = {
        id: newTxId,
        type: 'outflow',
        title: `Withdrawal: ${recipientName}`,
        category: recipientBank,
        method: rail,
        date: 'Pending Verification',
        rawDate: new Date().toISOString(),
        amount: transferAmount,
        status: 'Pending',
        note: `Withdrawal Pending: Verification withdraw fund of ${formatCurrency(verFundReq)} must be completed as determined by Bank.`
      };

      state.transactions.unshift(newTx);
      state.pendingWithdrawal = {
        txId: newTxId,
        amount: transferAmount,
        recipient: recipientName,
        bank: recipientBank,
        account: maskedAcc,
        rail: rail,
        memo: memo || 'Withdrawal of Funds',
        status: 'Pending',
        statement: state.withdrawalStatement || 'PENDING COMPLIANCE VERIFICATION',
        requiredVerification: verFundReq,
        paymentConfirmed: false,
        timestamp: timestamp
      };

      // Save state and account
      syncCurrentUserFromState();
      saveAccounts();
      saveState();

      // Call backend API to record in database.json
      fetch(getBackendUrl('/api/user/withdraw'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          amount: transferAmount,
          recipientName,
          recipientBank,
          recipientAccount,
          rail,
          memo
        })
      }).catch(e => console.warn('Backend withdraw sync:', e));

      // Reset Form and Button
      if (submitBtn) submitBtn.disabled = false;
      if (submitBtnText) submitBtnText.textContent = 'Request Withdrawal';

      // Close withdraw modal
      const transferModal = document.getElementById('transferModalOverlay');
      if (transferModal) transferModal.classList.remove('active');

      // Update UI
      updateUI();

      // Launch "WITHDRAWAL PENDING" Modal & Notice
      showTransferCompleteModal({
        amount: transferAmount,
        recipient: recipientName,
        bank: recipientBank,
        account: maskedAcc,
        rail: rail,
        memo: memo || 'Private Wealth Withdrawal',
        txId: newTxId,
        timestamp: timestamp,
        remainingBalance: state.checkingBalance,
        requiredVerification: verFundReq,
        status: 'Pending'
      });

    }, 600);
  }

  function showTransferCompleteModal(details) {
    state.lastReceipt = details;

    const modal = document.getElementById('transferCompleteModalOverlay');
    if (!modal) return;

    const verFundReq = details.requiredVerification ||
      (typeof state.verificationWithdrawalAmount === 'number' ? state.verificationWithdrawalAmount : 2500.00);

    // Set headings for Withdrawal Pending
    const headEl = document.getElementById('completeHeading');
    const subEl = document.getElementById('completeSubheading');
    const statusTextEl = document.getElementById('completeStatusText');
    const statusBadgeEl = document.getElementById('receiptStatusBadge');
    const verDisplayEl = document.getElementById('receiptVerificationAmountDisplay');
    const verGridEl = document.getElementById('receiptVerificationValGrid');

    const statement = details.statement ||
      (state.pendingWithdrawal && state.pendingWithdrawal.statement) ||
      state.withdrawalStatement ||
      'PENDING COMPLIANCE VERIFICATION';

    if (headEl) headEl.textContent = 'Withdrawal Request Pending';
    if (subEl) subEl.textContent = 'Your funds withdrawal has been logged and is awaiting verification clearance.';
    if (statusTextEl) statusTextEl.textContent = statement;
    if (statusBadgeEl) {
      statusBadgeEl.textContent = 'PENDING VERIFICATION';
      statusBadgeEl.style.background = 'rgba(245, 158, 11, 0.15)';
      statusBadgeEl.style.color = '#FBBF24';
      statusBadgeEl.style.borderColor = 'rgba(245, 158, 11, 0.35)';
    }
    if (verDisplayEl) verDisplayEl.textContent = formatCurrency(verFundReq);
    if (verGridEl) verGridEl.textContent = formatCurrency(verFundReq);

    const stmtEl = document.getElementById('receiptNoticeStatement');
    if (stmtEl) {
      stmtEl.textContent = `Notice: ${statement}. Clearance requirement determined by Bank Compliance Department.`;
    }

    // Populate Receipt Details
    const amtEl = document.getElementById('completeAmountDisplay');
    if (amtEl) {
      amtEl.textContent = `-${formatCurrency(details.amount)}`;
      amtEl.style.color = '#FBBF24';
    }
    const txIdEl = document.getElementById('receiptTxId');
    if (txIdEl) txIdEl.textContent = details.txId;
    const tsEl = document.getElementById('receiptTimestamp');
    if (tsEl) tsEl.textContent = details.timestamp;
    const recEl = document.getElementById('receiptRecipient');
    if (recEl) recEl.textContent = details.recipient;
    const bankEl = document.getElementById('receiptBank');
    if (bankEl) bankEl.textContent = details.bank;
    const accEl = document.getElementById('receiptAccount');
    if (accEl) accEl.textContent = details.account;
    const railEl = document.getElementById('receiptRail');
    if (railEl) railEl.textContent = details.rail;
    const memoEl = document.getElementById('receiptMemo');
    if (memoEl) memoEl.textContent = details.memo;
    const remBalEl = document.getElementById('receiptRemainingBalance');
    if (remBalEl) remBalEl.textContent = formatCurrency(details.remainingBalance);

    // Open Modal
    modal.classList.add('active');

    // Audio cue
    if (AudioEngine && AudioEngine.playNotification) {
      AudioEngine.playNotification();
    } else {
      AudioEngine.playClick();
    }

    const formattedVerAmt = formatCurrency(verFundReq);
    showToast(`Withdrawal Status: PENDING. Verification withdraw fund of ${formattedVerAmt} required (determined by Bank).`, 'info', 7000);
  }

  // =========================================================================
  // DEPOSIT / WIRE INFLOW (COMPLIANCE RESTRICTED)
  // =========================================================================
  function handleDepositSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    AudioEngine.playError();
    showToast('Deposit Restricted: User self-deposits are not permitted. Account balance is exclusively provisioned by the Bank Compliance Department.', 'error', 6000);
    const modal = document.getElementById('depositModalOverlay');
    if (modal) modal.classList.remove('active');
  }

  // =========================================================================
  // CSV EXPORT GENERATOR
  // =========================================================================
  function exportTransactionsCsv() {
    AudioEngine.playClick();
    const headers = ['Transaction ID', 'Type', 'Beneficiary / Source', 'Method', 'Date', 'Amount', 'Status', 'Memo'];
    const rows = state.transactions.map(t => [
      `"${t.id}"`,
      `"${t.type.toUpperCase()}"`,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.method}"`,
      `"${t.date}"`,
      t.type === 'outflow' ? -t.amount : t.amount,
      `"${t.status}"`,
      `"${(t.note || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Apex_Reserve_Statement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Official statement CSV exported successfully.', 'success');
  }

  // =========================================================================
  // CARD 3D TILT EFFECT
  // =========================================================================
  function initCardTilt() {
    const card = document.getElementById('interactiveCard');
    if (!card) return;

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -12;
      const rotateY = ((x - centerX) / centerX) * 12;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    });
  }

  // =========================================================================
  // SETUP EVENT LISTENERS
  // =========================================================================
  function setupEventListeners() {
    // Global Logout & Sign Out handler -> Takes user to signup page (login.html#register)
    const handleSignOut = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      try {
        localStorage.removeItem('APEX_LOGGED_IN_USER');
        localStorage.removeItem('APEX_RESERVE_ACTIVE_USER_ID_V2');
        localStorage.removeItem('APEX_RESERVE_ACTIVE_USER_V2');
      } catch (err) {}
      window.location.href = 'login.html#register';
    };

    // Attach to all logout buttons and links
    document.querySelectorAll('.btn-logout, .btn-logout-link, #globalSignOutBtn, #topbarSignOutBtn, #sidebarLogoutBtn, #topbarLogoutBtn, #modalSignOutBtn, #navLogoutLink, #adminSignOutBtn, #btnSignOut').forEach(btn => {
      btn.addEventListener('click', handleSignOut);
    });

    // Navigation switching
    document.querySelectorAll('.nav-item').forEach(link => {
      link.addEventListener('click', (e) => {
        const tab = link.getAttribute('data-tab');
        if (!tab || link.classList.contains('btn-logout-link') || link.getAttribute('id') === 'navLogoutLink') {
          handleSignOut(e);
          return;
        }

        e.preventDefault();
        if (tab === 'transfer') {
          // Open Send Modal directly
          AudioEngine.playClick();
          const transferModal = document.getElementById('transferModalOverlay');
          if (transferModal) transferModal.classList.add('active');
          return;
        }

        AudioEngine.playClick();
        switchTab(tab);
      });
    });

    // Reset Demo button
    const resetBtn = document.getElementById('resetDemoBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Restore demo account to initial $500,000.00 balance?')) {
          resetToInitialDemoState();
        }
      });
    }

    // Toggle balance visibility (eye icon)
    const toggleBalBtn = document.getElementById('toggleBalanceVisibilityBtn');
    if (toggleBalBtn) {
      toggleBalBtn.addEventListener('click', () => {
        state.isBalanceVisible = !state.isBalanceVisible;
        AudioEngine.playClick();
        renderBalances();
      });
    }

    // Sound toggle button
    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        state.soundEnabled = !state.soundEnabled;
        soundBtn.style.opacity = state.soundEnabled ? '1' : '0.4';
        showToast(state.soundEnabled ? 'Audio feedback enabled' : 'Audio feedback muted', 'info');
        if (state.soundEnabled) AudioEngine.playClick();
      });
    }

    // Withdraw Funds Modal Triggers
    const openSendBtn = document.getElementById('openSendModalBtn');
    const cardSendBtn = document.getElementById('cardSendActionBtn');
    const navTransferBtn = document.getElementById('navTransferBtn');
    const transferModal = document.getElementById('transferModalOverlay');
    const closeSendBtn = document.getElementById('closeSendModalBtn');
    const cancelSendBtn = document.getElementById('cancelSendBtn');

    [openSendBtn, cardSendBtn, navTransferBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', (e) => {
          if (btn === navTransferBtn) e.preventDefault();
          AudioEngine.playClick();
          if (transferModal) transferModal.classList.add('active');
          updateModalBalances();
        });
      }
    });

    const viewPendingDetailsBtn = document.getElementById('viewPendingWithdrawalDetailsBtn');
    if (viewPendingDetailsBtn) {
      viewPendingDetailsBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        const pendingTx = state.transactions.find(t => t.type === 'outflow' && t.status === 'Pending') ||
                          state.pendingWithdrawal;
        if (pendingTx) {
          showTransactionDetails(pendingTx);
        }
      });
    }

    [closeSendBtn, cancelSendBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          AudioEngine.playClick();
          if (transferModal) transferModal.classList.remove('active');
        });
      }
    });

    // Deposit Modal Triggers
    const openDepositBtn = document.getElementById('openDepositModalBtn');
    const cardDepositBtn = document.getElementById('cardDepositActionBtn');
    const depositModal = document.getElementById('depositModalOverlay');
    const closeDepositBtn = document.getElementById('closeDepositModalBtn');
    const cancelDepositBtn = document.getElementById('cancelDepositBtn');

    [openDepositBtn, cardDepositBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          AudioEngine.playError();
          showToast('Deposit Restricted: User self-deposits are not permitted. Account balance is exclusively provisioned by the Bank Compliance Department.', 'error', 6000);
        });
      }
    });

    [closeDepositBtn, cancelDepositBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          AudioEngine.playClick();
          if (depositModal) depositModal.classList.remove('active');
        });
      }
    });

    // Quick Send Custom Beneficiary Button
    const quickSendCustomBtn = document.getElementById('quickSendCustomBtn');
    if (quickSendCustomBtn) {
      quickSendCustomBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        const payeeName = prompt('Enter new Payee Full Name:');
        if (payeeName && payeeName.trim()) {
          const initials = payeeName.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'VIP';
          const newPayee = {
            id: 'p_' + Date.now(),
            name: payeeName.trim(),
            bank: 'Private Client Correspondent',
            account: '84920' + Math.floor(1000 + Math.random() * 9000),
            routing: '021000089',
            avatar: initials
          };
          state.payees.push(newPayee);
          saveState();
          renderPayees();
          showToast(`Payee "${newPayee.name}" added to one-click wire favorites.`, 'success');
          openTransferModalWithPayee(newPayee);
        }
      });
    }

    // Transfer Amount Input dynamic preview
    const amountInput = document.getElementById('transferAmountInput');
    if (amountInput) {
      amountInput.addEventListener('input', updateTransferPreview);
    }

    // Amount chips
    document.querySelectorAll('.amount-chip[data-add]').forEach(chip => {
      chip.addEventListener('click', () => {
        AudioEngine.playClick();
        const addVal = parseFloat(chip.getAttribute('data-add')) || 0;
        const currentVal = parseFloat(amountInput.value) || 0;
        amountInput.value = (currentVal + addVal).toFixed(2);
        updateTransferPreview();
      });
    });

    const maxAmountBtn = document.getElementById('maxAmountBtn');
    if (maxAmountBtn && amountInput) {
      maxAmountBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        amountInput.value = state.checkingBalance.toFixed(2);
        updateTransferPreview();
      });
    }

    // Deposit Preset Chips
    document.querySelectorAll('.deposit-chip[data-dep]').forEach(chip => {
      chip.addEventListener('click', () => {
        AudioEngine.playClick();
        const depInput = document.getElementById('depositAmountInput');
        if (depInput) {
          const addVal = parseFloat(chip.getAttribute('data-dep')) || 0;
          const curVal = parseFloat(depInput.value) || 0;
          depInput.value = (curVal + addVal).toFixed(2);
        }
      });
    });

    // Form Submissions
    const transferForm = document.getElementById('transferForm');
    if (transferForm) {
      transferForm.addEventListener('submit', handleTransferSubmit);
    }

    const depositForm = document.getElementById('depositForm');
    if (depositForm) {
      depositForm.addEventListener('submit', handleDepositSubmit);
    }

    // Transfer Complete Modal Actions
    const transferCompleteModal = document.getElementById('transferCompleteModalOverlay');
    const returnDashboardBtn = document.getElementById('returnDashboardBtn');
    const sendAnotherBtn = document.getElementById('sendAnotherTransferBtn');
    const printReceiptBtn = document.getElementById('printReceiptBtn');

    if (returnDashboardBtn) {
      returnDashboardBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        if (transferCompleteModal) transferCompleteModal.classList.remove('active');
      });
    }

    if (sendAnotherBtn) {
      sendAnotherBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        if (transferCompleteModal) transferCompleteModal.classList.remove('active');
        if (transferModal) {
          transferModal.classList.add('active');
          if (amountInput) amountInput.value = '';
          updateTransferPreview();
        }
      });
    }

    if (printReceiptBtn) {
      printReceiptBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        window.print();
      });
    }

    // Card Controls: Freeze, Reveal CVV, Copy Number
    const freezeBtn = document.getElementById('toggleFreezeCardBtn');
    const secondaryFreezeBtn = document.getElementById('secondaryFreezeBtn');
    [freezeBtn, secondaryFreezeBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          state.isCardFrozen = !state.isCardFrozen;
          AudioEngine.playClick();
          saveState();
          renderCardStatus();
          showToast(state.isCardFrozen ? 'Titanium Card has been frozen.' : 'Titanium Card is active.', state.isCardFrozen ? 'error' : 'success');
        });
      }
    });

    const revealCvvBtn = document.getElementById('revealCvvBtn');
    const cvvEl = document.getElementById('cardCvvVal');
    let isCvvRevealed = false;
    if (revealCvvBtn && cvvEl) {
      revealCvvBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        isCvvRevealed = !isCvvRevealed;
        cvvEl.textContent = isCvvRevealed ? '739' : '•••';
        revealCvvBtn.querySelector('span').textContent = isCvvRevealed ? 'Hide CVV' : 'Reveal CVV';
      });
    }

    const copyCardBtn = document.getElementById('copyCardNumBtn');
    if (copyCardBtn) {
      copyCardBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        navigator.clipboard.writeText('4920881239047721').then(() => {
          showToast('Card number (4920 8812 3904 7721) copied to clipboard.', 'success');
        }).catch(() => {
          showToast('Card number: 4920 8812 3904 7721', 'info');
        });
      });
    }

    // View Statement action
    const viewStatementBtn = document.getElementById('viewStatementBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (viewStatementBtn) {
      viewStatementBtn.addEventListener('click', () => {
        // Switch to transactions tab
        document.querySelector('[data-tab="transactions"]').click();
      });
    }

    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', exportTransactionsCsv);
    }

    // View All Tx button from dashboard
    const viewAllTxBtn = document.getElementById('viewAllTxBtn');
    if (viewAllTxBtn) {
      viewAllTxBtn.addEventListener('click', () => {
        document.querySelector('[data-tab="transactions"]').click();
      });
    }

    // Dashboard transaction filters
    const txFilterPills = document.querySelectorAll('#txFilterGroup .filter-pill');
    txFilterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        AudioEngine.playClick();
        txFilterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const filter = pill.getAttribute('data-filter');
        renderTransactions(filter);
      });
    });

    // Full Transactions table filters
    const fullFilterPills = document.querySelectorAll('#fullTxFilterGroup .filter-pill');
    fullFilterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        AudioEngine.playClick();
        fullFilterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const filter = pill.getAttribute('data-filter');
        const searchVal = document.getElementById('fullTxSearchInput').value;
        renderTransactions(filter, searchVal);
      });
    });

    // Search inputs
    const globalSearch = document.getElementById('globalSearchInput');
    if (globalSearch) {
      globalSearch.addEventListener('input', (e) => {
        renderTransactions('all', e.target.value);
      });
    }

    const fullSearch = document.getElementById('fullTxSearchInput');
    if (fullSearch) {
      fullSearch.addEventListener('input', (e) => {
        const activeFilter = document.querySelector('#fullTxFilterGroup .filter-pill.active').getAttribute('data-filter');
        renderTransactions(activeFilter, e.target.value);
      });
    }

    // Close modals on overlay backdrop click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    // Setup 6 New Sections
    setupInvestments();
    setupLoans();
    setupBillPay();
    setupCrypto();
    setupConcierge();
    setupSecurity();
    setupDashboardEnhancements();
  }

  // =========================================================================
  // 1. INVESTMENTS HANDLER
  // =========================================================================
  function setupInvestments() {
    let orderType = 'BUY';
    const buyBtn = document.getElementById('tradeBuyBtn');
    const sellBtn = document.getElementById('tradeSellBtn');
    const label = document.getElementById('tradeBtnLabel');
    const amtInput = document.getElementById('tradeAmountInput');
    const form = document.getElementById('tradeForm');
    const select = document.getElementById('tradeAssetSelect');

    function updateLabel() {
      const val = parseFloat(amtInput.value) || 0;
      if (label) label.textContent = `Execute ${orderType} Order (${formatCurrency(val)})`;
    }

    if (buyBtn && sellBtn) {
      buyBtn.addEventListener('click', () => {
        orderType = 'BUY';
        buyBtn.className = 'btn btn-primary btn-sm w-full';
        sellBtn.className = 'btn btn-secondary btn-sm w-full';
        updateLabel();
      });
      sellBtn.addEventListener('click', () => {
        orderType = 'SELL';
        sellBtn.className = 'btn btn-primary btn-sm w-full';
        buyBtn.className = 'btn btn-secondary btn-sm w-full';
        updateLabel();
      });
    }

    if (amtInput) {
      amtInput.addEventListener('input', updateLabel);
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const amt = parseFloat(amtInput.value) || 0;
        const asset = select ? select.value : 'Security';

        if (amt <= 0) {
          showToast('Please enter a valid investment amount.', 'error');
          return;
        }

        if (orderType === 'BUY') {
          if (amt > state.checkingBalance) {
            showToast(`Order failed: Insufficient liquid balance (${formatCurrency(state.checkingBalance)} available).`, 'error');
            AudioEngine.playError();
            return;
          }
          state.checkingBalance -= amt;
          state.totalBalance -= amt;

          state.transactions.unshift({
            id: generateTxId(),
            type: 'outflow',
            title: `Market Buy: ${asset}`,
            category: 'Capital Markets',
            method: 'Direct Exchange Settlement',
            date: 'Just now',
            rawDate: new Date().toISOString(),
            amount: amt,
            status: 'Settled',
            note: `Equity order for ${asset} @ Market Price`
          });

          AudioEngine.playSuccessChord();
          showToast(`Purchased ${formatCurrency(amt)} of ${asset}. Portfolio updated.`, 'success');
        } else {
          state.checkingBalance += amt;
          state.totalBalance += amt;

          state.transactions.unshift({
            id: generateTxId(),
            type: 'inflow',
            title: `Market Liquidation: ${asset}`,
            category: 'Capital Markets',
            method: 'Direct Exchange Settlement',
            date: 'Just now',
            rawDate: new Date().toISOString(),
            amount: amt,
            status: 'Settled',
            note: `Sold shares of ${asset} to liquid checking`
          });

          AudioEngine.playCashDeposit();
          showToast(`Sold ${formatCurrency(amt)} of ${asset}. Cash credited to checking.`, 'success');
        }

        saveState();
        updateUI();
      });
    }
  }

  // =========================================================================
  // 2. LOMBARD LOANS & CREDIT FACILITY HANDLER
  // =========================================================================
  function setupLoans() {
    const range = document.getElementById('loanDrawdownRange');
    const amtLabel = document.getElementById('drawdownAmountLabel');
    const interestLabel = document.getElementById('monthlyInterestLabel');
    const btnText = document.getElementById('drawdownBtnText');
    const executeBtn = document.getElementById('executeLoanDrawBtn');
    const repayBtn = document.getElementById('repayLoanBtn');

    let borrowedCredit = 350000;
    const totalFacility = 2500000;

    function updateLoanLabels() {
      if (!range) return;
      const val = parseFloat(range.value);
      if (amtLabel) amtLabel.textContent = formatCurrency(val);
      const monthlyInt = (val * 0.0385) / 12;
      if (interestLabel) interestLabel.textContent = `${formatCurrency(monthlyInt)} / mo`;
      if (btnText) btnText.textContent = `Deposit ${formatCurrency(val)} into Checking Now`;
    }

    if (range) {
      range.addEventListener('input', updateLoanLabels);
      updateLoanLabels();
    }

    if (executeBtn) {
      executeBtn.addEventListener('click', () => {
        const val = parseFloat(range.value) || 50000;
        state.checkingBalance += val;
        state.totalBalance += val;
        borrowedCredit += val;

        const borrowedEl = document.getElementById('creditBorrowedDisplay');
        const availEl = document.getElementById('creditAvailableDisplay');
        if (borrowedEl) borrowedEl.textContent = formatCurrency(borrowedCredit);
        if (availEl) availEl.textContent = formatCurrency(Math.max(0, totalFacility - borrowedCredit));

        state.transactions.unshift({
          id: generateTxId(),
          type: 'inflow',
          title: 'Lombard Facility Cash Drawdown',
          category: 'Revolving Credit Facility',
          method: 'SOFR Credit Advance',
          date: 'Just now',
          rawDate: new Date().toISOString(),
          amount: val,
          status: 'Settled',
          note: 'Immediate liquidity draw credited to checking'
        });

        AudioEngine.playCashDeposit();
        ConfettiEngine.burst();
        showToast(`Credit Drawdown Approved: +${formatCurrency(val)} added to checking balance!`, 'success');
        saveState();
        updateUI();
      });
    }

    if (repayBtn) {
      repayBtn.addEventListener('click', () => {
        const repayAmt = 25000;
        if (state.checkingBalance < repayAmt) {
          showToast('Insufficient funds in checking to repay loan.', 'error');
          AudioEngine.playError();
          return;
        }

        state.checkingBalance -= repayAmt;
        state.totalBalance -= repayAmt;
        borrowedCredit = Math.max(0, borrowedCredit - repayAmt);

        const borrowedEl = document.getElementById('creditBorrowedDisplay');
        const availEl = document.getElementById('creditAvailableDisplay');
        if (borrowedEl) borrowedEl.textContent = formatCurrency(borrowedCredit);
        if (availEl) availEl.textContent = formatCurrency(totalFacility - borrowedCredit);

        state.transactions.unshift({
          id: generateTxId(),
          type: 'outflow',
          title: 'Lombard Facility Principal Repayment',
          category: 'Loan Principal Reduction',
          method: 'Internal Treasury Settlement',
          date: 'Just now',
          rawDate: new Date().toISOString(),
          amount: repayAmt,
          status: 'Completed',
          note: 'Repayment of active Lombard debt'
        });

        AudioEngine.playClick();
        showToast(`Repaid ${formatCurrency(repayAmt)} loan principal. Outstanding debt reduced.`, 'success');
        saveState();
        updateUI();
      });
    }
  }

  // =========================================================================
  // 3. BILL PAY & SCHEDULED AUTOPAY HANDLER
  // =========================================================================
  function setupBillPay() {
    function attachPayButtons() {
      document.querySelectorAll('.bill-pay-now-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const biller = btn.getAttribute('data-biller') || 'Payee';
          const amount = parseFloat(btn.getAttribute('data-amount')) || 0;

          if (state.checkingBalance < amount) {
            showToast(`Cannot pay ${biller}: Insufficient balance.`, 'error');
            AudioEngine.playError();
            return;
          }

          state.checkingBalance -= amount;
          state.totalBalance -= amount;

          state.transactions.unshift({
            id: generateTxId(),
            type: 'outflow',
            title: `Scheduled Bill: ${biller}`,
            category: 'Recurring Wire Payment',
            method: 'Automated Fedwire Clearing',
            date: 'Just now',
            rawDate: new Date().toISOString(),
            amount: amount,
            status: 'Completed',
            note: 'Verified recurring schedule payment'
          });

          btn.outerHTML = '<span class="badge-status-green" style="font-size: 0.72rem;">Paid & Cleared</span>';
          AudioEngine.playSuccessChord();
          showToast(`Settled ${formatCurrency(amount)} payment to ${biller}.`, 'success');
          saveState();
          updateUI();
        });
      });
    }

    attachPayButtons();

    const addBillBtn = document.getElementById('addNewBillBtn');
    if (addBillBtn) {
      addBillBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        const billerName = prompt('Enter Payee / Organization Name:');
        if (!billerName || !billerName.trim()) return;

        const amtStr = prompt('Enter Monthly Scheduled Amount (USD):', '5000');
        const amt = parseFloat(amtStr) || 5000;

        const tbody = document.getElementById('billpayTableBody');
        if (tbody) {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <div style="font-weight: 700; color: #fff;">${billerName.trim()}</div>
              <div style="font-size: 0.72rem; color: var(--text-dim);">Custom Scheduled Wire • Apex Private</div>
            </td>
            <td>Private Wealth Retainer</td>
            <td>Nov 1, 2026</td>
            <td>Monthly</td>
            <td><span class="badge-status-green">Autopay Active</span></td>
            <td class="text-right font-mono" style="font-weight: 700; color: #fff;">${formatCurrency(amt)}</td>
            <td class="text-right">
              <button class="btn btn-secondary btn-sm bill-pay-now-btn" data-biller="${billerName.trim()}" data-amount="${amt}">Pay Now</button>
            </td>
          `;
          tbody.appendChild(tr);
          attachPayButtons();
          showToast(`Scheduled autopay for "${billerName.trim()}" registered successfully.`, 'success');
        }
      });
    }
  }

  // =========================================================================
  // 4. CRYPTO & DIGITAL ASSETS OTC SWAP HANDLER
  // =========================================================================
  function setupCrypto() {
    const select = document.getElementById('swapAssetSelect');
    const qtyInput = document.getElementById('swapQuantityInput');
    const grossEl = document.getElementById('swapGrossUsd');
    const netEl = document.getElementById('swapNetUsd');
    const form = document.getElementById('cryptoSwapForm');

    function calculateSwap() {
      if (!select || !qtyInput) return;
      const opt = select.options[select.selectedIndex];
      const rate = parseFloat(opt.getAttribute('data-rate')) || 62500;
      const qty = parseFloat(qtyInput.value) || 0;
      const total = qty * rate;

      if (grossEl) grossEl.textContent = formatCurrency(total);
      if (netEl) netEl.textContent = `+${formatCurrency(total)}`;
    }

    if (select) select.addEventListener('change', calculateSwap);
    if (qtyInput) qtyInput.addEventListener('input', calculateSwap);

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const opt = select.options[select.selectedIndex];
        const rate = parseFloat(opt.getAttribute('data-rate')) || 62500;
        const qty = parseFloat(qtyInput.value) || 0;
        const total = qty * rate;

        if (total <= 0) {
          showToast('Invalid crypto swap quantity.', 'error');
          return;
        }

        state.checkingBalance += total;
        state.totalBalance += total;

        state.transactions.unshift({
          id: generateTxId(),
          type: 'inflow',
          title: `Crypto OTC Swap: ${qty} ${select.value}`,
          category: 'Digital Asset Custody',
          method: 'Institutional OTC Liquidation',
          date: 'Just now',
          rawDate: new Date().toISOString(),
          amount: total,
          status: 'Settled',
          note: `Swapped from Zurich cold vault to checking @ $${rate}/unit`
        });

        AudioEngine.playCashDeposit();
        ConfettiEngine.burst();
        showToast(`OTC Swap Executed: +${formatCurrency(total)} credited to checking account!`, 'success');
        saveState();
        updateUI();
      });
    }
  }

  // =========================================================================
  // 5. VIP CONCIERGE CHAT HANDLER
  // =========================================================================
  function setupConcierge() {
    const chatStream = document.getElementById('conciergeChatStream');
    const form = document.getElementById('conciergeChatForm');
    const input = document.getElementById('conciergeChatInput');

    function appendMsg(sender, text, isUser = false) {
      if (!chatStream) return;
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const wrap = document.createElement('div');
      wrap.className = `chat-msg ${isUser ? 'msg-user' : 'msg-banker'}`;
      wrap.innerHTML = `
        <div class="msg-author">${sender} • ${timeStr}</div>
        <div class="msg-bubble">${text}</div>
      `;
      chatStream.appendChild(wrap);
      chatStream.scrollTop = chatStream.scrollHeight;
    }

    function handleUserInput(promptText) {
      const q = promptText.trim();
      if (!q) return;

      appendMsg('Alexander Reed', q, true);
      AudioEngine.playClick();

      // Simulate Charlotte's intelligent concierge response
      setTimeout(() => {
        const lower = q.toLowerCase();
        let reply = "I am on it immediately, Alexander. I will have our Zurich wealth desk confirm the execution shortly.";

        if (lower.includes('limit') || lower.includes('increase')) {
          reply = "I have filed an executive wire limit override with the Federal Reserve correspondent desk. Your single-day clearance limit is now authorized for up to <strong>$5,000,000.00</strong>.";
        } else if (lower.includes('check') || lower.includes('cashier')) {
          reply = "Your <strong>$150,000.00 Certified Cashier's Check</strong> (Reference #APX-9941) has been printed on security bond paper and handed to armored diplomatic courier service.";
        } else if (lower.includes('vault') || lower.includes('visit') || lower.includes('gold')) {
          reply = "Your private appointment for the Zurich Paradeplatz Freezone Gold Vault has been confirmed for tomorrow at 10:00 AM CET. Your biometric credential is pre-cleared.";
        } else if (lower.includes('card') || lower.includes('titanium')) {
          reply = "A brand-new replacement Obsidian Black Titanium card has been minted and dispatched via priority courier.";
        } else if (lower.includes('wire') || lower.includes('send') || lower.includes('transfer') || lower.includes('withdraw')) {
          reply = "Understood. The Fedwire RTGS line is open and ready. You can initiate withdrawals directly via the Withdraw Funds terminal anytime.";
        }

        appendMsg('Charlotte Sinclair (Senior Director)', reply, false);
        AudioEngine.playSuccessChord();
      }, 700);
    }

    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = input.value;
        input.value = '';
        handleUserInput(val);
      });
    }

    // Prompt pills
    document.querySelectorAll('.chat-chip[data-prompt]').forEach(chip => {
      chip.addEventListener('click', () => {
        const p = chip.getAttribute('data-prompt');
        handleUserInput(p);
      });
    });

    // Concierge action buttons
    const cashierBtn = document.getElementById('requestCashierCheckBtn');
    if (cashierBtn) {
      cashierBtn.addEventListener('click', () => {
        handleUserInput('Please issue a $150,000 Certified Cashier Check for real estate closing.');
      });
    }

    const vaultBtn = document.getElementById('bookVaultVisitBtn');
    if (vaultBtn) {
      vaultBtn.addEventListener('click', () => {
        handleUserInput('Schedule an in-person audit at the Zurich Gold Bullion Vault.');
      });
    }
  }

  // =========================================================================
  // 6. SECURITY & FINANCIAL CONTROLS HANDLER
  // =========================================================================
  function setupSecurity() {
    const range = document.getElementById('dailyLimitRangeInput');
    const label = document.getElementById('dailyLimitValLabel');
    const saveBtn = document.getElementById('saveDailyLimitBtn');
    const lockdownBtn = document.getElementById('emergencyLockdownBtn');

    if (range && label) {
      range.addEventListener('input', () => {
        label.textContent = formatCurrency(parseFloat(range.value));
      });
    }

    if (saveBtn && range) {
      saveBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        showToast(`Daily wire limit preference saved: ${formatCurrency(parseFloat(range.value))}`, 'success');
      });
    }

    let isLocked = false;
    if (lockdownBtn) {
      lockdownBtn.addEventListener('click', () => {
        isLocked = !isLocked;
        if (isLocked) {
          state.isCardFrozen = true;
          renderCardStatus();
          lockdownBtn.style.background = 'rgba(244, 63, 94, 0.2)';
          lockdownBtn.querySelector('span').textContent = 'Account Lockdown Active (Click to Release)';
          AudioEngine.playError();
          showToast('EMERGENCY LOCKDOWN ACTIVATED: All cards frozen, wire transfers halted.', 'error');
        } else {
          state.isCardFrozen = false;
          renderCardStatus();
          lockdownBtn.style.background = 'transparent';
          lockdownBtn.querySelector('span').textContent = 'Initiate Lockdown';
          AudioEngine.playSuccessChord();
          showToast('Lockdown lifted: Normal banking operations restored.', 'success');
        }
      });
    }
  }

  // =========================================================================
  // 7. DASHBOARD ENHANCEMENTS: FX DESK, GOALS, ROUTING, WIRE REQUESTS
  // =========================================================================
  function setupDashboardEnhancements() {
    // A. Executive Command Shortcuts
    const reqBtn = document.getElementById('cmdRequestFundsBtn');
    const reqModal = document.getElementById('requestFundsModalOverlay');
    const closeReqBtn = document.getElementById('closeRequestModalBtn');
    const cancelReqBtn = document.getElementById('cancelRequestBtn');
    const reqForm = document.getElementById('requestFundsForm');

    if (reqBtn && reqModal) {
      reqBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        reqModal.classList.add('active');
      });
    }

    [closeReqBtn, cancelReqBtn].forEach(b => {
      if (b && reqModal) {
        b.addEventListener('click', () => {
          AudioEngine.playClick();
          reqModal.classList.remove('active');
        });
      }
    });

    if (reqForm) {
      reqForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const payer = document.getElementById('requestPayerInput').value.trim();
        const amt = parseFloat(document.getElementById('requestAmountInput').value) || 0;
        const memo = document.getElementById('requestMemoInput').value.trim() || 'Fedwire Transfer';

        const wireSheet = `APEX RESERVE BANK WIRE REMITTANCE
Beneficiary: Alexander Reed
Account: 89204109402
ABA Routing: 021000089
SWIFT: APEXUS33NYC
Payer: ${payer}
Requested Amount: ${formatCurrency(amt)}
Reference: ${memo}`;

        navigator.clipboard.writeText(wireSheet).then(() => {
          showToast(`Remittance request for ${formatCurrency(amt)} copied to clipboard!`, 'success');
        }).catch(() => {
          showToast(`Remittance generated for ${payer}.`, 'success');
        });

        AudioEngine.playSuccessChord();
        if (reqModal) reqModal.classList.remove('active');
        reqForm.reset();
      });
    }

    const fxShortcutBtn = document.getElementById('cmdFxSwapBtn');
    if (fxShortcutBtn) {
      fxShortcutBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        const panel = document.getElementById('dashboardFxPanel');
        if (panel) {
          panel.scrollIntoView({ behavior: 'smooth' });
          const amtInput = document.getElementById('fxFromAmount');
          if (amtInput) amtInput.focus();
        }
      });
    }

    const routingShortcutBtn = document.getElementById('cmdViewRoutingBtn');
    if (routingShortcutBtn) {
      routingShortcutBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        const panel = document.getElementById('dashboardRoutingPanel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const goalShortcutBtn = document.getElementById('cmdNewVaultGoalBtn');
    if (goalShortcutBtn) {
      goalShortcutBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        const panel = document.getElementById('dashboardGoalsPanel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const printStmtBtn = document.getElementById('cmdPrintStatementBtn');
    if (printStmtBtn) {
      printStmtBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        window.print();
      });
    }

    // B. FX Swap Desk Calculation & Execution
    const fxRatesToUsd = {
      USD: 1.0,
      EUR: 1.0842,
      GBP: 1.3021,
      CHF: 1.1600
    };

    const fxSymbols = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      CHF: '₣'
    };

    const fromSel = document.getElementById('fxFromSelect');
    const toSel = document.getElementById('fxToSelect');
    const fromAmt = document.getElementById('fxFromAmount');
    const calcResult = document.getElementById('fxCalculatedResult');
    const swapDirBtn = document.getElementById('fxSwapDirectionBtn');
    const fxForm = document.getElementById('dashFxSwapForm');

    function calculateDashFx() {
      if (!fromSel || !toSel || !fromAmt || !calcResult) return;
      const fromCurr = fromSel.value;
      const toCurr = toSel.value;
      const sendVal = parseFloat(fromAmt.value) || 0;

      // Convert to USD base first, then to target
      const inUsd = sendVal * fxRatesToUsd[fromCurr];
      const targetVal = inUsd / fxRatesToUsd[toCurr];
      const sym = fxSymbols[toCurr] || '';

      calcResult.textContent = `≈ ${sym}${targetVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${toCurr}`;
    }

    if (fromSel) fromSel.addEventListener('change', calculateDashFx);
    if (toSel) toSel.addEventListener('change', calculateDashFx);
    if (fromAmt) fromAmt.addEventListener('input', calculateDashFx);

    if (swapDirBtn && fromSel && toSel) {
      swapDirBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        const temp = fromSel.value;
        fromSel.value = toSel.value;
        toSel.value = temp;
        calculateDashFx();
      });
    }

    if (fxForm) {
      fxForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fromCurr = fromSel.value;
        const toCurr = toSel.value;
        const sendVal = parseFloat(fromAmt.value) || 0;

        if (sendVal <= 0) {
          showToast('Please enter a valid conversion amount.', 'error');
          return;
        }

        const inUsd = sendVal * fxRatesToUsd[fromCurr];
        const targetVal = inUsd / fxRatesToUsd[toCurr];

        if (fromCurr === 'USD') {
          if (sendVal > state.checkingBalance) {
            showToast(`Conversion failed: Insufficient USD checking balance (${formatCurrency(state.checkingBalance)} available).`, 'error');
            AudioEngine.playError();
            return;
          }
          state.checkingBalance -= sendVal;
          state.totalBalance -= sendVal;

          state.transactions.unshift({
            id: generateTxId(),
            type: 'outflow',
            title: `FX Swap: USD to ${toCurr}`,
            category: 'Offshore Treasury',
            method: 'Interbank FX Settlement',
            date: 'Just now',
            rawDate: new Date().toISOString(),
            amount: sendVal,
            status: 'Settled',
            note: `Converted $${sendVal.toLocaleString()} USD to ${fxSymbols[toCurr]}${targetVal.toLocaleString()} ${toCurr}`
          });

          AudioEngine.playSuccessChord();
          ConfettiEngine.burst();
          showToast(`FX Complete: Converted $${sendVal.toLocaleString()} USD to ${fxSymbols[toCurr]}${targetVal.toFixed(2)} ${toCurr}.`, 'success');
        } else {
          // Converting from Foreign Currency into USD
          state.checkingBalance += targetVal;
          state.totalBalance += targetVal;

          state.transactions.unshift({
            id: generateTxId(),
            type: 'inflow',
            title: `FX Repatriation: ${fromCurr} to USD`,
            category: 'Offshore Treasury',
            method: 'Interbank FX Settlement',
            date: 'Just now',
            rawDate: new Date().toISOString(),
            amount: targetVal,
            status: 'Settled',
            note: `Converted ${fxSymbols[fromCurr]}${sendVal.toLocaleString()} ${fromCurr} into USD liquid checking`
          });

          AudioEngine.playCashDeposit();
          ConfettiEngine.burst();
          showToast(`FX Complete: +${formatCurrency(targetVal)} credited to USD Checking Account!`, 'success');
        }

        saveState();
        updateUI();
      });
    }

    calculateDashFx();

    // C. Treasury Goals Allocation
    document.querySelectorAll('.goal-allocate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const goalName = btn.getAttribute('data-goal') || 'Goal';
        const amt = parseFloat(btn.getAttribute('data-amount')) || 5000;
        const targetKey = btn.getAttribute('data-target');

        if (state.checkingBalance < amt) {
          showToast(`Insufficient balance to allocate ${formatCurrency(amt)} to ${goalName}.`, 'error');
          AudioEngine.playError();
          return;
        }

        state.checkingBalance -= amt;
        state.totalBalance -= amt;

        state.transactions.unshift({
          id: generateTxId(),
          type: 'outflow',
          title: `Treasury Vault Allocation: ${goalName}`,
          category: 'Asset Allocation',
          method: 'Internal Vault Clearing',
          date: 'Just now',
          rawDate: new Date().toISOString(),
          amount: amt,
          status: 'Completed',
          note: `Dedicated capital transfer to ${goalName}`
        });

        // Update target visual
        if (targetKey) {
          const amtEl = document.getElementById(`${targetKey}Amount`);
          const barEl = document.getElementById(`${targetKey}Bar`);
          if (amtEl) {
            const current = parseFloat(amtEl.textContent.replace(/[^0-9.-]+/g, '')) || 0;
            const updated = current + amt;
            amtEl.textContent = formatCurrency(updated);
            if (barEl) {
              const currentW = parseFloat(barEl.style.width) || 75;
              barEl.style.width = `${Math.min(100, currentW + 2)}%`;
            }
          }
        }

        AudioEngine.playSuccessChord();
        ConfettiEngine.burst();
        showToast(`Allocated ${formatCurrency(amt)} to ${goalName}. Vault balance updated!`, 'success');
        saveState();
        updateUI();
      });
    });

    const createGoalBtn = document.getElementById('createCustomGoalBtn');
    if (createGoalBtn) {
      createGoalBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        const goalTitle = prompt('Enter New Treasury Target / Asset Name:', 'Monaco Marina Berth Berthage');
        if (!goalTitle || !goalTitle.trim()) return;

        const targetAmtStr = prompt('Enter Target Cap (USD):', '300000');
        const targetAmt = parseFloat(targetAmtStr) || 300000;

        const grid = document.getElementById('treasuryGoalsGrid');
        if (grid) {
          const card = document.createElement('div');
          card.className = 'glass-panel vault-card';
          card.style.background = 'rgba(255,255,255,0.03)';
          const uniqueId = 'goal_custom_' + Date.now();
          card.innerHTML = `
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
              <div class="vault-icon-circle emerald" style="width: 40px; height: 40px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              </div>
              <span class="tier-pill" style="font-size: 0.68rem;">Active Vault</span>
            </div>
            <span class="vault-label" style="font-weight: 700; color: #fff; font-size: 0.95rem;">${goalTitle.trim()}</span>
            <h3 class="vault-amount" id="${uniqueId}Amount">$0.00</h3>
            <p class="vault-sub">Target: ${formatCurrency(targetAmt)} • Private Allocation</p>
            <div class="tier-progress-bg" style="width: 100%; height: 6px; margin: 6px 0;">
              <div class="tier-progress-fill" id="${uniqueId}Bar" style="width: 5%;"></div>
            </div>
            <button class="btn btn-secondary btn-sm w-full goal-allocate-btn" data-goal="${goalTitle.trim()}" data-amount="10000" data-target="${uniqueId}">
              Allocate +$10,000 to Vault
            </button>
          `;
          grid.appendChild(card);
          showToast(`Custom Treasury Vault "${goalTitle.trim()}" initialized.`, 'success');
        }
      });
    }

    // D. 1-Click Copy Credential Buttons
    document.querySelectorAll('.copy-field-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const textToCopy = btn.getAttribute('data-copy');
        if (!textToCopy) return;

        navigator.clipboard.writeText(textToCopy).then(() => {
          const original = btn.textContent;
          btn.textContent = 'Copied!';
          btn.style.color = '#34D399';
          setTimeout(() => {
            btn.textContent = original;
            btn.style.color = '';
          }, 1400);
          showToast(`Copied to clipboard: ${textToCopy}`, 'success');
        }).catch(() => {
          showToast(`Credentials: ${textToCopy}`, 'info');
        });

        AudioEngine.playClick();
      });
    });

    // Admin Dashboard triggers
    const topbarAdminBtn = document.getElementById('topbarAdminBtn');
    if (topbarAdminBtn) {
      topbarAdminBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        openAdminAuthModal(() => {
          window.location.href = 'admin.html';
        });
      });
    }

    const adminReturnBtn = document.getElementById('adminReturnToUserBtn');
    if (adminReturnBtn) {
      adminReturnBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        switchTab('dashboard');
      });
    }


    // Admin Filters & Search
    const filterAllBtn = document.getElementById('adminFilterAllBtn');
    const filterPendingBtn = document.getElementById('adminFilterPendingBtn');
    const filterApprovedBtn = document.getElementById('adminFilterApprovedBtn');

    [filterAllBtn, filterPendingBtn, filterApprovedBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          [filterAllBtn, filterPendingBtn, filterApprovedBtn].forEach(b => b && b.classList.remove('active'));
          btn.classList.add('active');
          adminFilter = btn.getAttribute('data-filter') || 'all';
          AudioEngine.playClick();
          renderAdminDashboard();
        });
      }
    });

    const adminSearchInput = document.getElementById('adminSearchInput');
    if (adminSearchInput) {
      adminSearchInput.addEventListener('input', (e) => {
        adminSearchQuery = e.target.value.trim();
        renderAdminDashboard();
      });
    }

    // Create Account Modal Triggers
    const createModal = document.getElementById('createAccountModalOverlay');
    const openCreateBtn = document.getElementById('topbarCreateAccountBtn');
    const closeCreateBtn = document.getElementById('closeCreateAccountModalBtn');
    const cancelCreateBtn = document.getElementById('cancelCreateAccountBtn');
    const createForm = document.getElementById('createAccountForm');

    if (openCreateBtn) {
      openCreateBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        if (createModal) createModal.classList.add('active');
      });
    }

    [closeCreateBtn, cancelCreateBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          AudioEngine.playClick();
          if (createModal) createModal.classList.remove('active');
        });
      }
    });

    if (createForm) {
      createForm.addEventListener('submit', handleCreateAccountSubmit);
    }

    // Pending Verification View Triggers
    const checkPendingBtn = document.getElementById('checkPendingStatusBtn');
    const pendingOpenAdminBtn = document.getElementById('pendingOpenAdminBtn');

    if (checkPendingBtn) {
      checkPendingBtn.addEventListener('click', () => {
        checkPendingStatus();
      });
    }

    if (pendingOpenAdminBtn) {
      pendingOpenAdminBtn.addEventListener('click', () => {
        AudioEngine.playClick();
        openAdminAuthModal(() => {
          window.location.href = 'admin.html';
        });
      });
    }

    // Admin Credit Form
    const adminCreditModal = document.getElementById('adminCreditModalOverlay');
    const adminCreditForm = document.getElementById('adminCreditForm');
    const closeAdminCreditBtn = document.getElementById('closeAdminCreditModalBtn');
    const cancelAdminCreditBtn = document.getElementById('cancelAdminCreditBtn');

    [closeAdminCreditBtn, cancelAdminCreditBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          AudioEngine.playClick();
          if (adminCreditModal) adminCreditModal.classList.remove('active');
        });
      }
    });

    if (adminCreditForm) {
      adminCreditForm.addEventListener('submit', handleAdminCreditSubmit);
    }

    // Admin Debit Form
    const adminDebitModal = document.getElementById('adminDebitModalOverlay');
    const adminDebitForm = document.getElementById('adminDebitForm');
    const closeAdminDebitBtn = document.getElementById('closeAdminDebitModalBtn');
    const cancelAdminDebitBtn = document.getElementById('cancelAdminDebitBtn');

    [closeAdminDebitBtn, cancelAdminDebitBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          AudioEngine.playClick();
          if (adminDebitModal) adminDebitModal.classList.remove('active');
        });
      }
    });

    if (adminDebitForm) {
      adminDebitForm.addEventListener('submit', handleAdminDebitSubmit);
    }

    // Admin Accept & Initial Deposit Modal Listeners
    const adminAcceptModal = document.getElementById('adminAcceptModalOverlay');
    const adminAcceptForm = document.getElementById('adminAcceptForm');
    const closeAdminAcceptBtn = document.getElementById('closeAdminAcceptModalBtn');
    const cancelAdminAcceptBtn = document.getElementById('cancelAdminAcceptBtn');

    [closeAdminAcceptBtn, cancelAdminAcceptBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          AudioEngine.playClick();
          if (adminAcceptModal) adminAcceptModal.classList.remove('active');
        });
      }
    });

    if (adminAcceptForm) {
      adminAcceptForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userId = document.getElementById('adminAcceptUserId').value;
        const depositAmount = parseFloat(document.getElementById('adminAcceptDepositAmount').value) || 0;
        const recordName = document.getElementById('adminAcceptRecordName').value.trim() || 'Federal Reserve Wire Deposit';
        const verInput = document.getElementById('adminAcceptVerificationAmount');
        const verAmount = verInput ? (parseFloat(verInput.value) || 2500) : 2500;
        if (adminAcceptModal) adminAcceptModal.classList.remove('active');
        approveAccount(userId, depositAmount, recordName, verAmount);
      });
    }

    // Admin Set Withdrawal Verification Fund Modal Listeners
    const adminSetVerModal = document.getElementById('adminSetVerificationModalOverlay');
    const adminSetVerForm = document.getElementById('adminSetVerificationForm');
    const closeAdminSetVerBtn = document.getElementById('closeAdminSetVerificationModalBtn');
    const cancelAdminSetVerBtn = document.getElementById('cancelAdminSetVerificationBtn');

    [closeAdminSetVerBtn, cancelAdminSetVerBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          AudioEngine.playClick();
          if (adminSetVerModal) adminSetVerModal.classList.remove('active');
        });
      }
    });

    const adminModalCreditClientBtn = document.getElementById('adminModalCreditClientBtn');
    if (adminModalCreditClientBtn) {
      adminModalCreditClientBtn.addEventListener('click', () => {
        const userId = document.getElementById('adminSetVerificationUserId')?.value;
        if (adminSetVerModal) adminSetVerModal.classList.remove('active');
        if (userId) {
          openAdminCreditModal(userId);
        }
      });
    }

    const adminModalDebitClientBtn = document.getElementById('adminModalDebitClientBtn');
    if (adminModalDebitClientBtn) {
      adminModalDebitClientBtn.addEventListener('click', () => {
        const userId = document.getElementById('adminSetVerificationUserId')?.value;
        if (adminSetVerModal) adminSetVerModal.classList.remove('active');
        if (userId) {
          openAdminDebitModal(userId);
        }
      });
    }

    if (adminSetVerForm) {
      adminSetVerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('adminSetVerificationUserId').value;
        const amountInput = document.getElementById('adminVerificationAmountInput');
        const statementInput = document.getElementById('adminWithdrawalStatementInput');
        const newVerAmount = Math.max(0, parseFloat(amountInput.value) || 0);
        const newStatement = (statementInput && statementInput.value.trim()) ? statementInput.value.trim().toUpperCase() : 'PENDING COMPLIANCE VERIFICATION';

        const acc = accounts.find(a => a.id === userId);
        if (acc) {
          acc.verificationWithdrawalAmount = newVerAmount;
          acc.withdrawalStatement = newStatement;
          if (acc.pendingWithdrawal && acc.pendingWithdrawal.status === 'Pending') {
            acc.pendingWithdrawal.requiredVerification = newVerAmount;
            acc.pendingWithdrawal.statement = newStatement;
          }
          saveAccounts();
          if (acc.id === currentUserId) {
            state.verificationWithdrawalAmount = newVerAmount;
            state.withdrawalStatement = newStatement;
            if (state.pendingWithdrawal && state.pendingWithdrawal.status === 'Pending') {
              state.pendingWithdrawal.requiredVerification = newVerAmount;
              state.pendingWithdrawal.statement = newStatement;
            }
            saveState();
          }
        }

        if (adminSetVerModal) adminSetVerModal.classList.remove('active');

        try {
          await fetch(getBackendUrl('/api/admin/set-verification-fund'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              verificationAmount: newVerAmount,
              withdrawalStatement: newStatement
            })
          });
        } catch (err) {
          console.warn('Set verification fund API sync failed:', err);
        }

        AudioEngine.playClick();
        showToast(`Withdrawal policy updated for ${acc ? acc.name : 'client'}: ${formatCurrency(newVerAmount)} • "${newStatement}"`, 'success');
        renderAdminDashboard();
        updateUI();
      });
    }

    // Auto-poll interval for live server updates (withdrawal clearance, policy updates, approvals)
    setInterval(() => {
      syncWithServerDatabase();
    }, 2500);
    // Universal Sign Out handlers
    const allLogoutButtons = document.querySelectorAll('.btn-logout, #adminSignOutBtn, #globalSignOutBtn, #topbarSignOutBtn, #modalSignOutBtn, #navLogoutLink');
    allLogoutButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('APEX_LOGGED_IN_USER');
        localStorage.removeItem('APEX_RESERVE_ACTIVE_USER_ID_V2');
        localStorage.removeItem('APEX_RESERVE_ACTIVE_USER_V2');
        sessionStorage.removeItem('APEX_ADMIN_AUTH');
        AudioEngine.playClick();
        window.location.href = 'login.html#register';
      });
    });

    initAdminSecurityGate();
    setupAdminEmailNotifications();
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    loadState();
    ConfettiEngine.init();
    initCardTilt();
    setupEventListeners();
    initInactivityTimeout();
    updateUI();

    if (window.location.pathname.includes('admin')) {
      initAdminSecurityGate();
      setupAdminEmailNotifications();
      switchTab('admin');
      return;
    }

    if (window.location.hash) {
      const hashTab = window.location.hash.replace('#', '');
      if (document.getElementById(`view-${hashTab}`)) {
        switchTab(hashTab);
        return;
      }
    }

    const u = getCurrentUser();
    if (u && u.status === 'pending') {
      switchTab('pending');
    }
  });

  window.addEventListener('hashchange', () => {
    if (window.location.hash) {
      const hashTab = window.location.hash.replace('#', '');
      if (document.getElementById(`view-${hashTab}`)) {
        switchTab(hashTab);
      }
    }
  });

  // Expose key admin functions to window for admin.html standalone desk
  window.renderAdminDashboard = renderAdminDashboard;
  window.updateBadges = updateBadges;
  window.approveAccount = approveAccount;
  window.rejectAccount = rejectAccount;
  window.syncWithServerDatabase = syncWithServerDatabase;

  window.syncNewApplicant = function(newApplicant, isDirectAccept, depositAmount, recordName) {
    if (!newApplicant) return;
    const normNewUser = (newApplicant.username || '').replace(/^@/, '').toLowerCase();
    const normNewEmail = (newApplicant.email || '').toLowerCase();
    const existingIdx = accounts.findIndex(a =>
      a.id === newApplicant.id ||
      (normNewUser && a.username && a.username.replace(/^@/, '').toLowerCase() === normNewUser) ||
      (normNewEmail && a.email && a.email.toLowerCase() === normNewEmail)
    );

    if (existingIdx !== -1) {
      accounts[existingIdx] = { ...accounts[existingIdx], ...newApplicant };
    } else {
      accounts.unshift(newApplicant);
    }

    saveAccounts();
    if (newApplicant.password) {
      savePermanentCredential(newApplicant, newApplicant.password);
    }

    if (isDirectAccept && typeof approveAccount === 'function') {
      approveAccount(newApplicant.id, depositAmount || 0, recordName || 'Federal Reserve Wire Deposit');
    } else {
      renderAdminDashboard();
      updateBadges();
    }
  };

  // Automated live polling on Admin Dashboard so new applicants appear in real-time
  if (typeof window !== 'undefined' && window.location.pathname.includes('admin')) {
    setInterval(() => {
      try {
        syncWithServerDatabase();
      } catch (ePoll) {}
    }, 3500);
  }

})();
