// ============================================================
//  DOOMINIKS STORE - script.js
//  Full logic: Auth, Products, Orders, Payments, Chat, Owner
// ============================================================

// ---- STATE ----
let currentUser = null;       // { username, ...userData }
let currentProductId = null;
let currentProduct = null;
let appliedDiscount = null;
let selectedBadge = null;
let currentRating = 0;
let pendingProofContext = null; // { type:'order'|'deposit', id, amount, ... }
let chatActivePeer = null;      // username of chat peer (for owner)
let db, fb;
let ownerSettings = {};
let allProducts = {};
let chatUnsubscribes = [];

// ---- OWNER CREDENTIALS (stored in Firebase settings) ----
// Default credentials if not set yet
const DEFAULT_OWNER_PASS = "owner123";

// ---- FIREBASE READY ----
document.addEventListener('firebaseReady', initApp);
window.addEventListener('load', () => {
  if (window._firebaseReady) initApp();
});

function initApp() {
  if (initApp._done) return;
  initApp._done = true;
  db = window._db;
  fb = window._fb;
  spawnParticles();
  startLoading();
}

// ---- LOADING ----
function startLoading() {
  const statuses = ["Initializing systems...", "Loading products...", "Connecting database...", "Preparing interface..."];
  let i = 0;
  const el = document.querySelector('.loading-status');
  const iv = setInterval(() => { if (el && i < statuses.length - 1) el.textContent = statuses[++i]; }, 600);
  setTimeout(() => {
    clearInterval(iv);
    document.getElementById('loading-screen').style.transition = 'opacity 0.6s';
    document.getElementById('loading-screen').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      loadSettings();
      loadProducts();
      loadReviews();
      restoreSession();
    }, 600);
  }, 2800);
}

function spawnParticles() {
  const wrap = document.getElementById('loadingParticles');
  if (!wrap) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.animationDuration = (3 + Math.random() * 5) + 's';
    p.style.animationDelay = (Math.random() * 4) + 's';
    p.style.opacity = 0.3 + Math.random() * 0.7;
    wrap.appendChild(p);
  }
}

// ---- SETTINGS ----
async function loadSettings() {
  try {
    const snap = await fb.get(fb.ref(db, 'settings'));
    if (snap.exists()) {
      ownerSettings = snap.val();
      const dlink = document.getElementById('setDiscordLink');
      if (dlink) dlink.value = ownerSettings.discordLink || '';
      const bn = document.getElementById('setBankName'); if (bn) bn.value = ownerSettings.bankName || '';
      const bno = document.getElementById('setBankNo'); if (bno) bno.value = ownerSettings.bankNo || '';
      const bo = document.getElementById('setBankOwner'); if (bo) bo.value = ownerSettings.bankOwner || '';
      const ew = document.getElementById('setEwallet'); if (ew) ew.value = ownerSettings.ewallet || '';
      const ou = document.getElementById('setOwnerUsername'); if (ou) ou.value = ownerSettings.ownerUsername || 'Owner';
    }
  } catch(e) { console.log('settings load', e); }
}

// ---- SESSION ----
function restoreSession() {
  const saved = localStorage.getItem('doominiks_session');
  if (!saved) return;
  const { username } = JSON.parse(saved);
  fb.get(fb.ref(db, `users/${username}`)).then(snap => {
    if (snap.exists()) {
      currentUser = { username, ...snap.val() };
      updateNavUser();
      listenUserData(username);
    }
  }).catch(() => {});
}

function listenUserData(username) {
  fb.onValue(fb.ref(db, `users/${username}`), snap => {
    if (!snap.exists()) return;
    currentUser = { username, ...snap.val() };
    updateNavUser();
    if (document.getElementById('section-profile').classList.contains('active')) {
      renderProfile();
    }
  });
}

// ---- AUTH ----
async function registerUser() {
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;
  const errEl = document.getElementById('regError');
  errEl.textContent = '';

  if (!username || !password) return (errEl.textContent = 'Isi semua field!');
  if (password !== confirm) return (errEl.textContent = 'Password tidak cocok!');
  if (username.length < 3) return (errEl.textContent = 'Username minimal 3 karakter!');
  if (password.length < 6) return (errEl.textContent = 'Password minimal 6 karakter!');

  try {
    const snap = await fb.get(fb.ref(db, `users/${username}`));
    if (snap.exists()) return (errEl.textContent = 'Username sudah dipakai!');
    const userData = {
      password: btoa(password),
      balance: 0,
      coins: 0,
      badges: [],
      createdAt: Date.now()
    };
    await fb.set(fb.ref(db, `users/${username}`), userData);
    closeModal('registerModal');
    showToast('Akun berhasil dibuat! Silakan login.', 'success');
  } catch(e) {
    errEl.textContent = 'Gagal mendaftar: ' + e.message;
  }
}

async function loginUser() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  if (!username || !password) return (errEl.textContent = 'Isi semua field!');

  // Check owner
  const ownerUser = ownerSettings.ownerUsername || 'Owner';
  const ownerPass = ownerSettings.ownerPassword || DEFAULT_OWNER_PASS;
  if (username === ownerUser && password === ownerPass) {
    currentUser = { username, isOwner: true, balance: 0, coins: 0, badges: ['owner'] };
    localStorage.setItem('doominiks_session', JSON.stringify({ username }));
    closeModal('loginModal');
    updateNavUser();
    showToast('Selamat datang, Owner!', 'success');
    return;
  }

  try {
    const snap = await fb.get(fb.ref(db, `users/${username}`));
    if (!snap.exists()) return (errEl.textContent = 'Username tidak ditemukan!');
    const data = snap.val();
    if (atob(data.password) !== password) return (errEl.textContent = 'Password salah!');
    currentUser = { username, ...data };
    localStorage.setItem('doominiks_session', JSON.stringify({ username }));
    updateNavUser();
    closeModal('loginModal');
    listenUserData(username);
    showToast('Login berhasil!', 'success');
  } catch(e) {
    errEl.textContent = 'Gagal login: ' + e.message;
  }
}

function logoutUser() {
  currentUser = null;
  localStorage.removeItem('doominiks_session');
  chatUnsubscribes.forEach(u => u && u());
  chatUnsubscribes = [];
  updateNavUser();
  showSection('home');
  showToast('Berhasil logout.', 'success');
}

function updateNavUser() {
  const guestEl = document.getElementById('nav-guest');
  const userEl = document.getElementById('nav-user');
  if (currentUser) {
    guestEl.style.display = 'none';
    userEl.style.display = 'flex';
    document.getElementById('navUsername').textContent = currentUser.username;
    document.getElementById('navCoins').textContent = currentUser.coins || 0;
  } else {
    guestEl.style.display = 'flex';
    userEl.style.display = 'none';
  }
}

// ---- OWNER PANEL ACCESS ----
function showOwnerPanel() {
  if (!currentUser) return showModal('loginModal');
  const ownerUser = ownerSettings.ownerUsername || 'Owner';
  if (currentUser.username !== ownerUser) {
    showToast('Akses ditolak!', 'error'); return;
  }
  showSection('owner');
  loadOwnerDashboard();
}

// ---- SECTIONS ----
function showSection(name) {
  if (name === 'owner') {
    showOwnerPanel(); return;
  }
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.section === name);
  });
  const sec = document.getElementById('section-' + name);
  if (sec) {
    sec.classList.add('active');
    window.scrollTo(0, 0);
  }
  if (name === 'profile') { if (!currentUser) { showModal('loginModal'); showSection('home'); return; } renderProfile(); }
  if (name === 'products') renderAllProducts();
  if (name === 'reviews') renderAllReviews();
}

