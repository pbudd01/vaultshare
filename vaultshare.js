/* === CONFIGURATION === */
const INTEREST_RATE = 0.035;
const ADMIN_PASS = "PBUDD MASTER 2026";
let tapCount = 0;
let userAccount = JSON.parse(localStorage.getItem('vaultUser')) || null;
let isBalanceVisible = true;
let tempReceiptBase64 = null;

// === NAVIGATION ===
function showView(viewId) {
    document.querySelectorAll('.view-container').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    
    // Manage Bottom Nav Visibility
    const nav = document.getElementById('main-nav');
    if (['home-view', 'calc-view', 'me-view'].includes(viewId)) {
        nav.classList.remove('hidden');
    } else {
        nav.classList.add('hidden');
    }
}

function switchTab(tabName, element) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    
    if (tabName === 'home') showView('home-view');
    if (tabName === 'calc') showView('calc-view');
    if (tabName === 'me') showView('me-view');
    updateUI();
}

function showDashboard() {
    switchTab('home', document.getElementById('nav-home'));
}

// === AUTHENTICATION ===
function handleSignUp() {
    const name = document.getElementById('reg-name').value;
    const phone = document.getElementById('reg-phone').value;
    const gender = document.getElementById('reg-gender').value;
    const dob = document.getElementById('reg-dob').value;
    const email = document.getElementById('reg-email').value;
    const address = document.getElementById('reg-address').value;
    const pass = document.getElementById('reg-password').value;
    const pin = document.getElementById('reg-pin').value;

    if (!name || !phone || pass.length < 4 || pin.length !== 4) return alert("Fill all fields correctly!");

    userAccount = {
        name, phone, gender, dob, email, address, password: pass, securityPin: pin,
        balance: 0, totalInterest: 0,
        lastInterestPaidDate: new Date().toLocaleDateString('en-CA'),
        profilePicture: null,
        history: [],
        pendingDeposits: [],
        lockedFunds: [], // For 48h maturity logic
        savedBanks: [{bank:"",name:"",num:""}, {bank:"",name:"",num:""}]
    };
    
    save();
    alert("Vault created! Please log in.");
    showView('login-view');
}

function handleLogin() {
    const phone = document.getElementById('login-phone').value;
    const pass = document.getElementById('login-password').value;

    if (!userAccount) return alert("No account found. Sign up first.");
    if (phone === userAccount.phone && pass === userAccount.password) {
        showDashboard();
        processDailyInterest();
    } else {
        alert("Invalid credentials.");
    }
}

function handleLogout() {
    if (confirm("Logout of VaultShare?")) showView('login-view');
}

// === CORE LOGIC ===
function toggleBalanceVisibility() {
    isBalanceVisible = !isBalanceVisible;
    const el = document.getElementById('display-balance');
    const icon = document.getElementById('balance-toggle');
    
    if (isBalanceVisible) {
        el.classList.remove('balance-hidden');
        icon.innerText = "👁️";
        updateUI();
    } else {
        el.classList.add('balance-hidden');
        icon.innerText = "🙈";
        el.innerText = "****";
    }
}

