/**
 * APEX RESERVE PRIVATE BANKING APPLICATION
 * Digital Wealth Management, Real-Time Fedwire Settlement Engine & Dynamic Ledger
 */

(function () {
  'use strict';

  // =========================================================================
  // DEFAULT CONFIGURATION & STATE
  // =========================================================================
  const INITIAL_CHECKING_BALANCE = 420000.00;
  const INITIAL_SAVINGS_BALANCE = 80000.00;
  const INITIAL_TOTAL_BALANCE = 500000.00; // $500,000 balance requested

  const STORAGE_KEY = 'APEX_RESERVE_STATE_V2';

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
    lastReceipt: null
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
  // PERSISTENCE & LOCALSTORAGE HELPERS
  // =========================================================================
  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        state = Object.assign(state, parsed);
      }
    } catch (e) {
      console.warn('Could not read state from localStorage:', e);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save state to localStorage:', e);
    }
  }

  function resetToInitialDemoState() {
    state.totalBalance = INITIAL_TOTAL_BALANCE;
    state.checkingBalance = INITIAL_CHECKING_BALANCE;
    state.savingsBalance = INITIAL_SAVINGS_BALANCE;
    state.transactions = INITIAL_TRANSACTIONS.slice();
    state.payees = INITIAL_PAYEES.slice();
    state.isCardFrozen = false;
    saveState();
    updateUI();
    showToast('Demo balance restored to $500,000.00', 'info');
    AudioEngine.playCashDeposit();
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
    renderBalances();
    renderTransactions();
    renderPayees();
    renderCardStatus();
    updateModalBalances();
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
              <span class="tx-status-badge">${tx.status}</span>
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
          const sign = isOut ? '-' : '+';
          const colorClass = isOut ? '' : 'text-emerald';

          tr.innerHTML = `
            <td>
              <span class="badge-instant" style="background: ${isOut ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)'}; color: ${isOut ? '#F43F5E' : '#34D399'}; border-color: ${isOut ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)'}">
                ${isOut ? 'Wire Out' : 'Wire In'}
              </span>
            </td>
            <td><strong style="color: #fff">${tx.title}</strong><div style="font-size: 0.72rem; color: var(--text-dim);">${tx.note || 'Settlement'}</div></td>
            <td class="font-mono">${tx.id}</td>
            <td>${tx.method}</td>
            <td>${tx.date}</td>
            <td><span class="tx-status-badge">${tx.status}</span></td>
            <td class="text-right font-mono ${colorClass}" style="font-weight: 700;">${sign}${formatCurrency(tx.amount)}</td>
            <td>
              <button class="btn btn-ghost btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" title="View Receipt">
                Receipt
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

    document.getElementById('completeAmountDisplay').textContent = `${tx.type === 'outflow' ? '-' : '+'}${formatCurrency(tx.amount)}`;
    document.getElementById('receiptTxId').textContent = tx.id;
    document.getElementById('receiptTimestamp').textContent = tx.date;
    document.getElementById('receiptRecipient').textContent = tx.title;
    document.getElementById('receiptBank').textContent = tx.category || 'Direct Wire Settlement';
    document.getElementById('receiptAccount').textContent = '•••• 9402';
    document.getElementById('receiptRail').textContent = tx.method;
    document.getElementById('receiptMemo').textContent = tx.note || 'Private Client Transfer';
    document.getElementById('receiptRemainingBalance').textContent = formatCurrency(state.checkingBalance);

    document.querySelector('.success-heading').textContent = 'Transaction Record';
    document.querySelector('.success-subheading').textContent = 'Audited ledger entry from Apex Reserve RTGS archive.';

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
    if (submitBtnText) submitBtnText.textContent = 'Clearing Fedwire RTGS...';
    AudioEngine.playClick();

    setTimeout(() => {
      // Deduct balance
      state.checkingBalance -= transferAmount;
      state.totalBalance -= transferAmount;

      const newTxId = generateTxId();
      const timestamp = getFormattedTimestamp();

      // Mask account for receipt
      const maskedAcc = recipientAccount.length > 4
        ? '•••• ' + recipientAccount.slice(-4)
        : '•••• ' + recipientAccount;

      // Add to transaction log
      const newTx = {
        id: newTxId,
        type: 'outflow',
        title: recipientName,
        category: recipientBank,
        method: rail,
        date: 'Just now',
        rawDate: new Date().toISOString(),
        amount: transferAmount,
        status: 'Completed',
        note: memo || 'Wire Transfer'
      };

      state.transactions.unshift(newTx);

      // Save state
      saveState();

      // Reset Form and Button
      if (submitBtn) submitBtn.disabled = false;
      if (submitBtnText) submitBtnText.textContent = 'Authorize & Execute Transfer';

      // Close transfer modal
      const transferModal = document.getElementById('transferModalOverlay');
      if (transferModal) transferModal.classList.remove('active');

      // Update UI
      updateUI();

      // Launch "TRANSFER COMPLETE" Modal & Celebration!
      showTransferCompleteModal({
        amount: transferAmount,
        recipient: recipientName,
        bank: recipientBank,
        account: maskedAcc,
        rail: rail,
        memo: memo || 'Private Wealth Wire',
        txId: newTxId,
        timestamp: timestamp,
        remainingBalance: state.checkingBalance
      });

    }, 600);
  }

  function showTransferCompleteModal(details) {
    state.lastReceipt = details;

    const modal = document.getElementById('transferCompleteModalOverlay');
    if (!modal) return;

    // Reset titles to Transfer Complete
    document.querySelector('.success-heading').textContent = 'Transfer Complete';
    document.querySelector('.success-subheading').textContent = 'Your funds have been successfully wired and cleared via Fedwire.';

    // Populate Receipt Details
    document.getElementById('completeAmountDisplay').textContent = `-${formatCurrency(details.amount)}`;
    document.getElementById('receiptTxId').textContent = details.txId;
    document.getElementById('receiptTimestamp').textContent = details.timestamp;
    document.getElementById('receiptRecipient').textContent = details.recipient;
    document.getElementById('receiptBank').textContent = details.bank;
    document.getElementById('receiptAccount').textContent = details.account;
    document.getElementById('receiptRail').textContent = details.rail;
    document.getElementById('receiptMemo').textContent = details.memo;
    document.getElementById('receiptRemainingBalance').textContent = formatCurrency(details.remainingBalance);

    // Open Modal
    modal.classList.add('active');

    // Play luxurious success chime!
    AudioEngine.playSuccessChord();

    // Trigger Confetti explosion
    ConfettiEngine.burst();

    showToast(`Transfer Complete: ${formatCurrency(details.amount)} sent to ${details.recipient}`, 'success');
  }

  // =========================================================================
  // DEPOSIT / WIRE INFLOW
  // =========================================================================
  function handleDepositSubmit(e) {
    e.preventDefault();

    const senderInput = document.getElementById('depositSenderInput');
    const amountInput = document.getElementById('depositAmountInput');
    const noteInput = document.getElementById('depositNoteInput');

    const sender = senderInput ? senderInput.value.trim() : 'Institutional Wire';
    const amount = parseFloat(amountInput ? amountInput.value : 0);
    const note = noteInput ? noteInput.value.trim() : 'Inbound Wire Inflow';

    if (!amount || amount <= 0) {
      showToast('Please enter a valid deposit amount.', 'error');
      AudioEngine.playError();
      return;
    }

    // Add funds
    state.checkingBalance += amount;
    state.totalBalance += amount;

    const newTxId = generateTxId();

    const newTx = {
      id: newTxId,
      type: 'inflow',
      title: sender,
      category: 'Inbound Wire Deposit',
      method: 'Fedwire Inbound',
      date: 'Just now',
      rawDate: new Date().toISOString(),
      amount: amount,
      status: 'Settled',
      note: note
    };

    state.transactions.unshift(newTx);
    saveState();
    updateUI();

    // Close modal
    const modal = document.getElementById('depositModalOverlay');
    if (modal) modal.classList.remove('active');

    AudioEngine.playCashDeposit();
    showToast(`Inbound wire received: +${formatCurrency(amount)} from ${sender}`, 'success');
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
    // Navigation switching
    document.querySelectorAll('.nav-item').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.getAttribute('data-tab');
        if (tab === 'transfer') {
          // Open Send Modal directly
          AudioEngine.playClick();
          const transferModal = document.getElementById('transferModalOverlay');
          if (transferModal) transferModal.classList.add('active');
          return;
        }

        AudioEngine.playClick();
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        link.classList.add('active');

        document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
        const targetView = document.getElementById(`view-${tab}`);
        if (targetView) targetView.classList.add('active');
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

    // Send Money Modal Triggers
    const openSendBtn = document.getElementById('openSendModalBtn');
    const cardSendBtn = document.getElementById('cardSendActionBtn');
    const navTransferBtn = document.getElementById('navTransferBtn');
    const transferModal = document.getElementById('transferModalOverlay');
    const closeSendBtn = document.getElementById('closeSendModalBtn');
    const cancelSendBtn = document.getElementById('cancelSendBtn');

    [openSendBtn, cardSendBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          AudioEngine.playClick();
          if (transferModal) transferModal.classList.add('active');
          updateModalBalances();
        });
      }
    });

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
        btn.addEventListener('click', () => {
          AudioEngine.playClick();
          if (depositModal) depositModal.classList.add('active');
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
        } else if (lower.includes('wire') || lower.includes('send') || lower.includes('transfer')) {
          reply = "Understood. The Fedwire RTGS line is open and ready. You can initiate instant transfers directly via the Send Money terminal anytime.";
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
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    loadState();
    ConfettiEngine.init();
    initCardTilt();
    setupEventListeners();
    updateUI();
  });

})();