// ---- MOBILE MENU ----
function toggleMobileMenu() {
  let panel = document.getElementById('mobileMenuPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'mobileMenuPanel';
    panel.className = 'mobile-menu-panel';
    panel.innerHTML = `
      <a class="nav-link" onclick="showSection('home');toggleMobileMenu()"><i class="fas fa-home"></i> Home</a>
      <a class="nav-link" onclick="showSection('products');toggleMobileMenu()"><i class="fas fa-box"></i> Produk</a>
      <a class="nav-link" onclick="showSection('reviews');toggleMobileMenu()"><i class="fas fa-star"></i> Ulasan</a>
      <a class="nav-link" onclick="openDiscord();toggleMobileMenu()"><i class="fab fa-discord"></i> Discord</a>
      <a class="nav-link" onclick="showOwnerPanel();toggleMobileMenu()"><i class="fas fa-crown"></i> Owner</a>
    `;
    document.body.appendChild(panel);
  }
  panel.classList.toggle('open');
}

// ---- DISCORD ----
function openDiscord() {
  const link = ownerSettings.discordLink || '#';
  if (link !== '#') window.open(link, '_blank');
  else showToast('Link Discord belum diatur', 'error');
}

// ---- PRODUCTS ----
async function loadProducts() {
  fb.onValue(fb.ref(db, 'products'), snap => {
    allProducts = snap.exists() ? snap.val() : {};
    renderFeaturedProducts();
    updateStats();
    if (document.getElementById('section-products').classList.contains('active')) renderAllProducts();
    if (document.getElementById('section-owner').classList.contains('active')) renderOwnerProducts();
  });
}