function updateUI() {
    if (!userAccount) return;
    
    // Header Info
    const fname = userAccount.name.split(' ')[0];
    document.getElementById('header-firstname').innerText = fname;
    document.getElementById('header-avatar').innerText = fname.charAt(0);
    document.getElementById('me-username').innerText = `Hi, ${userAccount.name}`;
    document.getElementById('me-avatar').innerText = fname.charAt(0);
    
    // Balance
    if (isBalanceVisible) {
        document.getElementById('display-balance').innerText = `₦${userAccount.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    }
    document.getElementById('me-total-balance').innerText = `₦${userAccount.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    // Profile Pic Logic
    const avatars = [document.getElementById('header-avatar'), document.getElementById('me-avatar'), document.getElementById('prof-img-display')];
    avatars.forEach(el => {
        if (userAccount.profilePicture) {
            el.innerHTML = `<img src="${userAccount.profilePicture}" alt="Profile">`;
            el.style.background = 'transparent';
        }
    });

    // Profile Details
    document.getElementById('prof-fullname').innerText = userAccount.name;
    const phoneDisplay = document.getElementById('prof-phone');
    phoneDisplay.innerHTML = `${userAccount.phone} <span onclick="copyToClip('${userAccount.phone}')" style="cursor:pointer;color:var(--brand-gold)">📋</span>`;
    document.getElementById('prof-gender').innerText = userAccount.gender;
    document.getElementById('prof-dob').innerText = userAccount.dob;
    document.getElementById('prof-email').innerText = userAccount.email;
    document.getElementById('prof-address').innerText = userAccount.address;

    // History List
    const list = document.getElementById('history-list');
    list.innerHTML = userAccount.history.map(item => `
        <div class="admin-request-card" style="border-left-color:${item.amount > 0 ? '#10b981' : '#ff4d4d'}">
            <div><small>${item.date}</small><br><strong>${item.type}</strong></div>
            <span style="color:${item.amount > 0 ? '#10b981' : '#ff4d4d'}">${item.amount > 0 ? '+' : ''}₦${Math.abs(item.amount).toLocaleString()}</span>
        </div>
    `).join('');

    // Tier Logic
    const tier = calculateTier(userAccount.balance);
    document.getElementById('header-tier-badge').innerText = tier.label;
    document.getElementById('me-tier-badge').innerText = tier.label;

    // Daily Gain
    const daily = userAccount.history.find(i => i.type === "Interest Credit" && i.date === new Date().toLocaleDateString('en-CA'));
    document.getElementById('me-daily-gain').innerText = daily ? `+₦${daily.amount.toFixed(2)}` : "+₦0.00";
}

function calculateTier(bal) {
    if (bal >= 50001) return {label: "Tier 5 Gold"};
    if (bal >= 20001) return {label: "Tier 4"};
    if (bal >= 10001) return {label: "Tier 3"};
    if (bal >= 1001) return {label: "Tier 2"};
    return {label: "Tier 1"};
}

function copyToClip(text) {
    navigator.clipboard.writeText(text);
    alert("Copied!");
}

// === IMAGE UPLOAD ===
function handleImageUpdate(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            userAccount.profilePicture = ev.target.result;
            save();
            alert("Profile Picture Updated");
        };
        reader.readAsDataURL(file);
    }
}

// === DEPOSIT & WITHDRAWAL ===
function previewReceipt(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            tempReceiptBase64 = ev.target.result;
            document.getElementById('receipt-status').innerText = "✅ Receipt Attached";
        };
        reader.readAsDataURL(file);
    }
}

function requestDeposit() {
    const amt = parseFloat(document.getElementById('deposit-amount-input').value);
    if (isNaN(amt) || amt <= 0 || !tempReceiptBase64) return alert("Enter amount and upload receipt.");
    
    userAccount.pendingDeposits.push({
        id: Date.now(), amount: amt, receipt: tempReceiptBase64, date: new Date().toLocaleString()
    });
    tempReceiptBase64 = null;
    save();
    alert("Deposit request sent to Admin.");
    showDashboard();
}

function handleWithdrawal() {
    const amt = parseFloat(document.getElementById('withdraw-amount').value);
    const pin = document.getElementById('withdraw-pin').value;
    
    if (pin !== userAccount.securityPin) return alert("Incorrect PIN");
    if (amt > userAccount.balance) return alert("Insufficient funds");
    
    userAccount.balance -= amt;
    userAccount.history.unshift({date: new Date().toLocaleDateString('en-CA'), type: "Withdrawal", amount: -amt});
    save();
    alert("Withdrawal Successful");
    showDashboard();
}

// === ADMIN & INTEREST ENGINE ===
function countAdminTaps() {
    tapCount++;
    if (tapCount >= 10) {
        tapCount = 0;
        if (prompt("Enter Master Key:") === ADMIN_PASS) {
            showView('admin-view');
            renderAdmin();
        }
    }
    setTimeout(() => tapCount = 0, 3000);
}

function renderAdmin() {
    document.getElementById('vault-total').innerText = `₦${userAccount.balance.toLocaleString()}`;
    const list = document.getElementById('pending-requests-list');
    list.innerHTML = userAccount.pendingDeposits.map((req, idx) => `
        <div class="admin-request-card">
            <div><strong>${userAccount.name}</strong><br><small>₦${req.amount.toLocaleString()} - ${req.date}</small></div>
            <div class="admin-actions">
                <button class="view-receipt-btn" onclick="viewReceipt('${idx}')">View</button>
                <button class="approve-btn" onclick="approveDeposit(${idx})">Approve</button>
            </div>
        </div>
    `).join('') || '<p>No pending deposits.</p>';
}

function viewReceipt(idx) {
    const w = window.open();
    w.document.write(`<img src="${userAccount.pendingDeposits[idx].receipt}" style="width:100%">`);
}

