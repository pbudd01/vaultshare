const INTEREST_RATE = 0.035;
const ADMIN_PASS = "PBUDD MASTER 2026";
let tapCount = 0;
let userAccount = JSON.parse(localStorage.getItem('vaultUser')) || null;
let isBalanceVisible = true;
let tempReceiptBase64 = null;

// Ensure new fields exist for old users
if (userAccount) {
    if (!userAccount.pendingWithdrawals) userAccount.pendingWithdrawals = [];
}

function floorToTwo(num) { return Math.floor(num * 100) / 100; }

function showView(viewId) {
    document.querySelectorAll('.view-container').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    const nav = document.getElementById('main-nav');
    if (['home-view', 'calc-view', 'me-view'].includes(viewId)) nav.classList.remove('hidden');
    else nav.classList.add('hidden');
}

function switchTab(tabName, element) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    if (tabName === 'home') showView('home-view');
    if (tabName === 'calc') showView('calc-view');
    if (tabName === 'me') showView('me-view');
    updateUI();
}

function showDashboard() { switchTab('home', document.getElementById('nav-home')); }

function showTransactionDetail(index) {
    const tx = userAccount.history[index];
    if (!tx) return;
    showView('transaction-detail-view');
    
    document.getElementById('detail-amount').innerText = `₦${Math.abs(tx.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('detail-type').innerText = tx.type;
    document.getElementById('detail-date').innerText = tx.date;
    document.getElementById('detail-ref').innerText = tx.id || "REF-000";
    document.getElementById('detail-note').innerText = tx.note || "";
    
    const statusPill = document.getElementById('detail-status');
    statusPill.innerText = tx.status || "Success";
    statusPill.className = "status-pill " + (tx.status === "Pending" ? "pending" : (tx.status === "Declined" ? "declined" : "success"));

    const iconDiv = document.getElementById('detail-icon');
    if (tx.amount > 0) {
        iconDiv.style.background = "rgba(16, 185, 129, 0.2)";
        iconDiv.style.color = "#10b981";
        iconDiv.innerHTML = "+";
    } else {
        iconDiv.style.background = "rgba(255, 77, 77, 0.2)";
        iconDiv.style.color = "#ff4d4d";
        iconDiv.innerHTML = "-";
    }
}

function handleSignUp() {
    const name = document.getElementById('reg-name').value;
    const phone = document.getElementById('reg-phone').value;
    const gender = document.getElementById('reg-gender').value;
    const dob = document.getElementById('reg-dob').value;
    const email = document.getElementById('reg-email').value;
    const address = document.getElementById('reg-address').value;
    const pass = document.getElementById('reg-password').value;
    const passConf = document.getElementById('reg-password-confirm').value;
    const pin = document.getElementById('reg-pin').value;
    const pinConf = document.getElementById('reg-pin-confirm').value;

    if (!name || !phone) return alert("Fill all fields.");
    if (pass !== passConf) return alert("Passwords do not match!");
    if (pin !== pinConf) return alert("PINs do not match!");
    if (pass.length < 4) return alert("Password too short.");

    userAccount = {
        name, phone, gender, dob, email, address, password: pass, securityPin: pin,
        balance: 0, totalInterest: 0,
        lastInterestPaidDate: new Date().toLocaleDateString('en-CA'),
        profilePicture: null,
        history: [],
        pendingDeposits: [],
        pendingWithdrawals: [],
        lockedFunds: [], 
        savedBanks: [{bank:"",name:"",num:""}, {bank:"",name:"",num:""}]
    };
    save();
    alert("Vault created! Please log in.");
    showView('login-view');
}

function handleLogin() {
    const phone = document.getElementById('login-phone').value;
    const pass = document.getElementById('login-password').value;
    if (!userAccount) return alert("Sign up first.");
    if (phone === userAccount.phone && pass === userAccount.password) {
        showDashboard();
        processDailyInterest();
    } else {
        alert("Invalid credentials.");
    }
}

function handleLogout() {
    if (confirm("Logout?")) showView('login-view');
}

function toggleBalanceVisibility() {
    isBalanceVisible = !isBalanceVisible;
    const el = document.getElementById('display-balance');
    const eyeOpen = document.getElementById('eye-open-svg');
    const eyeClosed = document.getElementById('eye-closed-svg');
    if (isBalanceVisible) {
        el.classList.remove('balance-hidden');
        eyeOpen.classList.remove('hidden');
        eyeClosed.classList.add('hidden');
        updateUI();
    } else {
        el.classList.add('balance-hidden');
        eyeOpen.classList.add('hidden');
        eyeClosed.classList.remove('hidden');
        el.innerText = "****";
    }
}

function updateUI() {
    if (!userAccount) return;
    const fname = userAccount.name.split(' ')[0];
    document.getElementById('header-firstname').innerText = fname;
    document.getElementById('header-avatar').innerText = fname.charAt(0);
    document.getElementById('me-username').innerText = `Hi, ${userAccount.name}`;
    document.getElementById('me-avatar').innerText = fname.charAt(0);
    
    if (isBalanceVisible) {
        document.getElementById('display-balance').innerText = `₦${userAccount.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    }
    document.getElementById('me-total-balance').innerText = `₦${userAccount.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    const avatars = [document.getElementById('header-avatar'), document.getElementById('me-avatar'), document.getElementById('prof-img-display')];
    avatars.forEach(el => {
        if (userAccount.profilePicture) {
            el.innerHTML = `<img src="${userAccount.profilePicture}" alt="Profile">`;
            el.style.background = 'transparent';
        }
    });

    // RENDER HISTORY
    const feed = document.getElementById('dashboard-history-feed');
    if (userAccount.history.length === 0) {
        feed.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">No transactions yet.</p>';
    } else {
        feed.innerHTML = userAccount.history.map((item, index) => {
            const isPos = item.amount > 0;
            const isPending = item.status === "Pending";
            return `
            <div class="feed-item" onclick="showTransactionDetail(${index})">
                <div class="feed-left">
                    <div class="tx-icon ${isPos ? 'in' : (isPending ? 'pending' : 'out')}">
                        ${isPending ? '⏳' : (isPos ? '+' : '-')}
                    </div>
                    <div class="tx-details">
                        <h4>${item.type}</h4>
                        <p>${item.date} • ${item.status || 'Success'}</p>
                    </div>
                </div>
                <div class="tx-amount ${isPos ? 'plus' : 'minus'}">
                    ${isPos ? '+' : ''}₦${Math.abs(item.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
            </div>`;
        }).join('');
    }

    const tier = calculateTier(userAccount.balance);
    document.getElementById('header-tier-badge').innerText = tier.label;
    document.getElementById('me-tier-badge').innerText = tier.label;
}

function calculateTier(bal) {
    if (bal >= 50001) return {label: "Tier 5 Gold"};
    if (bal >= 20001) return {label: "Tier 4"};
    if (bal >= 10001) return {label: "Tier 3"};
    if (bal >= 1001) return {label: "Tier 2"};
    return {label: "Tier 1"};
}

function handleImageUpdate(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            userAccount.profilePicture = ev.target.result;
            save();
            alert("Updated");
        };
        reader.readAsDataURL(file);
    }
}

function previewReceipt(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            tempReceiptBase64 = ev.target.result;
            document.getElementById('receipt-status').innerText = "✅ Attached";
        };
        reader.readAsDataURL(file);
    }
}

function requestDeposit() {
    const amt = parseFloat(document.getElementById('deposit-amount-input').value);
    if (isNaN(amt) || amt <= 0 || !tempReceiptBase64) return alert("Error");
    userAccount.pendingDeposits.push({
        id: "TX-" + Date.now(), amount: amt, receipt: tempReceiptBase64, date: new Date().toLocaleString()
    });
    tempReceiptBase64 = null;
    save();
    alert("Deposit sent to Admin.");
    showDashboard();
}

function handleWithdrawal() {
    const amt = parseFloat(document.getElementById('withdraw-amount').value);
    const pin = document.getElementById('withdraw-pin').value;
    
    if (pin !== userAccount.securityPin) return alert("Incorrect PIN");
    if (amt <= 0 || amt > userAccount.balance) return alert("Invalid Amount");
    
    // Deduct immediately, store as pending
    userAccount.balance -= amt;
    const tx = {
        id: "TX-" + Date.now(), date: new Date().toLocaleDateString('en-CA'), 
        type: "Withdrawal", amount: -amt, status: "Pending", note: "Pending Approval"
    };
    userAccount.history.unshift(tx);
    userAccount.pendingWithdrawals.push(tx);
    save();
    alert("Withdrawal Pending.");
    showDashboard();
}

function countAdminTaps() {
    tapCount++;
    if (tapCount >= 10) {
        tapCount = 0;
        if (prompt("Master Key:") === ADMIN_PASS) { showView('admin-view'); renderAdmin(); }
    }
    setTimeout(() => tapCount = 0, 3000);
}

function renderAdmin() {
    document.getElementById('vault-total').innerText = `₦${userAccount.balance.toLocaleString()}`;
    const listDep = document.getElementById('pending-requests-list');
    listDep.innerHTML = userAccount.pendingDeposits.map((req, idx) => `
        <div class="admin-request-card">
            <div><strong>${userAccount.name}</strong><br><small>+₦${req.amount.toLocaleString()}</small></div>
            <div class="admin-actions"><button class="approve-btn" onclick="approveDeposit(${idx})">✔</button></div>
        </div>
    `).join('') || '<p style="opacity:0.5">No Deposits</p>';

    const listWith = document.getElementById('pending-withdrawals-list');
    listWith.innerHTML = userAccount.pendingWithdrawals.map((req, idx) => `
        <div class="admin-request-card" style="border-left-color:var(--danger)">
            <div><strong>${userAccount.name}</strong><br><small>Withdraw: ₦${Math.abs(req.amount).toLocaleString()}</small></div>
            <div class="admin-actions">
                <button class="approve-btn" onclick="approveWithdrawal('${req.id}')">✔</button>
                <button class="decline-btn" onclick="declineWithdrawal('${req.id}')">✘</button>
            </div>
        </div>
    `).join('') || '<p style="opacity:0.5">No Withdrawals</p>';
}

function approveDeposit(idx) {
    const req = userAccount.pendingDeposits[idx];
    const mature = new Date(); mature.setDate(mature.getDate() + 2); mature.setHours(6,0,0,0);
    userAccount.lockedFunds.push({amount: req.amount, earnsAfter: mature.getTime()});
    userAccount.balance += req.amount;
    userAccount.history.unshift({
        id: req.id, date: new Date().toLocaleDateString('en-CA'), 
        type: "Deposit Confirmed", amount: req.amount, status: "Success", note: "Interest in 48h"
    });
    userAccount.pendingDeposits.splice(idx, 1);
    save(); renderAdmin(); alert("Approved");
}

function approveWithdrawal(txId) {
    const tx = userAccount.history.find(t => t.id === txId);
    if (tx) { tx.status = "Success"; tx.note = "Withdrawal Success"; }
    userAccount.pendingWithdrawals = userAccount.pendingWithdrawals.filter(t => t.id !== txId);
    save(); renderAdmin(); alert("Approved");
}

function declineWithdrawal(txId) {
    const tx = userAccount.history.find(t => t.id === txId);
    if (tx) { tx.status = "Declined"; tx.note = "Refunded"; userAccount.balance += Math.abs(tx.amount); }
    userAccount.pendingWithdrawals = userAccount.pendingWithdrawals.filter(t => t.id !== txId);
    save(); renderAdmin(); alert("Declined");
}

function processDailyInterest() {
    const now = new Date();
    const today = now.toLocaleDateString('en-CA');
    if (now.getHours() >= 6 && userAccount.lastInterestPaidDate !== today) {
        let matureBal = userAccount.balance;
        if (userAccount.lockedFunds) {
            userAccount.lockedFunds = userAccount.lockedFunds.filter(f => {
                if (now.getTime() < f.earnsAfter) { matureBal -= f.amount; return true; }
                return false;
            });
        }
        const pending = userAccount.balance - matureBal;
        if (pending > 0) {
            document.getElementById('maturity-notice').classList.remove('hidden');
            document.getElementById('pending-interest-amt').innerText = pending.toLocaleString();
        } else {
            document.getElementById('maturity-notice').classList.add('hidden');
        }
        
        let gain = floorToTwo(matureBal * (Math.pow(1 + INTEREST_RATE, 1/365) - 1));
        if (gain > 0) {
            userAccount.balance += gain;
            userAccount.history.unshift({
                id: "INT-" + Date.now(), date: today, type: "Interest Credit", amount: gain, status: "Success", note: "Daily Yield"
            });
        }
        userAccount.lastInterestPaidDate = today;
        save();
    }
}

function projectInterest() {
    const p = parseFloat(document.getElementById('calc-amount').value);
    if (!p) return;
    const y = p * INTEREST_RATE;
    document.getElementById('monthly-gain').innerText = `₦${floorToTwo(y/12).toLocaleString(undefined,{minimumFractionDigits:2})}`;
    document.getElementById('yearly-gain').innerText = `₦${floorToTwo(y).toLocaleString(undefined,{minimumFractionDigits:2})}`;
}

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
    save(); alert("Saved"); showView('me-view');
}

function save() { localStorage.setItem('vaultUser', JSON.stringify(userAccount)); updateUI(); }
if (userAccount) {
    if (userAccount.savedBanks) {
        document.getElementById('bank1-name').value = userAccount.savedBanks[0].bank || "";
        document.getElementById('acc1-name').value = userAccount.savedBanks[0].name || "";
        document.getElementById('acc1-num').value = userAccount.savedBanks[0].num || "";
        document.getElementById('bank2-name').value = userAccount.savedBanks[1].bank || "";
        document.getElementById('acc2-name').value = userAccount.savedBanks[1].name || "";
        document.getElementById('acc2-num').value = userAccount.savedBanks[1].num || "";
    }
} else { showView('login-view'); }