function renderFeaturedProducts() {
  const el = document.getElementById('featuredProducts');
  if (!el) return;
  const list = Object.entries(allProducts).slice(0, 6);
  if (!list.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>Belum ada produk</p></div>'; return; }
  el.innerHTML = list.map(([id, p]) => productCardHTML(id, p)).join('');
}

function renderAllProducts() {
  const el = document.getElementById('allProducts');
  if (!el) return;
  const q = (document.getElementById('searchProduct')?.value || '').toLowerCase();
  let list = Object.entries(allProducts);
  if (q) list = list.filter(([, p]) => p.name.toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q));
  if (!list.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>Tidak ada produk ditemukan</p></div>'; return; }
  el.innerHTML = list.map(([id, p]) => productCardHTML(id, p)).join('');
}

function filterProducts() { renderAllProducts(); }

function productCardHTML(id, p) {
  const discPct = getProductDiscount(p);
  const finalPrice = discPct > 0 ? Math.round(p.price * (1 - discPct/100)) : p.price;
  const stockClass = p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : '';
  const stockLabel = p.stock === 0 ? 'Habis' : `Stok: ${p.stock}`;
  return `<div class="product-card" onclick="openProduct('${id}')">
    ${discPct > 0 ? `<div class="prod-discount-badge">-${discPct}%</div>` : ''}
    <div class="prod-img-wrap">
      ${p.imageUrl ? `<img class="prod-img" src="${p.imageUrl}" alt="${p.name}" loading="lazy"/>` : `<div class="prod-no-img"><i class="fas fa-image"></i></div>`}
      <div class="prod-img-overlay"><i class="fas fa-eye"></i></div>
    </div>
    <div class="prod-body">
      <div class="prod-category">${p.category || 'Umum'}</div>
      <div class="prod-name">${p.name}</div>
      <div class="prod-price-row">
        <div>
          ${discPct > 0 ? `<span style="font-size:11px;color:var(--text3);text-decoration:line-through">Rp ${fmtNum(p.price)}</span><br>` : ''}
          <span class="prod-price">Rp ${fmtNum(finalPrice)}</span>
        </div>
        <span class="prod-coin-price"><i class="fas fa-coins"></i> ${p.coinPrice || '?'}</span>
      </div>
      <div class="prod-stock ${stockClass}">${stockLabel}</div>
    </div>
  </div>`;
}

function getProductDiscount(p) {
  // Check if any discount applies globally (could extend to per-product)
  return 0; // Global discounts apply at checkout
}

async function openProduct(id) {
  const p = allProducts[id];
  if (!p) return;
  currentProductId = id;
  currentProduct = p;
  appliedDiscount = null;

  document.getElementById('pdTitle').textContent = p.name;
  document.getElementById('pdImage').src = p.imageUrl || '';
  document.getElementById('pdImage').style.display = p.imageUrl ? 'block' : 'none';
  document.getElementById('pdCategory').textContent = p.category || 'Umum';
  document.getElementById('pdDescription').textContent = p.description || '';
  document.getElementById('pdPrice').textContent = 'Rp ' + fmtNum(p.price);
  document.getElementById('pdCoinPrice').textContent = `🪙 ${p.coinPrice || '?'} Koin`;
  document.getElementById('pdOriginalPrice').style.display = 'none';
  document.getElementById('pdDiscountBadge').style.display = 'none';

  const stockBadge = document.getElementById('pdStock');
  if (p.stock === 0) { stockBadge.textContent = 'Stok Habis'; stockBadge.style.color = 'var(--red)'; }
  else { stockBadge.textContent = `Stok: ${p.stock}`; stockBadge.style.color = ''; }

  document.getElementById('discountCodeInput').value = '';
  document.getElementById('discountMsg').textContent = '';
  showModal('productModal');
}

// ---- DISCOUNT ----
async function applyDiscount() {
  const code = document.getElementById('discountCodeInput').value.trim().toUpperCase();
  const msgEl = document.getElementById('discountMsg');
  if (!code) return;
  try {
    const snap = await fb.get(fb.ref(db, `discounts/${code}`));
    if (!snap.exists()) { msgEl.textContent = 'Kode tidak valid!'; msgEl.className = 'discount-result err'; return; }
    const disc = snap.val();
    if (disc.usedCount >= disc.limit) { msgEl.textContent = 'Kode sudah habis!'; msgEl.className = 'discount-result err'; return; }
    appliedDiscount = { code, percent: disc.percent };
    const orig = currentProduct.price;
    const discounted = Math.round(orig * (1 - disc.percent / 100));
    document.getElementById('pdOriginalPrice').textContent = 'Rp ' + fmtNum(orig);
    document.getElementById('pdOriginalPrice').style.display = 'inline';
    document.getElementById('pdPrice').textContent = 'Rp ' + fmtNum(discounted);
    document.getElementById('pdDiscountBadge').textContent = `-${disc.percent}%`;
    document.getElementById('pdDiscountBadge').style.display = 'inline';
    msgEl.textContent = `Diskon ${disc.percent}% berhasil!`;
    msgEl.className = 'discount-result ok';
  } catch(e) { msgEl.textContent = 'Error: ' + e.message; msgEl.className = 'discount-result err'; }
}

// ---- BUY FLOW ----
function buyWithIDR() {
  if (!currentUser) { closeModal('productModal'); showModal('loginModal'); return; }
  if (currentProduct.stock === 0) { showToast('Stok habis!', 'error'); return; }
  closeModal('productModal');
  showPaymentModal('idr');
}

function buyWithCoin() {
  if (!currentUser) { closeModal('productModal'); showModal('loginModal'); return; }
  if (currentProduct.stock === 0) { showToast('Stok habis!', 'error'); return; }
  const coinPrice = currentProduct.coinPrice || 0;
  if ((currentUser.coins || 0) < coinPrice) { showToast('Koin tidak cukup!', 'error'); return; }
  closeModal('productModal');
  confirmCoinPurchase(coinPrice);
}

async function confirmCoinPurchase(coinPrice) {
  if (!confirm(`Beli "${currentProduct.name}" seharga ${coinPrice} Koin?`)) return;
  try {
    const newCoins = (currentUser.coins || 0) - coinPrice;
    await fb.update(fb.ref(db, `users/${currentUser.username}`), { coins: newCoins });
    await fb.update(fb.ref(db, `products/${currentProductId}`), { stock: Math.max(0, (currentProduct.stock || 0) - 1) });
    const orderId = 'ORD-' + Date.now();
    await fb.set(fb.ref(db, `orders/${orderId}`), {
      id: orderId,
      username: currentUser.username,
      productId: currentProductId,
      productName: currentProduct.name,
      amount: coinPrice,
      currency: 'COIN',
      status: 'processing',
      createdAt: Date.now()
    });
    await logTransaction(currentUser.username, 'purchase', -coinPrice, 'COIN', `Beli: ${currentProduct.name}`);
    if (appliedDiscount) await incrementDiscountUse(appliedDiscount.code);
    showToast('Pembelian berhasil! Pesanan sedang diproses.', 'success');
    showSection('profile');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

function showPaymentModal(currency) {
  const price = getFinalPrice();
  document.getElementById('paymentContent').innerHTML = buildPaymentSelector(price, currency);
  showModal('paymentModal');
}

function getFinalPrice() {
  const base = currentProduct.price;
  if (appliedDiscount) return Math.round(base * (1 - appliedDiscount.percent / 100));
  return base;
}

function buildPaymentSelector(price, currency) {
  return `
    <div style="margin-bottom:16px">
      <div class="payment-info-box">
        <div class="payment-info-row"><span class="label">Produk</span><span class="value">${currentProduct.name}</span></div>
        <div class="payment-info-row"><span class="label">Total</span><span class="value red">Rp ${fmtNum(price)}</span></div>
        ${appliedDiscount ? `<div class="payment-info-row"><span class="label">Diskon</span><span class="value" style="color:#00c864">${appliedDiscount.code} (-${appliedDiscount.percent}%)</span></div>` : ''}
      </div>
      <p style="font-size:13px;color:var(--text3);margin-bottom:12px">Pilih metode pembayaran:</p>
      <div class="payment-method-grid">
        <button class="payment-method-btn" onclick="selectPaymentMethod('transfer',${price})"><i class="fas fa-university"></i>Transfer Bank</button>
        <button class="payment-method-btn" onclick="selectPaymentMethod('ewallet',${price})"><i class="fas fa-mobile-alt"></i>E-Wallet</button>
        <button class="payment-method-btn" onclick="selectPaymentMethod('balance',${price})"><i class="fas fa-wallet"></i>Saldo Web</button>
      </div>
    </div>`;
}

async function selectPaymentMethod(method, amount) {
  if (method === 'balance') {
    if ((currentUser.balance || 0) < amount) { showToast('Saldo tidak cukup!', 'error'); return; }
    closeModal('paymentModal');
    await completeOrder('balance', amount);
    return;
  }
  const info = buildPaymentInfo(method, amount);
  document.getElementById('paymentContent').innerHTML = info;
}

function buildPaymentInfo(method, amount) {
  const bank = ownerSettings.bankName || 'BCA';
  const bankNo = ownerSettings.bankNo || '-';
  const bankOwner = ownerSettings.bankOwner || 'DOOMINIKS';
  const ewallet = ownerSettings.ewallet || '-';
  const dest = method === 'transfer' ? `${bank}: ${bankNo} a.n ${bankOwner}` : `E-Wallet: ${ewallet}`;

  return `
    <div class="payment-info-box">
      <div class="payment-info-row"><span class="label">Produk</span><span class="value">${currentProduct.name}</span></div>
      <div class="payment-info-row"><span class="label">Total</span><span class="value red">Rp ${fmtNum(amount)}</span></div>
    </div>
    <div class="payment-steps">
      <div class="payment-step"><div class="step-num">1</div><div class="step-txt">Transfer Rp ${fmtNum(amount)} ke:<br><strong>${dest}</strong> <button class="copy-btn" onclick="copyText('${method === 'transfer' ? bankNo : ewallet}')">Salin</button></div></div>
      <div class="payment-step"><div class="step-num">2</div><div class="step-txt">Simpan bukti transfer/screenshot pembayaran Anda.</div></div>
      <div class="payment-step"><div class="step-num">3</div><div class="step-txt">Klik tombol di bawah dan upload bukti pembayaran.</div></div>
    </div>
    <button class="btn-red full" onclick="proceedToProof('order','${currentProductId}','${currentProduct.name}',${amount},'${method}')"><i class="fas fa-upload"></i> Upload Bukti & Lanjutkan</button>
  `;
}

function proceedToProof(type, productId, productName, amount, method) {
  pendingProofContext = { type, productId, productName, amount, method };
  const box = document.getElementById('proofContext');
  box.innerHTML = `<div><strong>Produk:</strong> ${productName}</div><div><strong>Jumlah:</strong> Rp ${fmtNum(amount)}</div><div><strong>Metode:</strong> ${method}</div>`;
  closeModal('paymentModal');
  showModal('proofModal');
}

async function submitProof() {
  const file = document.getElementById('proofFile').files[0];
  if (!file) { showToast('Pilih file bukti terlebih dahulu!', 'error'); return; }
  if (!currentUser || !pendingProofContext) return;

  showToast('Mengupload bukti...', 'success');
  try {
    const base64 = await fileToBase64(file);
    const ctx = pendingProofContext;

    if (ctx.type === 'order') {
      const orderId = 'ORD-' + Date.now();
      if (appliedDiscount) await incrementDiscountUse(appliedDiscount.code);
      await fb.set(fb.ref(db, `orders/${orderId}`), {
        id: orderId,
        username: currentUser.username,
        productId: ctx.productId,
        productName: ctx.productName,
        amount: ctx.amount,
        currency: 'IDR',
        method: ctx.method,
        status: 'pending',
        proof: base64,
        createdAt: Date.now()
      });
      await logTransaction(currentUser.username, 'purchase_pending', ctx.amount, 'IDR', `Beli: ${ctx.productName}`);
    } else if (ctx.type === 'deposit') {
      const depId = 'DEP-' + Date.now();
      await fb.set(fb.ref(db, `deposits/${depId}`), {
        id: depId,
        username: currentUser.username,
        amount: ctx.amount,
        type: ctx.depositType || 'idr',
        method: ctx.method,
        status: 'pending',
        proof: base64,
        createdAt: Date.now()
      });
    }

    closeModal('proofModal');
    pendingProofContext = null;
    showToast('Bukti terkirim! Pesanan akan diproses oleh admin.', 'success');
    showSection('profile');
  } catch(e) { showToast('Gagal upload: ' + e.message, 'error'); }
}

async function completeOrder(method, amount) {
  try {
    const newBal = (currentUser.balance || 0) - amount;
    await fb.update(fb.ref(db, `users/${currentUser.username}`), { balance: newBal });
    await fb.update(fb.ref(db, `products/${currentProductId}`), { stock: Math.max(0, (currentProduct.stock || 0) - 1) });
    const orderId = 'ORD-' + Date.now();
    await fb.set(fb.ref(db, `orders/${orderId}`), {
      id: orderId,
      username: currentUser.username,
      productId: currentProductId,
      productName: currentProduct.name,
      amount,
      currency: 'IDR',
      method: 'balance',
      status: 'processing',
      createdAt: Date.now()
    });
    await logTransaction(currentUser.username, 'purchase', -amount, 'IDR', `Beli: ${currentProduct.name}`);
    if (appliedDiscount) await incrementDiscountUse(appliedDiscount.code);
    showToast('Pembelian berhasil!', 'success');
    showSection('profile');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function incrementDiscountUse(code) {
  try {
    const snap = await fb.get(fb.ref(db, `discounts/${code}`));
    if (snap.exists()) {
      await fb.update(fb.ref(db, `discounts/${code}`), { usedCount: (snap.val().usedCount || 0) + 1 });
    }
  } catch(e) {}
}

// ---- TOP UP ----
function processTopup() {
  const amount = parseInt(document.getElementById('topupAmount').value);
  if (!amount || amount < 10000) { showToast('Minimal top up Rp 10.000', 'error'); return; }
  closeModal('topupModal');
  showDepositPaymentModal(amount, 'idr');
}

function showDepositPaymentModal(amount, type) {
  const bank = ownerSettings.bankName || 'BCA';
  const bankNo = ownerSettings.bankNo || '-';
  const bankOwner = ownerSettings.bankOwner || 'DOOMINIKS';
  const ewallet = ownerSettings.ewallet || '-';
  const label = type === 'coin' ? `Koin` : `IDR`;

  document.getElementById('depositPayContent').innerHTML = `
    <div class="payment-info-box">
      <div class="payment-info-row"><span class="label">Top Up</span><span class="value">${fmtNum(amount)} ${label}</span></div>
    </div>
    <p style="font-size:13px;color:var(--text2);margin-bottom:12px">Pilih metode:</p>
    <div class="payment-method-grid">
      <button class="payment-method-btn" onclick="selectDepositMethod('transfer',${amount},'${type}')"><i class="fas fa-university"></i>Transfer Bank</button>
      <button class="payment-method-btn" onclick="selectDepositMethod('ewallet',${amount},'${type}')"><i class="fas fa-mobile-alt"></i>E-Wallet</button>
    </div>
  `;
  showModal('depositPayModal');
}

function selectDepositMethod(method, amount, type) {
  const bank = ownerSettings.bankName || 'BCA';
  const bankNo = ownerSettings.bankNo || '-';
  const bankOwner = ownerSettings.bankOwner || 'DOOMINIKS';
  const ewallet = ownerSettings.ewallet || '-';
  const dest = method === 'transfer' ? `${bank}: ${bankNo} a.n ${bankOwner}` : `E-Wallet: ${ewallet}`;

  document.getElementById('depositPayContent').innerHTML = `
    <div class="payment-info-box">
      <div class="payment-info-row"><span class="label">Jumlah</span><span class="value red">Rp ${fmtNum(amount)}</span></div>
    </div>
    <div class="payment-steps">
      <div class="payment-step"><div class="step-num">1</div><div class="step-txt">Transfer ke: <strong>${dest}</strong> <button class="copy-btn" onclick="copyText('${method==='transfer'?bankNo:ewallet}')">Salin</button></div></div>
      <div class="payment-step"><div class="step-num">2</div><div class="step-txt">Simpan bukti pembayaran.</div></div>
      <div class="payment-step"><div class="step-num">3</div><div class="step-txt">Upload bukti di bawah.</div></div>
    </div>
    <button class="btn-red full" onclick="proceedDepositProof(${amount},'${type}','${method}')"><i class="fas fa-upload"></i> Upload Bukti</button>
  `;
}

function proceedDepositProof(amount, type, method) {
  pendingProofContext = { type: 'deposit', depositType: type, amount, method };
  const box = document.getElementById('proofContext');
  box.innerHTML = `<div><strong>Top Up:</strong> ${type === 'coin' ? fmtNum(amount) + ' Koin' : 'Rp ' + fmtNum(amount)}</div><div><strong>Metode:</strong> ${method}</div>`;
  closeModal('depositPayModal');
  showModal('proofModal');
}

// ---- COIN TOP UP ----
function showCoinTopup() {
  const packages = [
    { coins: 100, price: 10000 }, { coins: 250, price: 23000 },
    { coins: 500, price: 45000 }, { coins: 1000, price: 85000 },
    { coins: 2500, price: 200000 }, { coins: 5000, price: 380000 }
  ];
  document.getElementById('coinPackages').innerHTML = packages.map(pkg => `
    <div class="coin-pkg" onclick="buyCoinPackage(${pkg.coins},${pkg.price})">
      <div class="coin-pkg-amount">${fmtNum(pkg.coins)}</div>
      <div class="coin-pkg-label">Koin</div>
      <div class="coin-pkg-price">Rp ${fmtNum(pkg.price)}</div>
    </div>
  `).join('');
}

function buyCoinPackage(coins, price) {
  closeModal('topupCoinModal');
  pendingProofContext = { type: 'deposit', depositType: 'coin', amount: coins, idrAmount: price };
  showDepositPaymentModal(price, 'coin');
}

// ---- PROFILE ----
async function renderProfile() {
  if (!currentUser) return;
  document.getElementById('profileUsername').textContent = currentUser.username;
  document.getElementById('profileBalance').textContent = 'Rp ' + fmtNum(currentUser.balance || 0);
  document.getElementById('profileCoins').textContent = fmtNum(currentUser.coins || 0);

  const badges = currentUser.badges || [];
  if (currentUser.isOwner) badges.unshift('owner');
  document.getElementById('profileBadgeList').innerHTML = badges.map(b => badgeHTML(b)).join('');

  await renderProfileOrders();
  await renderProfileTransactions();
}

async function renderProfileOrders() {
  const el = document.getElementById('profileOrders');
  if (!el) return;
  try {
    const snap = await fb.get(fb.ref(db, 'orders'));
    if (!snap.exists()) { el.innerHTML = emptyState('Belum ada pesanan'); return; }
    const orders = Object.entries(snap.val())
      .filter(([, o]) => o.username === currentUser.username)
      .sort(([, a], [, b]) => b.createdAt - a.createdAt);
    if (!orders.length) { el.innerHTML = emptyState('Belum ada pesanan'); return; }
    el.innerHTML = orders.map(([id, o]) => `
      <div class="order-card">
        <div class="order-header">
          <span class="order-id">${o.id || id}</span>
          <span class="order-status status-${o.status}">${statusLabel(o.status)}</span>
        </div>
        <div class="order-product">${o.productName}</div>
        <div class="order-price">${o.currency === 'COIN' ? fmtNum(o.amount)+' Koin' : 'Rp '+fmtNum(o.amount)} • ${o.method||'coin'} • ${timeAgo(o.createdAt)}</div>
        <div class="order-actions">
          ${o.status === 'sent' ? `<button class="btn-red small" onclick="confirmReceived('${id}')">Pesanan Diterima</button>` : ''}
          ${o.status === 'completed' && !o.reviewed ? `<button class="btn-outline small" onclick="openReviewModal('${id}','${o.productId}')">Beri Ulasan</button>` : ''}
        </div>
      </div>
    `).join('');
  } catch(e) { el.innerHTML = emptyState('Error memuat pesanan'); }
}

async function renderProfileTransactions() {
  const el = document.getElementById('profileTransactions');
  if (!el) return;
  try {
    const snap = await fb.get(fb.ref(db, `transactions/${currentUser.username}`));
    if (!snap.exists()) { el.innerHTML = emptyState('Belum ada transaksi'); return; }
    const txs = Object.entries(snap.val()).sort(([, a], [, b]) => b.createdAt - a.createdAt);
    el.innerHTML = txs.map(([, t]) => `
      <div class="order-card">
        <div class="order-header">
          <span class="order-id">${t.note}</span>
          <span style="font-weight:700;color:${t.amount > 0 ? '#00c864' : 'var(--red)'}">
            ${t.amount > 0 ? '+' : ''}${fmtNum(t.amount)} ${t.currency}
          </span>
        </div>
        <div class="order-price">${timeAgo(t.createdAt)}</div>
      </div>
    `).join('');
  } catch(e) { el.innerHTML = emptyState('Error'); }
}

function switchProfileTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('profile' + cap(tab)).classList.add('active');
  if (tab === 'transactions') renderProfileTransactions();
}

async function confirmReceived(orderId) {
  try {
    await fb.update(fb.ref(db, `orders/${orderId}`), { status: 'completed' });
    showToast('Pesanan telah diterima!', 'success');
    renderProfileOrders();
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

// ---- REVIEWS ----
async function loadReviews() {
  fb.onValue(fb.ref(db, 'reviews'), snap => {
    renderHomeReviews(snap.exists() ? snap.val() : {});
    updateStats();
  });
}

function renderHomeReviews(reviews) {
  const el = document.getElementById('homeReviews');
  if (!el) return;
  const list = Object.entries(reviews).slice(0, 6);
  if (!list.length) { el.innerHTML = emptyState('Belum ada ulasan'); return; }
  el.innerHTML = list.map(([, r]) => reviewCardHTML(r)).join('');
}

async function renderAllReviews() {
  const el = document.getElementById('allReviews');
  const summaryEl = document.getElementById('reviewSummary');
  if (!el) return;
  const snap = await fb.get(fb.ref(db, 'reviews'));
  if (!snap.exists()) { el.innerHTML = emptyState('Belum ada ulasan'); return; }
  const list = Object.entries(snap.val()).sort(([, a], [, b]) => b.createdAt - a.createdAt);
  el.innerHTML = list.map(([, r]) => reviewCardHTML(r)).join('');
  const avg = list.reduce((s, [, r]) => s + (r.rating || 5), 0) / list.length;
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="review-avg">
        <div class="review-avg-num">${avg.toFixed(1)}</div>
        <div class="review-avg-stars">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5-Math.round(avg))}</div>
        <div style="font-size:13px;color:var(--text3)">${list.length} ulasan</div>
      </div>
    `;
  }
}

function reviewCardHTML(r) {
  return `<div class="review-card">
    <div class="review-header">
      <div class="review-avatar">${r.username[0].toUpperCase()}</div>
      <div class="review-meta">
        <div class="review-name">${r.username} ${(r.badges||[]).map(badgeHTML).join('')}</div>
        <div class="review-date">${timeAgo(r.createdAt)}</div>
      </div>
    </div>
    <div class="review-stars">${'★'.repeat(r.rating||5)}${'☆'.repeat(5-(r.rating||5))}</div>
    <div class="review-text">${escHtml(r.text)}</div>
    ${r.productName ? `<div class="review-product"><i class="fas fa-box"></i> ${r.productName}</div>` : ''}
  </div>`;
}

function openReviewModal(orderId, productId) {
  document.getElementById('reviewOrderId').value = orderId;
  document.getElementById('reviewProductId').value = productId;
  document.getElementById('reviewText').value = '';
  currentRating = 0;
  updateStarDisplay(0);
  showModal('reviewModal');
}

function setRating(r) { currentRating = r; updateStarDisplay(r); }

function updateStarDisplay(r) {
  document.querySelectorAll('#starInput i').forEach((s, i) => {
    s.className = i < r ? 'fas fa-star' : 'far fa-star';
    s.style.color = i < r ? 'var(--gold)' : 'var(--border)';
  });
}

async function submitReview() {
  if (!currentUser) return;
  if (!currentRating) { showToast('Pilih rating dahulu!', 'error'); return; }
  const text = document.getElementById('reviewText').value.trim();
  if (!text) { showToast('Tulis ulasan dahulu!', 'error'); return; }
  const orderId = document.getElementById('reviewOrderId').value;
  const productId = document.getElementById('reviewProductId').value;
  const product = allProducts[productId];
  try {
    const revId = 'REV-' + Date.now();
    await fb.set(fb.ref(db, `reviews/${revId}`), {
      username: currentUser.username,
      badges: currentUser.badges || [],
      rating: currentRating,
      text,
      productId,
      productName: product?.name || '',
      createdAt: Date.now()
    });
    if (orderId) await fb.update(fb.ref(db, `orders/${orderId}`), { reviewed: true });
    closeModal('reviewModal');
    showToast('Ulasan berhasil dikirim!', 'success');
    renderProfileOrders();
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

// ---- CHAT ----
function openChatModal() {
  if (!currentUser) { showModal('loginModal'); return; }
  showModal('chatModal');
  loadCustomerChat();
}

function loadCustomerChat() {
  const messagesEl = document.getElementById('chatMessages');
  if (!messagesEl) return;
  const chatRef = fb.ref(db, `chats/${currentUser.username}`);
  fb.onValue(chatRef, snap => {
    if (!snap.exists()) { messagesEl.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:13px;padding:20px">Belum ada pesan. Mulai chat!</div>'; return; }
    const msgs = Object.values(snap.val()).sort((a, b) => a.createdAt - b.createdAt);
    messagesEl.innerHTML = msgs.map(m => `
      <div class="chat-bubble ${m.sender === currentUser.username ? 'mine' : 'theirs'}">
        ${escHtml(m.text)}
        <span class="chat-time">${timeAgo(m.createdAt)}</span>
      </div>
    `).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

async function sendChatMsg() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !currentUser) return;
  input.value = '';
  try {
    await fb.push(fb.ref(db, `chats/${currentUser.username}`), {
      sender: currentUser.username,
      text, createdAt: Date.now()
    });
  } catch(e) { showToast('Gagal kirim: '+e.message, 'error'); }
}

// ---- OWNER: CHAT ----
function loadOwnerChats() {
  const listEl = document.getElementById('chatUserList');
  fb.onValue(fb.ref(db, 'chats'), snap => {
    if (!snap.exists()) { listEl.innerHTML = '<div class="chat-user-item" style="color:var(--text3)">Belum ada chat</div>'; return; }
    const users = Object.keys(snap.val());
    listEl.innerHTML = users.map(u => `<div class="chat-user-item" onclick="openOwnerChat('${u}')">${u}</div>`).join('');
  });
}

function openOwnerChat(username) {
  chatActivePeer = username;
  document.querySelectorAll('.chat-user-item').forEach(el => el.classList.toggle('active', el.textContent === username));
  const win = document.getElementById('chatOwnerWindow');
  win.innerHTML = `
    <div class="chat-owner-msgs" id="ownerChatMsgs"></div>
    <div class="chat-owner-input">
      <input type="text" id="ownerChatInput" class="form-input" placeholder="Balas ke ${username}..." onkeydown="if(event.key==='Enter')sendOwnerChat()"/>
      <button class="btn-red" onclick="sendOwnerChat()"><i class="fas fa-paper-plane"></i></button>
    </div>
  `;
  const msgsEl = document.getElementById('ownerChatMsgs');
  fb.onValue(fb.ref(db, `chats/${username}`), snap => {
    if (!snap.exists()) return;
    const msgs = Object.values(snap.val()).sort((a, b) => a.createdAt - b.createdAt);
    msgsEl.innerHTML = msgs.map(m => `
      <div class="chat-bubble ${m.sender === username ? 'theirs' : 'mine'}">
        ${escHtml(m.text)}<span class="chat-time">${timeAgo(m.createdAt)}</span>
      </div>
    `).join('');
    msgsEl.scrollTop = msgsEl.scrollHeight;
  });
}

async function sendOwnerChat() {
  const input = document.getElementById('ownerChatInput');
  const text = input.value.trim();
  if (!text || !chatActivePeer) return;
  input.value = '';
  try {
    await fb.push(fb.ref(db, `chats/${chatActivePeer}`), {
      sender: 'Owner',
      text, createdAt: Date.now()
    });
  } catch(e) {}
}

// ---- OWNER DASHBOARD ----
async function loadOwnerDashboard() {
  switchOwnerTab('dashboard');
  // Stats
  const prodsSnap = await fb.get(fb.ref(db, 'products'));
  const ordersSnap = await fb.get(fb.ref(db, 'orders'));
  const usersSnap = await fb.get(fb.ref(db, 'users'));
  const prods = prodsSnap.exists() ? prodsSnap.val() : {};
  const orders = ordersSnap.exists() ? ordersSnap.val() : {};
  const users = usersSnap.exists() ? usersSnap.val() : {};
  document.getElementById('dashProducts').textContent = Object.keys(prods).length;
  document.getElementById('dashOrders').textContent = Object.keys(orders).length;
  document.getElementById('dashUsers').textContent = Object.keys(users).length;
  const revenue = Object.values(orders).filter(o => o.status === 'completed' && o.currency === 'IDR').reduce((s, o) => s + (o.amount||0), 0);
  document.getElementById('dashRevenue').textContent = 'Rp '+fmtNum(revenue);

  // Pending orders
  const pendingEl = document.getElementById('pendingOrdersList');
  const pending = Object.entries(orders).filter(([, o]) => o.status === 'pending');
  if (!pending.length) { pendingEl.innerHTML = '<div style="color:var(--text3);font-size:13px">Tidak ada pesanan menunggu.</div>'; }
  else {
    pendingEl.innerHTML = pending.map(([id, o]) => `
      <div class="pending-order-item">
        <div class="pending-order-header">
          <div><div style="font-weight:700">${o.username} — ${o.productName}</div><div style="font-size:12px;color:var(--text3)">Rp ${fmtNum(o.amount)} • ${timeAgo(o.createdAt)} • ${o.id}</div></div>
          <span class="order-status status-pending">Menunggu</span>
        </div>
        ${o.proof ? `<div><img src="${o.proof}" class="proof-thumbnail proof-expand" onclick="expandProof('${o.proof}')" title="Lihat bukti"/></div>` : '<div style="font-size:12px;color:var(--text3)">Bukti belum diunggah</div>'}
        <div class="order-actions-owner">
          <button class="btn-red small" onclick="approveOrder('${id}')"><i class="fas fa-check"></i> Setujui</button>
          <button class="btn-ghost small" onclick="rejectOrder('${id}')"><i class="fas fa-times"></i> Tolak</button>
        </div>
      </div>
    `).join('');
  }

  // Pending deposits
  const depSnap = await fb.get(fb.ref(db, 'deposits'));
  const deps = depSnap.exists() ? depSnap.val() : {};
  const pendingDepsEl = document.getElementById('pendingDepositsList');
  const pendingDeps = Object.entries(deps).filter(([, d]) => d.status === 'pending');
  if (!pendingDeps.length) { pendingDepsEl.innerHTML = '<div style="color:var(--text3);font-size:13px">Tidak ada deposit menunggu.</div>'; }
  else {
    pendingDepsEl.innerHTML = pendingDeps.map(([id, d]) => `
      <div class="pending-order-item">
        <div class="pending-order-header">
          <div><div style="font-weight:700">${d.username} — ${d.type === 'coin' ? fmtNum(d.amount)+' Koin' : 'Rp '+fmtNum(d.amount)}</div><div style="font-size:12px;color:var(--text3)">${timeAgo(d.createdAt)} • ${d.id}</div></div>
          <span class="order-status status-pending">Deposit</span>
        </div>
        ${d.proof ? `<img src="${d.proof}" class="proof-thumbnail proof-expand" onclick="expandProof('${d.proof}')" title="Lihat bukti"/>` : ''}
        <div class="order-actions-owner">
          <button class="btn-red small" onclick="approveDeposit('${id}','${d.username}',${d.amount},'${d.type}')"><i class="fas fa-check"></i> Approve</button>
          <button class="btn-ghost small" onclick="rejectDeposit('${id}')"><i class="fas fa-times"></i> Tolak</button>
        </div>
      </div>
    `).join('');
  }
}

async function approveOrder(orderId) {
  try {
    const snap = await fb.get(fb.ref(db, `orders/${orderId}`));
    if (!snap.exists()) return;
    const o = snap.val();
    await fb.update(fb.ref(db, `products/${o.productId}`), { stock: Math.max(0, (allProducts[o.productId]?.stock || 1) - 1) });
    await fb.update(fb.ref(db, `orders/${orderId}`), { status: 'sent' });
    await logTransaction(o.username, 'purchase', -o.amount, o.currency, `Beli: ${o.productName}`);
    showToast('Pesanan disetujui & dikirim!', 'success');
    loadOwnerDashboard();
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

async function rejectOrder(orderId) {
  try {
    await fb.update(fb.ref(db, `orders/${orderId}`), { status: 'cancelled' });
    showToast('Pesanan ditolak.', 'success');
    loadOwnerDashboard();
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

async function approveDeposit(depId, username, amount, type) {
  try {
    const userSnap = await fb.get(fb.ref(db, `users/${username}`));
    if (!userSnap.exists()) return;
    const userData = userSnap.val();
    if (type === 'coin') {
      await fb.update(fb.ref(db, `users/${username}`), { coins: (userData.coins || 0) + amount });
      await logTransaction(username, 'deposit_coin', amount, 'COIN', `Top Up ${fmtNum(amount)} Koin`);
    } else {
      await fb.update(fb.ref(db, `users/${username}`), { balance: (userData.balance || 0) + amount });
      await logTransaction(username, 'deposit', amount, 'IDR', `Top Up Rp ${fmtNum(amount)}`);
    }
    await fb.update(fb.ref(db, `deposits/${depId}`), { status: 'completed' });
    showToast('Deposit disetujui!', 'success');
    loadOwnerDashboard();
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

async function rejectDeposit(depId) {
  try {
    await fb.update(fb.ref(db, `deposits/${depId}`), { status: 'rejected' });
    showToast('Deposit ditolak.', 'success');
    loadOwnerDashboard();
  } catch(e) {}
}

function expandProof(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;cursor:pointer';
  overlay.innerHTML = `<img src="${src}" style="max-width:90%;max-height:90%;border-radius:10px"/>`;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}

// ---- OWNER: PRODUCTS ----
async function renderOwnerProducts() {
  const el = document.getElementById('ownerProductsList');
  if (!el) return;
  const list = Object.entries(allProducts);
  if (!list.length) { el.innerHTML = emptyState('Belum ada produk'); return; }
  el.innerHTML = list.map(([id, p]) => `
    <div class="owner-product-item">
      ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}"/>` : `<div style="width:60px;height:45px;background:var(--bg3);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--text3)"><i class="fas fa-image"></i></div>`}
      <div class="owner-product-info">
        <div class="owner-product-name">${p.name}</div>
        <div class="owner-product-meta">Rp ${fmtNum(p.price)} • ${p.coinPrice||0} Koin • Stok: ${p.stock} • ${p.category||'Umum'}</div>
      </div>
      <div class="owner-product-actions">
        <button class="btn-ghost small" onclick="editProduct('${id}')"><i class="fas fa-edit"></i></button>
        <button class="btn-red small" onclick="deleteProduct('${id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function editProduct(id) {
  const p = allProducts[id];
  if (!p) return;
  document.getElementById('editProductId').value = id;
  document.getElementById('addProdTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Produk';
  document.getElementById('prodName').value = p.name;
  document.getElementById('prodCategory').value = p.category || '';
  document.getElementById('prodPrice').value = p.price;
  document.getElementById('prodCoinPrice').value = p.coinPrice || '';
  document.getElementById('prodStock').value = p.stock;
  document.getElementById('prodDesc').value = p.description || '';
  showModal('addProductModal');
}

async function saveProduct() {
  const id = document.getElementById('editProductId').value;
  const name = document.getElementById('prodName').value.trim();
  const category = document.getElementById('prodCategory').value.trim();
  const price = parseInt(document.getElementById('prodPrice').value);
  const coinPrice = parseInt(document.getElementById('prodCoinPrice').value);
  const stock = parseInt(document.getElementById('prodStock').value);
  const desc = document.getElementById('prodDesc').value.trim();
  const imageFile = document.getElementById('prodImage').files[0];

  if (!name || !price || !stock) { showToast('Isi field wajib!', 'error'); return; }

  let imageUrl = id ? (allProducts[id]?.imageUrl || '') : '';

  if (imageFile) {
    showToast('Mengupload gambar...', 'success');
    try {
      const storage = window._storage;
      const storageRef = fb.sRef(storage, `products/${Date.now()}_${imageFile.name}`);
      await fb.uploadBytes(storageRef, imageFile);
      imageUrl = await fb.getDownloadURL(storageRef);
    } catch(e) {
      // If storage fails, use base64 fallback
      imageUrl = await fileToBase64(imageFile);
    }
  }

  const data = { name, category, price, coinPrice, stock, description: desc, imageUrl };
  const prodId = id || ('prod-' + Date.now());
  try {
    await fb.set(fb.ref(db, `products/${prodId}`), data);
    closeModal('addProductModal');
    document.getElementById('editProductId').value = '';
    document.getElementById('addProdTitle').innerHTML = '<i class="fas fa-plus"></i> Tambah Produk';
    document.getElementById('prodImage').value = '';
    showToast('Produk disimpan!', 'success');
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

async function deleteProduct(id) {
  if (!confirm('Hapus produk ini?')) return;
  try {
    await fb.remove(fb.ref(db, `products/${id}`));
    showToast('Produk dihapus!', 'success');
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

// ---- OWNER: ORDER LOG ----
async function renderOrderLog() {
  const el = document.getElementById('orderLogList');
  const snap = await fb.get(fb.ref(db, 'orders'));
  if (!snap.exists()) { el.innerHTML = emptyState('Belum ada pesanan'); return; }
  const orders = Object.entries(snap.val()).sort(([, a], [, b]) => b.createdAt - a.createdAt);
  el.innerHTML = orders.map(([id, o]) => `
    <div class="order-log-item">
      <div class="order-log-header">
        <div>
          <div style="font-weight:700">${o.productName} <span class="order-status status-${o.status}">${statusLabel(o.status)}</span></div>
          <div style="font-size:12px;color:var(--text3)">${o.username} • ${o.currency==='COIN'?fmtNum(o.amount)+' Koin':'Rp '+fmtNum(o.amount)} • ${timeAgo(o.createdAt)}</div>
          <div style="font-size:11px;color:var(--text3)">${o.id || id}</div>
        </div>
      </div>
      ${o.proof ? `<img src="${o.proof}" class="proof-thumbnail proof-expand" onclick="expandProof('${o.proof}')"/>` : ''}
      <div class="order-actions-owner">
        ${o.status === 'pending' ? `<button class="btn-red small" onclick="approveOrder('${id}')">Setujui</button><button class="btn-ghost small" onclick="rejectOrder('${id}')">Tolak</button>` : ''}
        ${o.status === 'processing' ? `<button class="btn-red small" onclick="markSent('${id}')">Tandai Dikirim</button>` : ''}
      </div>
    </div>
  `).join('');
}

async function markSent(orderId) {
  try {
    await fb.update(fb.ref(db, `orders/${orderId}`), { status: 'sent' });
    showToast('Pesanan ditandai dikirim!', 'success');
    renderOrderLog();
  } catch(e) {}
}

// ---- OWNER: TX HISTORY ----
async function renderTxHistory() {
  const el = document.getElementById('txHistoryList');
  const snap = await fb.get(fb.ref(db, 'transactions'));
  if (!snap.exists()) { el.innerHTML = emptyState('Belum ada transaksi'); return; }
  const allTx = [];
  Object.entries(snap.val()).forEach(([user, txs]) => {
    Object.entries(txs).forEach(([, t]) => allTx.push({ ...t, user }));
  });
  allTx.sort((a, b) => b.createdAt - a.createdAt);
  el.innerHTML = allTx.slice(0, 100).map(t => `
    <div class="order-card">
      <div class="order-header">
        <span style="font-weight:700">${t.user}</span>
        <span style="font-weight:700;color:${t.amount>0?'#00c864':'var(--red)'}">${t.amount>0?'+':''}${fmtNum(t.amount)} ${t.currency}</span>
      </div>
      <div class="order-price">${t.note} • ${timeAgo(t.createdAt)}</div>
    </div>
  `).join('');
}

// ---- OWNER: DISCOUNTS ----
async function renderDiscounts() {
  const el = document.getElementById('discountList');
  const snap = await fb.get(fb.ref(db, 'discounts'));
  if (!snap.exists()) { el.innerHTML = emptyState('Belum ada kode diskon'); return; }
  const list = Object.entries(snap.val());
  el.innerHTML = list.map(([code, d]) => `
    <div class="discount-item">
      <div>
        <div class="discount-code">${code}</div>
        <div class="discount-meta">-${d.percent}% • Dipakai: ${d.usedCount||0}/${d.limit} kali</div>
      </div>
      <button class="btn-ghost small" onclick="deleteDiscount('${code}')"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
}

async function saveDiscount() {
  const code = document.getElementById('discCodeInput').value.trim().toUpperCase();
  const percent = parseInt(document.getElementById('discPercent').value);
  const limit = parseInt(document.getElementById('discLimit').value) || 100;
  if (!code || !percent) { showToast('Isi semua field!', 'error'); return; }
  try {
    await fb.set(fb.ref(db, `discounts/${code}`), { percent, limit, usedCount: 0 });
    closeModal('addDiscountModal');
    showToast('Kode diskon disimpan!', 'success');
    renderDiscounts();
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

async function deleteDiscount(code) {
  if (!confirm('Hapus kode diskon ini?')) return;
  await fb.remove(fb.ref(db, `discounts/${code}`));
  showToast('Kode dihapus!', 'success');
  renderDiscounts();
}

// ---- OWNER: BADGE ----
function selectBadge(badge) {
  selectedBadge = badge;
  document.querySelectorAll('.badge-opt').forEach(el => el.classList.toggle('selected', el.dataset.badge === badge));
}

async function giftBadge() {
  const username = document.getElementById('badgeTargetUser').value.trim();
  if (!username || !selectedBadge) { showToast('Isi username & pilih badge!', 'error'); return; }
  try {
    const snap = await fb.get(fb.ref(db, `users/${username}`));
    if (!snap.exists()) { showToast('User tidak ditemukan!', 'error'); return; }
    const badges = snap.val().badges || [];
    if (!badges.includes(selectedBadge)) badges.push(selectedBadge);
    await fb.update(fb.ref(db, `users/${username}`), { badges });
    showToast(`Badge ${selectedBadge} diberikan ke ${username}!`, 'success');
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

async function revokeBadge() {
  const username = document.getElementById('revokeBadgeUser').value.trim();
  const badge = document.getElementById('revokeBadgeName').value.trim().toLowerCase();
  if (!username || !badge) { showToast('Isi username & nama badge!', 'error'); return; }
  try {
    const snap = await fb.get(fb.ref(db, `users/${username}`));
    if (!snap.exists()) { showToast('User tidak ditemukan!', 'error'); return; }
    const badges = (snap.val().badges || []).filter(b => b !== badge);
    await fb.update(fb.ref(db, `users/${username}`), { badges });
    showToast('Badge dicabut!', 'success');
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

// ---- OWNER: SETTINGS ----
async function saveOwnerAccount() {
  const username = document.getElementById('setOwnerUsername').value.trim();
  const oldPass = document.getElementById('setOwnerPassOld').value;
  const newPass = document.getElementById('setOwnerPassNew').value;

  const currentPass = ownerSettings.ownerPassword || DEFAULT_OWNER_PASS;
  if (oldPass && oldPass !== currentPass) { showToast('Password lama salah!', 'error'); return; }

  const updates = {};
  if (username) updates.ownerUsername = username;
  if (newPass) updates.ownerPassword = newPass;

  try {
    await fb.update(fb.ref(db, 'settings'), updates);
    ownerSettings = { ...ownerSettings, ...updates };
    showToast('Akun owner disimpan!', 'success');
    document.getElementById('setOwnerPassOld').value = '';
    document.getElementById('setOwnerPassNew').value = '';
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

async function savePaymentSettings() {
  const updates = {
    bankName: document.getElementById('setBankName').value.trim(),
    bankNo: document.getElementById('setBankNo').value.trim(),
    bankOwner: document.getElementById('setBankOwner').value.trim(),
    ewallet: document.getElementById('setEwallet').value.trim()
  };
  try {
    await fb.update(fb.ref(db, 'settings'), updates);
    ownerSettings = { ...ownerSettings, ...updates };
    showToast('Pengaturan pembayaran disimpan!', 'success');
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

async function saveDiscordLink() {
  const link = document.getElementById('setDiscordLink').value.trim();
  try {
    await fb.update(fb.ref(db, 'settings'), { discordLink: link });
    ownerSettings.discordLink = link;
    showToast('Link Discord disimpan!', 'success');
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

async function loadOwnerReviews() {
  const el = document.getElementById('ownerReviewsList');
  const snap = await fb.get(fb.ref(db, 'reviews'));
  if (!snap.exists()) { el.innerHTML = emptyState('Belum ada ulasan'); return; }
  const list = Object.entries(snap.val());
  el.innerHTML = list.map(([id, r]) => `
    <div class="owner-review-item">
      <div><strong>${r.username}</strong>: ${r.text.substring(0, 50)}...</div>
      <button class="btn-ghost small" onclick="deleteReview('${id}')"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
}

async function deleteReview(id) {
  if (!confirm('Hapus ulasan ini?')) return;
  await fb.remove(fb.ref(db, `reviews/${id}`));
  showToast('Ulasan dihapus!', 'success');
  loadOwnerReviews();
}

// ---- OWNER TAB SWITCH ----
function switchOwnerTab(tab) {
  document.querySelectorAll('.owner-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.owner-tab-content').forEach(el => el.classList.remove('active'));
  event?.target?.classList.add('active');
  const content = document.getElementById('tab-' + tab);
  if (content) content.classList.add('active');

  if (tab === 'manageProducts') renderOwnerProducts();
  if (tab === 'orderLog') renderOrderLog();
  if (tab === 'txHistory') renderTxHistory();
  if (tab === 'discounts') renderDiscounts();
  if (tab === 'chatOwner') loadOwnerChats();
  if (tab === 'ownerSettings') loadOwnerReviews();
  if (tab === 'dashboard') loadOwnerDashboard();
}

// ---- STATS ----
async function updateStats() {
  const prods = Object.keys(allProducts).length;
  document.getElementById('statProducts').textContent = prods;
  try {
    const ordSnap = await fb.get(fb.ref(db, 'orders'));
    document.getElementById('statOrders').textContent = ordSnap.exists() ? Object.keys(ordSnap.val()).length : 0;
    const revSnap = await fb.get(fb.ref(db, 'reviews'));
    document.getElementById('statReviews').textContent = revSnap.exists() ? Object.keys(revSnap.val()).length : 0;
  } catch(e) {}
}

// ---- TRANSACTION LOG ----
async function logTransaction(username, type, amount, currency, note) {
  try {
    await fb.push(fb.ref(db, `transactions/${username}`), {
      type, amount, currency, note, createdAt: Date.now()
    });
  } catch(e) {}
}

// ---- MODALS ----
function showModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
  if (id === 'topupCoinModal') showCoinTopup();
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
function closeModalOut(e, id) {
  if (e.target.id === id) closeModal(id);
}
function swapModal(from, to) { closeModal(from); showModal(to); }

// ---- TOAST ----
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.className = `toast show ${type}`;
  el.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i><span>${msg}</span>`;
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ---- HELPERS ----
function fmtNum(n) { return Number(n || 0).toLocaleString('id-ID'); }
function timeAgo(ts) {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 60000) return 'baru saja';
  if (d < 3600000) return Math.floor(d/60000) + ' mnt lalu';
  if (d < 86400000) return Math.floor(d/3600000) + ' jam lalu';
  return Math.floor(d/86400000) + ' hari lalu';
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function escHtml(t) { return (t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function emptyState(msg) { return `<div class="empty-state"><i class="fas fa-inbox"></i><p>${msg}</p></div>`; }
function statusLabel(s) { return { pending:'Menunggu', processing:'Diproses', sent:'Dikirim', completed:'Selesai', cancelled:'Dibatalkan' }[s] || s; }
function badgeHTML(b) {
  const map = { owner:'👑 Owner', warrior:'⚔️ Warrior', elite:'💎 Elite', master:'🏆 Master', grandmaster:'👑 Grandmaster', mythical:'🌟 Mythical' };
  return `<span class="badge badge-${b}">${map[b]||b}</span>`;
}
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Disalin!', 'success'));
}
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ---- INIT OWNER PANEL TAB CLICK ----
document.querySelectorAll('.owner-tab').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.owner-tab').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});

// ---- EXPOSE GLOBALS ----
window.showSection = showSection;
window.showModal = showModal;
window.closeModal = closeModal;
window.closeModalOut = closeModalOut;
window.swapModal = swapModal;
window.loginUser = loginUser;
window.registerUser = registerUser;
window.logoutUser = logoutUser;
window.openProduct = openProduct;
window.filterProducts = filterProducts;
window.applyDiscount = applyDiscount;
window.buyWithIDR = buyWithIDR;
window.buyWithCoin = buyWithCoin;
window.selectPaymentMethod = selectPaymentMethod;
window.proceedToProof = proceedToProof;
window.submitProof = submitProof;
window.processTopup = processTopup;
window.selectDepositMethod = selectDepositMethod;
window.proceedDepositProof = proceedDepositProof;
window.buyCoinPackage = buyCoinPackage;
window.switchProfileTab = switchProfileTab;
window.confirmReceived = confirmReceived;
window.openReviewModal = openReviewModal;
window.setRating = setRating;
window.submitReview = submitReview;
window.sendChatMsg = sendChatMsg;
window.sendOwnerChat = sendOwnerChat;
window.openOwnerChat = openOwnerChat;
window.switchOwnerTab = switchOwnerTab;
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.approveOrder = approveOrder;
window.rejectOrder = rejectOrder;
window.markSent = markSent;
window.approveDeposit = approveDeposit;
window.rejectDeposit = rejectDeposit;
window.expandProof = expandProof;
window.saveDiscount = saveDiscount;
window.deleteDiscount = deleteDiscount;
window.selectBadge = selectBadge;
window.giftBadge = giftBadge;
window.revokeBadge = revokeBadge;
window.saveOwnerAccount = saveOwnerAccount;
window.savePaymentSettings = savePaymentSettings;
window.saveDiscordLink = saveDiscordLink;
window.deleteReview = deleteReview;
window.openDiscord = openDiscord;
window.toggleMobileMenu = toggleMobileMenu;
window.copyText = copyText;
window.showOwnerPanel = showOwnerPanel;
window.loadOwnerDashboard = loadOwnerDashboard;