function approveDeposit(idx) {
    const req = userAccount.pendingDeposits[idx];
    const oldBal = userAccount.balance;
    
    // Maturity Logic: Interest starts in 48h
    const mature = new Date();
    mature.setDate(mature.getDate() + 2);
    mature.setHours(6,0,0,0);
    
    userAccount.lockedFunds.push({amount: req.amount, earnsAfter: mature.getTime()});
    userAccount.balance += req.amount;
    userAccount.history.unshift({date: new Date().toLocaleDateString('en-CA'), type: "Deposit Confirmed", amount: req.amount});
    userAccount.pendingDeposits.splice(idx, 1);
    
    // Check Tier Upgrade
    const oldTier = calculateTier(oldBal).label;
    const newTier = calculateTier(userAccount.balance).label;
    if (oldTier !== newTier) showMilestone(newTier);

    save();
    renderAdmin();
    alert("Deposit Approved!");
}

function showMilestone(tierLabel) {
    const div = document.createElement('div');
    div.className = 'milestone-popup';
    div.innerHTML = `
        <div class="popup-content">
            <div class="badge-icon">🏆</div>
            <h2>Congratulations!</h2>
            <p>You reached <strong>${tierLabel}</strong></p>
            <button class="primary-btn" onclick="this.parentElement.parentElement.remove()">Amazing!</button>
        </div>
    `;
    document.body.appendChild(div);
}

function processDailyInterest() {
    const now = new Date();
    const today = now.toLocaleDateString('en-CA');
    if (now.getHours() >= 6 && userAccount.lastInterestPaidDate !== today) {
        let matureBal = userAccount.balance;
        
        // Exclude locked funds
        if (userAccount.lockedFunds) {
            userAccount.lockedFunds = userAccount.lockedFunds.filter(f => {
                if (now.getTime() < f.earnsAfter) {
                    matureBal -= f.amount;
                    return true; // Keep locked
                }
                return false; // Remove lock
            });
        }
        
        // Display notice if funds locked
        const pendingInterest = userAccount.balance - matureBal;
        if (pendingInterest > 0) {
            document.getElementById('maturity-notice').classList.remove('hidden');
            document.getElementById('pending-interest-amt').innerText = pendingInterest.toLocaleString();
        } else {
            document.getElementById('maturity-notice').classList.add('hidden');
        }

        // Apply Interest
        const rate = Math.pow(1 + INTEREST_RATE, 1/365) - 1;
        const gain = matureBal * rate;
        
        if (gain > 0) {
            userAccount.balance += gain;
            userAccount.history.unshift({date: today, type: "Interest Credit", amount: gain});
        }
        userAccount.lastInterestPaidDate = today;
        save();
    }
}

// === CALCULATOR ===
function projectInterest() {
    const p = parseFloat(document.getElementById('calc-amount').value);
    if (!p) return;
    const y = p * INTEREST_RATE;
    document.getElementById('monthly-gain').innerText = `₦${(y/12).toLocaleString(undefined,{maximumFractionDigits:2})}`;
    document.getElementById('yearly-gain').innerText = `₦${y.toLocaleString(undefined,{maximumFractionDigits:2})}`;
}

// === BANK INFO ===
function saveBankDetails() {
    userAccount.savedBanks[0] = {
        bank: document.getElementById('bank1-name').value,
        name: document.getElementById('acc1-name').value,
        num: document.getElementById('acc1-num').value
    };
    userAccount.savedBanks[1] = {
        bank: document.getElementById('bank2-name').value,
        name: document.getElementById('acc2-name').value,
        num: document.getElementById('acc2-num').value
    };
    save();
    alert("Bank Details Saved");
    showView('me-view');
}

function save() { localStorage.setItem('vaultUser', JSON.stringify(userAccount)); updateUI(); }

// Initialize
if (userAccount) {
    // Populate Bank Inputs
    if (userAccount.savedBanks) {
        document.getElementById('bank1-name').value = userAccount.savedBanks[0].bank || "";
        document.getElementById('acc1-name').value = userAccount.savedBanks[0].name || "";
        document.getElementById('acc1-num').value = userAccount.savedBanks[0].num || "";
        document.getElementById('bank2-name').value = userAccount.savedBanks[1].bank || "";
        document.getElementById('acc2-name').value = userAccount.savedBanks[1].name || "";
        document.getElementById('acc2-num').value = userAccount.savedBanks[1].num || "";
    }
} else {
    showView('login-view');
}
