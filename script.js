/* ===================================================
   DOOMINIKS STORE - script.js
   Firebase Realtime Database + Firestore + Storage
   =================================================== */

// ============ FIREBASE CONFIG ============
// GANTI DENGAN KONFIGURASI FIREBASE KAMU
const firebaseConfig = {
  apiKey: "AIzaSyAuZLwwomxlNUjcPp4JYILdSz4EAWtoRxY",
  authDomain: "dooniniks-paradise.firebaseapp.com",
  databaseURL: "https://dooniniks-paradise-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dooniniks-paradise",
  storageBucket: "dooniniks-paradise.firebasestorage.app",
  messagingSenderId: "140802324914",
  appId: "1:140802324914:web:0bf5330384553d6d40ccab"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const firestore = firebase.firestore();
const storage = firebase.storage();

// ============ CONSTANTS ============
const OWNER_USERNAME = "DOOMINIKS"; // Username owner
const COIN_RATE = 1000; // 1 coin = Rp 1.000
const TOPUP_PACKAGES = [
  { coins: 50, price: 50000, bonus: 0 },
  { coins: 100, price: 95000, bonus: 5 },
  { coins: 250, price: 220000, bonus: 30 },
  { coins: 500, price: 425000, bonus: 75 },
  { coins: 1000, price: 800000, bonus: 200 },
  { coins: 2500, price: 1800000, bonus: 700 },
];
const BADGES = ['warrior','elite','master','grandmaster','mythical'];
const BADGE_ICONS = {
  owner: '👑', warrior: '⚔️', elite: '💎', master: '🔮', grandmaster: '🔥', mythical: '✨'
};

// ============ STATE ============
let currentUser = null;
let currentUserData = null;
let allProducts = [];
let selectedPayMethod = null;
let selectedTopupPkg = null;
let selectedReviewRating = 5;
let selectedBadge = null;
let currentOwnerTab = 'products';
let ownerChatTarget = null;
let chatUnsubscribe = null;
let currentOrderForReview = null;
let editingProductId = null;

// ============ LOADING SCREEN ============
const loadingMessages = [
  "Initializing systems...",
  "Loading database...",
  "Fetching products...",
  "Preparing store...",
  "Almost ready..."
];

function runLoadingScreen(callback) {
  const bar = document.getElementById('loadingBar');
  const status = document.getElementById('loadingStatus');
  let progress = 0;
  let msgIdx = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 22 + 8;
    if (progress >= 100) progress = 100;
    bar.style.width = progress + '%';
    if (msgIdx < loadingMessages.length) {
      status.textContent = loadingMessages[msgIdx++];
    }
    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
        if (callback) callback();
      }, 500);
    }
  }, 300);
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  spawnParticles();
  initStarPicker();
  initBadgePicker();

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      await loadCurrentUser(user.uid);
    } else {
      currentUser = null;
      currentUserData = null;
      updateNavUI();
    }
  });

  runLoadingScreen(() => {
    loadPublicData();
  });
});

// ============ PARTICLES ============
function spawnParticles() {
  const container = document.getElementById('heroParticles');
  if (!container) return;
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    p.style.setProperty('--tx', (Math.random() - 0.5) * 80 + 'px');
    p.style.animationDuration = (6 + Math.random() * 10) + 's';
    p.style.animationDelay = (Math.random() * 8) + 's';
    container.appendChild(p);
  }
}

// ============ FIREBASE AUTH ============
async function doRegister() {
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const err = document.getElementById('regError');
  err.textContent = '';

  if (!username || !email || !password) { err.textContent = 'All fields required.'; return; }
  if (username.length < 3) { err.textContent = 'Username min 3 characters.'; return; }
  if (password.length < 6) { err.textContent = 'Password min 6 characters.'; return; }
  if (username.toLowerCase() === OWNER_USERNAME.toLowerCase()) { err.textContent = 'Username not allowed.'; return; }

  // Check username taken
  const snap = await db.ref('users/' + username.toLowerCase()).once('value');
  if (snap.exists()) { err.textContent = 'Username already taken.'; return; }

  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    const uid = result.user.uid;
    const userData = {
      username, email, uid,
      balance: 0, coins: 0,
      badges: [], isOwner: false,
      createdAt: Date.now()
    };
    await db.ref('users/' + username.toLowerCase()).set(userData);
    await db.ref('uid_map/' + uid).set(username.toLowerCase());
    closeModal('registerModal');
    toast('Account created! Welcome to DOOMINIKS STORE', 'success');
  } catch (e) {
    err.textContent = e.message;
  }
}

async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const err = document.getElementById('loginError');
  err.textContent = '';
  if (!username || !password) { err.textContent = 'All fields required.'; return; }

  // Check owner login
  const settingsSnap = await db.ref('settings').once('value');
  const settings = settingsSnap.val() || {};
  if (username === OWNER_USERNAME.toLowerCase()) {
    if (password === (settings.ownerPassword || 'owner123')) {
      // Login as owner using owner's firebase account
      try {
        const snap = await db.ref('users/' + username).once('value');
        if (snap.exists()) {
          const ownerEmail = snap.val().email;
          await auth.signInWithEmailAndPassword(ownerEmail, password).catch(async () => {
            // Try custom pass
            throw new Error('Invalid credentials');
          });
        } else {
          err.textContent = 'Owner account not setup. Register first.'; return;
        }
      } catch(e) { err.textContent = e.message; return; }
    } else { err.textContent = 'Invalid password.'; return; }
    closeModal('loginModal');
    return;
  }

  const snap = await db.ref('users/' + username).once('value');
  if (!snap.exists()) { err.textContent = 'Username not found.'; return; }
  const userData = snap.val();
  try {
    await auth.signInWithEmailAndPassword(userData.email, password);
    closeModal('loginModal');
    toast('Welcome back, ' + userData.username + '!', 'success');
  } catch(e) {
    err.textContent = 'Invalid password.';
  }
}

async function logout() {
  await auth.signOut();
  currentUser = null; currentUserData = null;
  updateNavUI();
  showSection('home');
  toast('Logged out successfully', 'info');
}

async function loadCurrentUser(uid) {
  const mapSnap = await db.ref('uid_map/' + uid).once('value');
  if (!mapSnap.exists()) return;
  const username = mapSnap.val();
  db.ref('users/' + username).on('value', (snap) => {
    if (snap.exists()) {
      currentUser = snap.val();
      currentUserData = snap.val();
      updateNavUI();
    }
  });
}

// ============ UI STATE ============
function updateNavUI() {
  const navUser = document.getElementById('navUser');
  const navGuest = document.getElementById('navGuest');
  const navAvatar = document.getElementById('navAvatar');
  const navCoinBal = document.getElementById('navCoinBal');

  if (currentUser) {
    navUser.style.display = 'flex';
    navGuest.style.display = 'none';
    navAvatar.textContent = currentUser.username[0].toUpperCase();
    navCoinBal.textContent = (currentUser.coins || 0).toLocaleString();
    // Show owner panel link
    if (currentUser.username.toLowerCase() === OWNER_USERNAME.toLowerCase()) {
      let ownerLink = document.getElementById('ownerNavLink');
      if (!ownerLink) {
        const nav = document.getElementById('navLinks');
        ownerLink = document.createElement('a');
        ownerLink.id = 'ownerNavLink';
        ownerLink.className = 'nav-link';
        ownerLink.innerHTML = '<i class="fas fa-crown" style="color:var(--gold)"></i> Owner';
        ownerLink.onclick = () => showSection('owner');
        nav.appendChild(ownerLink);
      }
    }
  } else {
    navUser.style.display = 'none';
    navGuest.style.display = 'flex';
    const ownerLink = document.getElementById('ownerNavLink');
    if (ownerLink) ownerLink.remove();
  }
}

// ============ SECTIONS ============
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('sec-' + name);
  if (!sec) return;
  sec.style.display = 'block';
  sec.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const navLink = document.querySelector(`.nav-link[data-section="${name}"]`);
  if (navLink) navLink.classList.add('active');

  if (name === 'owner') {
    if (!currentUser || currentUser.username.toLowerCase() !== OWNER_USERNAME.toLowerCase()) {
      showSection('home'); return;
    }
    sec.style.display = 'block';
    renderOwnerPanel(currentOwnerTab);
  } else if (name === 'profile') {
    if (!currentUser) { showModal('loginModal'); return; }
    renderProfile();
  } else if (name === 'orders') {
    if (!currentUser) { showModal('loginModal'); return; }
    loadOrders();
  } else if (name === 'reviews') {
    loadReviews();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ LOAD PUBLIC DATA ============
async function loadPublicData() {
  loadProducts();
  loadHomeReviews();
  loadStats();
}

function loadProducts() {
  db.ref('products').on('value', (snap) => {
    allProducts = [];
    snap.forEach(child => {
      allProducts.push({ id: child.key, ...child.val() });
    });
    renderProducts(allProducts);
    renderFeatured(allProducts.slice(0, 4));
    updateStatEl('statProducts', allProducts.length);
  });
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search) ||
    p.description?.toLowerCase().includes(search)
  );
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-box-open"></i><p>No products found</p></div>`;
    return;
  }
  grid.innerHTML = filtered.map(p => productCardHTML(p)).join('');
}

function renderFeatured(products) {
  const grid = document.getElementById('featuredGrid');
  if (!grid) return;
  grid.innerHTML = products.map(p => productCardHTML(p)).join('');
}

function productCardHTML(p) {
  const hasDiscount = p.discount > 0;
  const finalPrice = hasDiscount ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
  const coinPrice = Math.ceil(finalPrice / COIN_RATE);
  const outOfStock = (p.stock !== undefined && p.stock <= 0);
  const imgHTML = p.imageUrl
    ? `<img src="${p.imageUrl}" alt="${p.name}" loading="lazy" />`
    : `<div class="product-img-placeholder"><i class="fas fa-box-open"></i></div>`;

  return `
  <div class="product-card" onclick="openProduct('${p.id}')">
    <div class="product-img">
      ${imgHTML}
      ${hasDiscount ? `<div class="product-badge discount">-${p.discount}%</div>` : ''}
      ${outOfStock ? `<div class="product-badge out">SOLD OUT</div>` : ''}
    </div>
    <div class="product-body">
      <div class="product-name">${escHtml(p.name)}</div>
      <div class="product-desc">${escHtml((p.description||'').slice(0,60))}${p.description?.length>60?'...':''}</div>
      <div class="product-price">
        <span class="price-main">Rp ${formatNum(finalPrice)}</span>
        ${hasDiscount ? `<span class="price-old">Rp ${formatNum(p.price)}</span>` : ''}
        <span class="price-coin"><i class="fas fa-coins"></i> ${formatNum(coinPrice)}</span>
      </div>
      <div class="product-meta">
        <span class="product-stock ${p.stock<=5&&p.stock>0?'low':outOfStock?'out':''}">${outOfStock?'Out of stock':p.stock!==undefined?`Stock: ${p.stock}`:'Available'}</span>
        ${p.avgRating ? `<span class="product-rating"><i class="fas fa-star"></i> ${p.avgRating.toFixed(1)}</span>` : ''}
      </div>
    </div>
    <div class="product-card-footer">
      <button class="btn-outline sm" onclick="event.stopPropagation();openProduct('${p.id}')">Details</button>
      <button class="btn-red sm" ${outOfStock?'disabled':''} onclick="event.stopPropagation();${outOfStock?'':`buyProduct('${p.id}')`}">${outOfStock?'Sold Out':'Buy Now'}</button>
    </div>
  </div>`;
}

function filterProducts() {
  renderProducts(allProducts);
}

// ============ PRODUCT DETAIL ============
function openProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  const hasDiscount = p.discount > 0;
  const finalPrice = hasDiscount ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
  const coinPrice = Math.ceil(finalPrice / COIN_RATE);
  const outOfStock = (p.stock !== undefined && p.stock <= 0);

  document.getElementById('productModalContent').innerHTML = `
    <div class="modal-header" style="gap:.5rem">
      <i class="fas fa-box text-red"></i> ${escHtml(p.name)}
    </div>
    <div class="modal-body">
      <div style="margin-bottom:1rem;border-radius:var(--r2);overflow:hidden;max-height:220px;display:flex;align-items:center;justify-content:center;background:var(--dark4);">
        ${p.imageUrl ? `<img src="${p.imageUrl}" style="width:100%;height:220px;object-fit:cover" />` : `<i class="fas fa-box-open" style="font-size:4rem;color:var(--red);padding:2rem"></i>`}
      </div>
      <p style="color:var(--text2);font-size:.92rem;line-height:1.7;margin-bottom:1.25rem">${escHtml(p.description||'No description')}</p>
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1.25rem">
        <div>
          <div class="price-main" style="font-size:1.5rem">Rp ${formatNum(finalPrice)}</div>
          ${hasDiscount?`<div class="price-old">Rp ${formatNum(p.price)} <span class="discount-tag">-${p.discount}%</span></div>`:''}
        </div>
        <div style="border-left:1px solid var(--border);padding-left:1rem">
          <div class="price-coin" style="font-size:1rem"><i class="fas fa-coins"></i> ${formatNum(coinPrice)} Coins</div>
        </div>
      </div>
      <div style="display:flex;gap:.75rem;align-items:center;margin-bottom:1.5rem">
        <span class="product-stock ${outOfStock?'out':''}">${outOfStock?'❌ Out of stock':`✅ Stock: ${p.stock!==undefined?p.stock:'Available'}`}</span>
        ${p.avgRating?`<span class="product-rating"><i class="fas fa-star text-gold"></i> ${p.avgRating.toFixed(1)} (${p.reviewCount||0})</span>`:''}
      </div>
      <div style="display:flex;gap:.75rem;flex-wrap:wrap">
        <button class="btn-red" ${outOfStock?'disabled':''} onclick="closeModal('productModal');buyProduct('${p.id}')"><i class="fas fa-shopping-cart"></i> Buy Now (IDR)</button>
        <button class="btn-outline" ${outOfStock?'disabled':''} onclick="closeModal('productModal');buyCoin('${p.id}')"><i class="fas fa-coins"></i> Buy with Coins</button>
      </div>
    </div>`;
  showModal('productModal');
}

// ============ BUY / PAYMENT ============
function buyProduct(productId) {
  if (!currentUser) { showModal('loginModal'); return; }
  const p = allProducts.find(x => x.id === productId);
  if (!p || p.stock <= 0) { toast('Product out of stock', 'error'); return; }
  openPaymentModal(p, 'idr');
}

function buyCoin(productId) {
  if (!currentUser) { showModal('loginModal'); return; }
  const p = allProducts.find(x => x.id === productId);
  if (!p || p.stock <= 0) { toast('Product out of stock', 'error'); return; }
  openPaymentModal(p, 'coin');
}

async function openPaymentModal(product, mode) {
  const hasDiscount = product.discount > 0;
  const finalPrice = hasDiscount ? Math.round(product.price * (1 - product.discount / 100)) : product.price;
  const coinPrice = Math.ceil(finalPrice / COIN_RATE);

  if (mode === 'coin') {
    if ((currentUser.coins || 0) < coinPrice) {
      toast('Insufficient coins. Please top up first.', 'error');
      openTopup(); return;
    }
    confirmAction('Confirm Purchase', `Buy "${product.name}" for ${coinPrice} coins?`, async () => {
      await processCoinPayment(product, coinPrice);
    });
    return;
  }

  // IDR Payment
  const settingsSnap = await db.ref('settings').once('value');
  const settings = settingsSnap.val() || {};
  selectedPayMethod = null;

  const payMethods = [];
  if (settings.bankName) payMethods.push({ key:'bank', icon:'🏦', name:settings.bankName, desc:`A/N: ${settings.bankHolder||''}`, number: settings.bankNumber||'' });
  if (settings.gopayNumber) payMethods.push({ key:'gopay', icon:'💚', name:'GoPay', desc:'Dompet Digital', number: settings.gopayNumber });
  if (settings.ovoNumber) payMethods.push({ key:'ovo', icon:'💜', name:'OVO', desc:'Dompet Digital', number: settings.ovoNumber });
  if (settings.danaNomber) payMethods.push({ key:'dana', icon:'🔵', name:'DANA', desc:'Dompet Digital', number: settings.danaNomber });
  if (payMethods.length === 0) payMethods.push({ key:'bank', icon:'🏦', name:'Bank Transfer', desc:'Contact owner for details', number:'-' });

  document.getElementById('paymentContent').innerHTML = `
    <div class="modal-header"><i class="fas fa-credit-card text-red"></i> Payment</div>
    <div class="modal-body payment-step" id="payStep1">
      <div class="payment-header">
        <h3>${escHtml(product.name)}</h3>
        <div class="order-total">Rp ${formatNum(finalPrice)}</div>
        ${hasDiscount?`<div class="discount-tag">Discount ${product.discount}% applied</div>`:''}
      </div>
      <p style="font-family:var(--font-ui);font-size:.85rem;color:var(--text2);margin-bottom:1rem">Select Payment Method:</p>
      <div class="pay-methods">
        ${payMethods.map(m=>`
          <div class="pay-method" onclick="selectPayMethod(this,'${m.key}','${m.name}','${m.number}')" data-key="${m.key}">
            <div class="pay-method-icon">${m.icon}</div>
            <div>
              <div class="pay-method-name">${m.name}</div>
              <div class="pay-method-desc">${m.desc}</div>
            </div>
          </div>`).join('')}
      </div>
      <button class="btn-red full" onclick="proceedToPaymentDetails('${product.id}',${finalPrice})">Proceed to Payment</button>
    </div>`;
  showModal('paymentModal');
}

function selectPayMethod(el, key, name, number) {
  document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('selected'));
  el.classList.add('selected');
  selectedPayMethod = { key, name, number };
}

async function proceedToPaymentDetails(productId, amount) {
  if (!selectedPayMethod) { toast('Please select a payment method', 'error'); return; }
  const product = allProducts.find(x => x.id === productId);
  const orderId = 'ORD-' + Date.now() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();

  // Create pending order
  await db.ref('orders/' + orderId).set({
    id: orderId, productId, productName: product.name,
    productImage: product.imageUrl || '',
    amount, userId: currentUser.username.toLowerCase(),
    payMethod: selectedPayMethod.name, status: 'pending',
    createdAt: Date.now(), proofUrl: ''
  });

  let timer = 15 * 60;
  let timerInterval;
  const renderTimer = () => {
    const m = Math.floor(timer/60).toString().padStart(2,'0');
    const s = (timer%60).toString().padStart(2,'0');
    const el = document.getElementById('payTimer');
    if (el) el.textContent = m + ':' + s;
    if (timer <= 0) {
      clearInterval(timerInterval);
      db.ref('orders/' + orderId).update({ status: 'cancelled' });
      closeModal('paymentModal');
      toast('Payment time expired. Order cancelled.', 'error');
    }
    timer--;
  };

  document.getElementById('paymentContent').innerHTML = `
    <div class="modal-header"><i class="fas fa-receipt text-red"></i> Complete Payment</div>
    <div class="modal-body">
      <div class="pay-info-box">
        <div class="pay-info-row">
          <span class="pay-info-key">Order ID</span>
          <span class="pay-info-val">${orderId}</span>
        </div>
        <div class="pay-info-row">
          <span class="pay-info-key">Product</span>
          <span class="pay-info-val">${escHtml(product.name)}</span>
        </div>
        <div class="pay-info-row">
          <span class="pay-info-key">Total</span>
          <span class="pay-info-val text-red font-head">Rp ${formatNum(amount)}</span>
        </div>
        <div class="pay-info-row">
          <span class="pay-info-key">Method</span>
          <span class="pay-info-val">${selectedPayMethod.name}</span>
        </div>
        <div class="pay-info-row">
          <span class="pay-info-key">Number/Account</span>
          <span class="pay-info-val copy" onclick="copyText('${selectedPayMethod.number}')">
            ${selectedPayMethod.number} <i class="fas fa-copy"></i>
          </span>
        </div>
      </div>
      <p style="font-size:.85rem;color:var(--text2);margin-bottom:.5rem;text-align:center">
        Transfer <strong class="text-red">Rp ${formatNum(amount)}</strong> to the account above, then upload proof below.
      </p>
      <div class="pay-timer">⏱ <span id="payTimer">15:00</span></div>
      <div class="proof-upload" id="proofUploadArea" onclick="document.getElementById('proofFile').click()">
        <input type="file" id="proofFile" accept="image/*" onchange="previewProof(this)" />
        <i class="fas fa-upload" style="font-size:2rem;color:var(--red);margin-bottom:.5rem"></i>
        <p style="color:var(--text2);font-size:.88rem">Click to upload payment proof</p>
        <p style="color:var(--text3);font-size:.75rem">JPG, PNG, or JPEG</p>
      </div>
      <img id="proofPreview" class="proof-preview" style="display:none"/>
      <button class="btn-red full" style="margin-top:1rem" onclick="submitPaymentProof('${orderId}')">
        <i class="fas fa-check"></i> Submit Payment Proof
      </button>
    </div>`;

  timerInterval = setInterval(renderTimer, 1000);
  renderTimer();
}

function previewProof(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('proofPreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
    document.getElementById('proofUploadArea').style.borderColor = 'var(--green)';
  };
  reader.readAsDataURL(file);
}

async function submitPaymentProof(orderId) {
  const fileInput = document.getElementById('proofFile');
  if (!fileInput.files[0]) { toast('Please upload payment proof', 'error'); return; }
  const file = fileInput.files[0];
  toast('Uploading proof...', 'info');
  try {
    const ref = storage.ref('proofs/' + orderId + '_' + file.name);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    await db.ref('orders/' + orderId).update({ status: 'paid', proofUrl: url, paidAt: Date.now() });
    closeModal('paymentModal');
    toast('Payment proof submitted! Order is being processed.', 'success');
    showSection('orders');
  } catch(e) {
    toast('Upload failed: ' + e.message, 'error');
  }
}

// ============ COIN PAYMENT ============
async function processCoinPayment(product, coinPrice) {
  const orderId = 'ORD-' + Date.now() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
  const userRef = db.ref('users/' + currentUser.username.toLowerCase());
  const newCoins = (currentUser.coins || 0) - coinPrice;
  if (newCoins < 0) { toast('Insufficient coins', 'error'); return; }

  const hasDiscount = product.discount > 0;
  const finalPrice = hasDiscount ? Math.round(product.price * (1 - product.discount / 100)) : product.price;

  await userRef.update({ coins: newCoins });
  await db.ref('orders/' + orderId).set({
    id: orderId, productId: product.id, productName: product.name,
    productImage: product.imageUrl || '',
    amount: finalPrice, coinAmount: coinPrice,
    userId: currentUser.username.toLowerCase(),
    payMethod: 'Coins', status: 'paid', paidAt: Date.now(), createdAt: Date.now(),
  });

  // Decrease stock
  if (product.stock !== undefined) {
    await db.ref('products/' + product.id + '/stock').set(Math.max(0, product.stock - 1));
  }

  // Add transaction log
  await db.ref('transactions/' + orderId).set({
    orderId, type: 'purchase', userId: currentUser.username.toLowerCase(),
    amount: finalPrice, coinAmount: coinPrice, payMethod: 'Coins',
    productName: product.name, createdAt: Date.now()
  });

  toast(`Purchase successful! ${coinPrice} coins deducted.`, 'success');
  showSection('orders');
}

// ============ TOP UP ============
async function openTopup() {
  if (!currentUser) { showModal('loginModal'); return; }
  const settingsSnap = await db.ref('settings').once('value');
  const settings = settingsSnap.val() || {};
  selectedTopupPkg = null;

  const pkgsHTML = TOPUP_PACKAGES.map((pkg, i) => `
    <div class="topup-pkg" onclick="selectTopupPkg(this,${i})" data-idx="${i}">
      <div class="topup-pkg-coins"><i class="fas fa-coins"></i> ${formatNum(pkg.coins + pkg.bonus)}</div>
      ${pkg.bonus > 0 ? `<div class="topup-pkg-bonus">+${pkg.bonus} bonus</div>` : ''}
      <div class="topup-pkg-price">Rp ${formatNum(pkg.price)}</div>
    </div>`).join('');

  document.getElementById('topupContent').innerHTML = `
    <div class="topup-packages">${pkgsHTML}</div>
    <div id="topupMethodSelect"></div>
    <div id="topupPayDetails" style="display:none"></div>`;

  showModal('topupModal');
}

function selectTopupPkg(el, idx) {
  document.querySelectorAll('.topup-pkg').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  selectedTopupPkg = TOPUP_PACKAGES[idx];
  renderTopupMethodSelect();
}

async function renderTopupMethodSelect() {
  const settingsSnap = await db.ref('settings').once('value');
  const settings = settingsSnap.val() || {};
  const payMethods = [];
  if (settings.bankName) payMethods.push({ key:'bank', icon:'🏦', name:settings.bankName, number: settings.bankNumber||'' });
  if (settings.gopayNumber) payMethods.push({ key:'gopay', icon:'💚', name:'GoPay', number: settings.gopayNumber });
  if (settings.ovoNumber) payMethods.push({ key:'ovo', icon:'💜', name:'OVO', number: settings.ovoNumber });
  if (settings.danaNumber) payMethods.push({ key:'dana', icon:'🔵', name:'DANA', number: settings.danaNumber });

  const div = document.getElementById('topupMethodSelect');
  if (!div) return;
  div.innerHTML = `
    <p style="font-family:var(--font-ui);font-size:.85rem;color:var(--text2);margin-bottom:.75rem">Payment Method:</p>
    <div class="pay-methods" style="margin-bottom:1rem">
      ${payMethods.map(m=>`<div class="pay-method" onclick="selectPayMethod(this,'${m.key}','${m.name}','${m.number}')" data-key="${m.key}">
        <div class="pay-method-icon">${m.icon}</div>
        <div><div class="pay-method-name">${m.name}</div><div class="pay-method-desc">${m.number}</div></div>
      </div>`).join('')}
    </div>
    <button class="btn-red full" onclick="proceedTopupPayment()"><i class="fas fa-arrow-right"></i> Proceed</button>`;
}

async function proceedTopupPayment() {
  if (!selectedTopupPkg) { toast('Select a package first', 'error'); return; }
  if (!selectedPayMethod) { toast('Select payment method', 'error'); return; }
  const pkg = selectedTopupPkg;
  const topupId = 'TOP-' + Date.now() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();

  await db.ref('topups/' + topupId).set({
    id: topupId, userId: currentUser.username.toLowerCase(),
    coins: pkg.coins + pkg.bonus, price: pkg.price,
    payMethod: selectedPayMethod.name, status: 'pending', createdAt: Date.now()
  });

  const div = document.getElementById('topupContent');
  div.innerHTML = `
    <div class="pay-info-box" style="margin-bottom:1rem">
      <div class="pay-info-row"><span class="pay-info-key">Topup ID</span><span class="pay-info-val">${topupId}</span></div>
      <div class="pay-info-row"><span class="pay-info-key">Coins</span><span class="pay-info-val text-gold"><i class="fas fa-coins"></i> ${formatNum(pkg.coins + pkg.bonus)}</span></div>
      <div class="pay-info-row"><span class="pay-info-key">Total</span><span class="pay-info-val text-red">Rp ${formatNum(pkg.price)}</span></div>
      <div class="pay-info-row"><span class="pay-info-key">Transfer To</span><span class="pay-info-val copy" onclick="copyText('${selectedPayMethod.number}')">${selectedPayMethod.number} <i class="fas fa-copy"></i></span></div>
    </div>
    <div class="proof-upload" onclick="document.getElementById('topupProof').click()">
      <input type="file" id="topupProof" accept="image/*" onchange="previewTopupProof(this)" />
      <i class="fas fa-upload" style="font-size:1.5rem;color:var(--red)"></i>
      <p style="color:var(--text2);font-size:.85rem;margin-top:.5rem">Upload payment proof</p>
    </div>
    <img id="topupProofPreview" class="proof-preview" style="display:none;margin-top:.75rem" />
    <button class="btn-red full" style="margin-top:1rem" onclick="submitTopupProof('${topupId}')">Submit Proof</button>`;
}

function previewTopupProof(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('topupProofPreview');
    img.src = e.target.result; img.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function submitTopupProof(topupId) {
  const fileInput = document.getElementById('topupProof');
  if (!fileInput.files[0]) { toast('Please upload proof', 'error'); return; }
  const file = fileInput.files[0];
  toast('Uploading...', 'info');
  try {
    const ref = storage.ref('proofs/topup_' + topupId + '_' + file.name);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    await db.ref('topups/' + topupId).update({ status: 'pending_verify', proofUrl: url, submittedAt: Date.now() });
    closeModal('topupModal');
    toast('Topup proof submitted! Owner will verify shortly.', 'success');
  } catch(e) {
    toast('Upload failed', 'error');
  }
}

// ============ REVIEWS ============
async function loadReviews() {
  const snap = await db.ref('reviews').once('value');
  const reviews = [];
  snap.forEach(c => reviews.push({ id: c.key, ...c.val() }));
  reviews.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  renderReviewsPage(reviews);
}

async function loadHomeReviews() {
  db.ref('reviews').limitToLast(6).on('value', (snap) => {
    const reviews = [];
    snap.forEach(c => reviews.push({ id: c.key, ...c.val() }));
    reviews.reverse();
    const container = document.getElementById('homeReviews');
    if (!container) return;
    if (reviews.length === 0) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-star"></i><p>No reviews yet</p></div>`;
      return;
    }
    container.innerHTML = reviews.map(r => reviewCardHTML(r)).join('');
    updateStatEl('statReviews', reviews.length);
  });
}

function renderReviewsPage(reviews) {
  const summary = document.getElementById('ratingSummary');
  const list = document.getElementById('reviewsList');
  if (!list) return;

  if (reviews.length === 0) {
    if (summary) summary.innerHTML = '';
    list.innerHTML = `<div class="empty-state"><i class="fas fa-star"></i><p>No reviews yet. Be the first!</p></div>`;
    return;
  }

  // Rating summary
  const total = reviews.reduce((s, r) => s + (r.rating || 5), 0);
  const avg = (total / reviews.length).toFixed(1);
  const counts = [0,0,0,0,0];
  reviews.forEach(r => { const v = Math.min(5, Math.max(1, r.rating||5)); counts[v-1]++; });

  if (summary) {
    summary.innerHTML = `
      <div class="rating-big">
        <div class="rating-num">${avg}</div>
        <div class="rating-stars">${'<i class="fas fa-star"></i>'.repeat(Math.round(avg))}</div>
        <div style="font-size:.78rem;color:var(--text3)">${reviews.length} reviews</div>
      </div>
      <div class="rating-bars">
        ${[5,4,3,2,1].map(v => `
          <div class="rbar">
            <span>${v} <i class="fas fa-star" style="color:var(--gold);font-size:.7rem"></i></span>
            <div class="rbar-track"><div class="rbar-fill" style="width:${reviews.length?Math.round(counts[v-1]/reviews.length*100):0}%"></div></div>
            <span>${counts[v-1]}</span>
          </div>`).join('')}
      </div>`;
  }
  list.innerHTML = reviews.map(r => reviewCardHTML(r)).join('');
}

function reviewCardHTML(r) {
  const badgeHTML = r.badges?.length ? r.badges.map(b => `<span class="badge ${b}">${BADGE_ICONS[b]||''} ${b}</span>`).join('') : '';
  return `
    <div class="review-card">
      <div class="review-top">
        <div class="review-avatar">${(r.username||'U')[0].toUpperCase()}</div>
        <div class="review-info">
          <div class="review-name">${escHtml(r.username||'Anonymous')} ${badgeHTML}</div>
          <div class="review-date">${timeAgo(r.createdAt)}</div>
          <div>${'<i class="fas fa-star"></i>'.repeat(r.rating||5).replace(/<i class="fas fa-star"><\/i>/g, '<i class="fas fa-star" style="color:var(--gold);font-size:.8rem"></i>')}</div>
        </div>
      </div>
      ${r.productName ? `<div class="review-product"><i class="fas fa-box"></i> ${escHtml(r.productName)}</div>` : ''}
      <p class="review-text">${escHtml(r.comment||'')}</p>
    </div>`;
}

async function submitReview() {
  if (!currentUser) { showModal('loginModal'); return; }
  const orderId = document.getElementById('reviewOrderId').value;
  const rating = parseInt(document.getElementById('reviewRating').value) || 5;
  const comment = document.getElementById('reviewComment').value.trim();
  if (!comment) { toast('Please write a comment', 'error'); return; }

  const snap = await db.ref('orders/' + orderId).once('value');
  const order = snap.val();
  if (!order) { toast('Order not found', 'error'); return; }

  const reviewId = 'REV-' + Date.now();
  const reviewData = {
    orderId, rating, comment,
    username: currentUser.username,
    badges: currentUser.badges || [],
    productId: order.productId,
    productName: order.productName,
    createdAt: Date.now()
  };

  await db.ref('reviews/' + reviewId).set(reviewData);
  await db.ref('orders/' + orderId).update({ reviewed: true });

  // Update product rating
  const allRevSnap = await db.ref('reviews').orderByChild('productId').equalTo(order.productId).once('value');
  const productRevs = [];
  allRevSnap.forEach(c => productRevs.push(c.val()));
  const avgRating = productRevs.reduce((s,r) => s + (r.rating||5), 0) / productRevs.length;
  await db.ref('products/' + order.productId).update({ avgRating: parseFloat(avgRating.toFixed(1)), reviewCount: productRevs.length });

  closeModal('reviewModal');
  toast('Review submitted! Thank you.', 'success');
  loadOrders();
}

// ============ PROFILE ============
async function renderProfile() {
  if (!currentUser) return;
  const card = document.getElementById('profileCard');
  const u = currentUser;
  const isOwner = u.username.toLowerCase() === OWNER_USERNAME.toLowerCase();
  const badges = isOwner ? ['owner', ...(u.badges||[])] : (u.badges||[]);
  const badgesHTML = badges.map(b => `<span class="badge ${b}">${BADGE_ICONS[b]||''} ${b.charAt(0).toUpperCase()+b.slice(1)}</span>`).join('');

  const ordersSnap = await db.ref('orders').orderByChild('userId').equalTo(u.username.toLowerCase()).once('value');
  let orderCount = 0, completedCount = 0;
  ordersSnap.forEach(c => { orderCount++; if(c.val().status==='completed'||c.val().status==='shipped') completedCount++; });

  card.innerHTML = `
    <div class="profile-banner"></div>
    <div class="profile-avatar-wrap">
      <div class="profile-avatar-big">${u.username[0].toUpperCase()}</div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem">
        ${isOwner?'':''}<button class="btn-outline sm" onclick="openTopup()"><i class="fas fa-coins"></i> Top Up Coins</button>
      </div>
    </div>
    <div class="profile-body">
      <div class="profile-username">${escHtml(u.username)} ${isOwner?'<span class="badge owner">👑 Owner</span>':''}</div>
      <div class="profile-badges">${badgesHTML}</div>
      <div class="profile-stats">
        <div class="profile-stat">
          <div class="profile-stat-val text-gold"><i class="fas fa-coins"></i> ${formatNum(u.coins||0)}</div>
          <div class="profile-stat-label">Coins</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-val">Rp ${formatNum(u.balance||0)}</div>
          <div class="profile-stat-label">Balance</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-val">${orderCount}</div>
          <div class="profile-stat-label">Orders</div>
        </div>
      </div>
      <div style="margin-top:1rem;display:flex;gap:.75rem;flex-wrap:wrap">
        <button class="btn-outline" onclick="showSection('orders')"><i class="fas fa-box"></i> My Orders</button>
        <button class="btn-ghost" onclick="openChat()"><i class="fas fa-comment-dots"></i> Support Chat</button>
      </div>
    </div>`;
}

// ============ ORDERS ============
async function loadOrders() {
  if (!currentUser) return;
  const list = document.getElementById('ordersList');
  if (!list) return;
  list.innerHTML = '<div class="loading-spinner"></div>';

  db.ref('orders').orderByChild('userId').equalTo(currentUser.username.toLowerCase()).on('value', (snap) => {
    const orders = [];
    snap.forEach(c => orders.push({ id: c.key, ...c.val() }));
    orders.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
    if (orders.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>No orders yet. Go shop!</p></div>`;
      return;
    }
    list.innerHTML = orders.map(o => orderCardHTML(o)).join('');
    updateStatEl('statOrders', orders.length);
  });
}

function orderCardHTML(o) {
  const canReview = (o.status === 'completed' || o.status === 'shipped') && !o.reviewed;
  const imgHTML = o.productImage
    ? `<img src="${o.productImage}" />`
    : `<i class="fas fa-box-open"></i>`;
  return `
    <div class="order-card">
      <div class="order-header">
        <span class="order-id">#${o.id}</span>
        <span class="order-status status-${o.status}">${statusLabel(o.status)}</span>
      </div>
      <div class="order-product">
        <div class="order-product-img">${imgHTML}</div>
        <div>
          <div class="order-product-name">${escHtml(o.productName||'')}</div>
          <div class="order-product-price">Rp ${formatNum(o.amount||0)}</div>
          <div style="font-size:.78rem;color:var(--text3)">via ${escHtml(o.payMethod||'')}</div>
        </div>
      </div>
      <div class="order-footer">
        <span class="order-date">${timeAgo(o.createdAt)}</span>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          ${o.status==='paid'||o.status==='pending'?`<span style="font-size:.78rem;color:var(--gold)"><i class="fas fa-clock"></i> Awaiting processing</span>`:''}
          ${o.status==='shipped'||o.status==='completed'?`<span style="font-size:.78rem;color:var(--green)"><i class="fas fa-check-circle"></i> ${o.status==='shipped'?'Delivered':'Completed'}</span>`:''}
          ${canReview?`<button class="btn-outline sm" onclick="openReview('${o.id}','${escHtml(o.productName||'')}')"><i class="fas fa-star"></i> Review</button>`:''}
          ${o.reviewed?`<span style="font-size:.78rem;color:var(--text3)"><i class="fas fa-check"></i> Reviewed</span>`:''}
        </div>
      </div>
    </div>`;
}

function openReview(orderId, productName) {
  document.getElementById('reviewOrderId').value = orderId;
  document.getElementById('reviewComment').value = '';
  document.getElementById('reviewRating').value = 5;
  setStarRating(5);
  showModal('reviewModal');
}

// ============ CHAT ============
function openChat() {
  if (!currentUser) { showModal('loginModal'); return; }
  document.getElementById('chatPanel').classList.add('open');
  loadChatMessages();
}

function closeChat() {
  document.getElementById('chatPanel').classList.remove('open');
  if (chatUnsubscribe) { chatUnsubscribe(); chatUnsubscribe = null; }
}

function loadChatMessages() {
  if (!currentUser) return;
  const chatId = currentUser.username.toLowerCase();
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';

  const ref = db.ref('chats/' + chatId + '/messages');
  if (chatUnsubscribe) chatUnsubscribe();
  chatUnsubscribe = ref.on('value', (snap) => {
    container.innerHTML = '';
    snap.forEach(c => {
      const msg = c.val();
      const isMe = msg.sender === currentUser.username.toLowerCase();
      const div = document.createElement('div');
      div.className = 'chat-msg ' + (isMe ? 'me' : 'them');
      div.innerHTML = `
        <div class="chat-bubble">${escHtml(msg.text)}</div>
        <div class="chat-msg-time">${isMe ? 'You' : 'Support'} · ${timeAgo(msg.ts)}</div>`;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  });
}

async function sendChatMsg() {
  if (!currentUser) return;
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const chatId = currentUser.username.toLowerCase();
  await db.ref('chats/' + chatId + '/messages').push({
    text, sender: currentUser.username.toLowerCase(),
    senderDisplay: currentUser.username, ts: Date.now()
  });
}

function chatKeyPress(e) {
  if (e.key === 'Enter') sendChatMsg();
}

// ============ OWNER PANEL ============
function ownerTab(tab) {
  currentOwnerTab = tab;
  document.querySelectorAll('.otab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  renderOwnerPanel(tab);
}

async function renderOwnerPanel(tab) {
  const content = document.getElementById('ownerContent');
  if (!content) return;
  content.innerHTML = '<div class="loading-spinner"></div>';

  if (tab === 'products') await renderOwnerProducts(content);
  else if (tab === 'orders') await renderOwnerOrders(content);
  else if (tab === 'transactions') await renderOwnerTransactions(content);
  else if (tab === 'users') await renderOwnerUsers(content);
  else if (tab === 'discounts') await renderOwnerDiscounts(content);
  else if (tab === 'reviews') await renderOwnerReviews(content);
  else if (tab === 'chats') await renderOwnerChats(content);
  else if (tab === 'settings') await renderOwnerSettings(content);
}

async function renderOwnerProducts(content) {
  content.innerHTML = `
    <div class="owner-panel-section">
      <div class="owner-card">
        <div class="owner-card-header">
          <h3><i class="fas fa-box"></i> Products</h3>
          <button class="btn-red sm" onclick="openAddProduct(null)"><i class="fas fa-plus"></i> Add Product</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Image</th><th>Name</th><th>Price</th><th>Stock</th><th>Discount</th><th>Actions</th></tr></thead>
            <tbody id="ownerProductsTable"></tbody>
          </table>
        </div>
      </div>
    </div>`;

  db.ref('products').once('value', snap => {
    const tbody = document.getElementById('ownerProductsTable');
    if (!tbody) return;
    if (!snap.exists()) { tbody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:2rem">No products</td></tr>'; return; }
    let rows = '';
    snap.forEach(c => {
      const p = { id: c.key, ...c.val() };
      rows += `<tr>
        <td><div style="width:40px;height:40px;border-radius:6px;overflow:hidden;background:var(--dark4);display:flex;align-items:center;justify-content:center">
          ${p.imageUrl?`<img src="${p.imageUrl}" style="width:100%;height:100%;object-fit:cover">`:'<i class="fas fa-box" style="color:var(--red)"></i>'}
        </div></td>
        <td><strong>${escHtml(p.name)}</strong></td>
        <td>Rp ${formatNum(p.price)}</td>
        <td>${p.stock!==undefined?p.stock:'∞'}</td>
        <td>${p.discount?p.discount+'%':'—'}</td>
        <td style="display:flex;gap:.4rem;flex-wrap:wrap">
          <button class="btn-outline sm" onclick="openAddProduct('${p.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn-ghost sm" onclick="deleteProduct('${p.id}')"><i class="fas fa-trash"></i></button>
        </td></tr>`;
    });
    tbody.innerHTML = rows;
  });
}

async function renderOwnerOrders(content) {
  content.innerHTML = `
    <div class="owner-panel-section">
      <div class="owner-card">
        <div class="owner-card-header"><h3><i class="fas fa-receipt"></i> Order Log</h3></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>ID</th><th>Customer</th><th>Product</th><th>Amount</th><th>Method</th><th>Status</th><th>Proof</th><th>Actions</th></tr></thead>
            <tbody id="ownerOrdersTable"></tbody>
          </table>
        </div>
      </div>
      <div class="owner-card" style="margin-top:1.5rem">
        <div class="owner-card-header"><h3><i class="fas fa-coins"></i> Pending Topups</h3></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>ID</th><th>User</th><th>Coins</th><th>Amount</th><th>Method</th><th>Status</th><th>Proof</th><th>Actions</th></tr></thead>
            <tbody id="ownerTopupsTable"></tbody>
          </table>
        </div>
      </div>
    </div>`;

  db.ref('orders').once('value', snap => {
    const tbody = document.getElementById('ownerOrdersTable');
    if (!tbody) return;
    let rows = '';
    snap.forEach(c => {
      const o = { id: c.key, ...c.val() };
      rows = `<tr>
        <td style="font-size:.75rem">${o.id}</td>
        <td>${escHtml(o.userId||'')}</td>
        <td>${escHtml(o.productName||'')}</td>
        <td>Rp ${formatNum(o.amount||0)}</td>
        <td>${escHtml(o.payMethod||'')}</td>
        <td><span class="order-status status-${o.status}">${statusLabel(o.status)}</span></td>
        <td>${o.proofUrl?`<a href="${o.proofUrl}" target="_blank" style="color:var(--cyan);font-size:.8rem"><i class="fas fa-image"></i> View</a>`:'—'}</td>
        <td style="display:flex;gap:.3rem;flex-wrap:wrap">
          ${o.status==='paid'?`<button class="btn-red sm" onclick="updateOrderStatus('${o.id}','processing')">Process</button>`:''}
          ${o.status==='processing'?`<button class="btn-red sm" onclick="updateOrderStatus('${o.id}','shipped')">Ship</button>`:''}
          ${o.status==='shipped'?`<button class="btn-outline sm" onclick="updateOrderStatus('${o.id}','completed')">Complete</button>`:''}
        </td></tr>` + rows;
    });
    tbody.innerHTML = rows || '<tr><td colspan="8" class="text-muted" style="text-align:center;padding:2rem">No orders</td></tr>';
  });

  db.ref('topups').once('value', snap => {
    const tbody = document.getElementById('ownerTopupsTable');
    if (!tbody) return;
    let rows = '';
    snap.forEach(c => {
      const t = { id: c.key, ...c.val() };
      rows = `<tr>
        <td style="font-size:.75rem">${t.id}</td>
        <td>${escHtml(t.userId||'')}</td>
        <td class="text-gold"><i class="fas fa-coins"></i> ${formatNum(t.coins||0)}</td>
        <td>Rp ${formatNum(t.price||0)}</td>
        <td>${escHtml(t.payMethod||'')}</td>
        <td><span class="order-status status-${t.status}">${t.status}</span></td>
        <td>${t.proofUrl?`<a href="${t.proofUrl}" target="_blank" style="color:var(--cyan);font-size:.8rem"><i class="fas fa-image"></i> View</a>`:'—'}</td>
        <td>${t.status==='pending_verify'?`<button class="btn-red sm" onclick="approveTopup('${t.id}','${t.userId}',${t.coins})">Approve</button>`:'—'}</td>
      </tr>` + rows;
    });
    tbody.innerHTML = rows || '<tr><td colspan="8" class="text-muted" style="text-align:center;padding:2rem">No topups</td></tr>';
  });
}

async function updateOrderStatus(orderId, newStatus) {
  await db.ref('orders/' + orderId).update({ status: newStatus, updatedAt: Date.now() });
  toast('Order updated to ' + newStatus, 'success');
  renderOwnerOrders(document.getElementById('ownerContent'));

  // Reduce stock on processing
  if (newStatus === 'processing') {
    const snap = await db.ref('orders/' + orderId).once('value');
    const order = snap.val();
    if (order && order.productId) {
      const prodSnap = await db.ref('products/' + order.productId).once('value');
      const prod = prodSnap.val();
      if (prod && prod.stock !== undefined && prod.stock > 0) {
        await db.ref('products/' + order.productId + '/stock').set(prod.stock - 1);
      }
    }
  }
}

async function approveTopup(topupId, userId, coins) {
  const userSnap = await db.ref('users/' + userId).once('value');
  const user = userSnap.val();
  if (!user) { toast('User not found', 'error'); return; }
  await db.ref('users/' + userId + '/coins').set((user.coins || 0) + coins);
  await db.ref('topups/' + topupId).update({ status: 'approved', approvedAt: Date.now() });
  await db.ref('transactions/' + topupId).set({ type:'topup', userId, coins, topupId, createdAt: Date.now() });
  toast(`Topup approved! +${coins} coins for ${userId}`, 'success');
  renderOwnerPanel(currentOwnerTab);
}

async function renderOwnerTransactions(content) {
  const snap = await db.ref('transactions').once('value');
  let rows = '';
  const txs = [];
  snap.forEach(c => txs.push({ id: c.key, ...c.val() }));
  txs.sort((a,b) => (b.createdAt||0)-(a.createdAt||0));
  txs.forEach(t => {
    rows += `<tr>
      <td style="font-size:.75rem">${t.id}</td>
      <td>${escHtml(t.userId||'')}</td>
      <td><span class="badge ${t.type==='topup'?'elite':'warrior'}">${t.type}</span></td>
      <td>Rp ${formatNum(t.amount||t.price||0)}</td>
      <td>${t.coinAmount||t.coins||0} coins</td>
      <td style="font-size:.78rem;color:var(--text3)">${timeAgo(t.createdAt)}</td>
    </tr>`;
  });
  content.innerHTML = `
    <div class="owner-panel-section">
      <div class="owner-card">
        <div class="owner-card-header"><h3><i class="fas fa-history"></i> Transaction History</h3></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>ID</th><th>User</th><th>Type</th><th>Amount</th><th>Coins</th><th>Date</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="6" class="text-muted" style="text-align:center;padding:2rem">No transactions</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

async function renderOwnerUsers(content) {
  const snap = await db.ref('users').once('value');
  let rows = '';
  snap.forEach(c => {
    const u = c.val();
    const badges = (u.badges||[]).map(b=>`<span class="badge ${b} sm">${b}</span>`).join(' ');
    rows += `<tr>
      <td><strong>${escHtml(u.username||'')}</strong></td>
      <td>${escHtml(u.email||'')}</td>
      <td class="text-gold">${formatNum(u.coins||0)}</td>
      <td>Rp ${formatNum(u.balance||0)}</td>
      <td>${badges||'—'}</td>
      <td>
        <button class="btn-outline sm" onclick="openGiftBadge('${escHtml(u.username||'')}')"><i class="fas fa-award"></i> Badge</button>
      </td>
    </tr>`;
  });
  content.innerHTML = `
    <div class="owner-panel-section">
      <div class="owner-card">
        <div class="owner-card-header">
          <h3><i class="fas fa-users"></i> Users</h3>
          <button class="btn-outline sm" onclick="showModal('badgeModal')"><i class="fas fa-award"></i> Gift Badge</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Username</th><th>Email</th><th>Coins</th><th>Balance</th><th>Badges</th><th>Actions</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text3)">No users</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

async function renderOwnerDiscounts(content) {
  content.innerHTML = `
    <div class="owner-panel-section">
      <div class="owner-card">
        <div class="owner-card-header"><h3><i class="fas fa-tag"></i> Product Discounts</h3></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Product</th><th>Current Price</th><th>Discount %</th><th>Final Price</th><th>Actions</th></tr></thead>
            <tbody id="discountTable"></tbody>
          </table>
        </div>
      </div>
    </div>`;
  db.ref('products').once('value', snap => {
    const tbody = document.getElementById('discountTable');
    if (!tbody) return;
    let rows = '';
    snap.forEach(c => {
      const p = { id: c.key, ...c.val() };
      const disc = p.discount || 0;
      const final = disc > 0 ? Math.round(p.price * (1 - disc/100)) : p.price;
      rows += `<tr>
        <td>${escHtml(p.name)}</td>
        <td>Rp ${formatNum(p.price)}</td>
        <td><input type="number" value="${disc}" min="0" max="99" style="width:80px;padding:.35rem" id="disc_${p.id}" /></td>
        <td id="discFinal_${p.id}">Rp ${formatNum(final)}</td>
        <td><button class="btn-red sm" onclick="saveDiscount('${p.id}',${p.price})">Save</button></td>
      </tr>`;
    });
    tbody.innerHTML = rows || '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text3)">No products</td></tr>';
  });
}

async function saveDiscount(productId, price) {
  const input = document.getElementById('disc_' + productId);
  if (!input) return;
  const disc = Math.max(0, Math.min(99, parseInt(input.value)||0));
  await db.ref('products/' + productId).update({ discount: disc });
  const final = disc > 0 ? Math.round(price * (1 - disc/100)) : price;
  const finalEl = document.getElementById('discFinal_' + productId);
  if (finalEl) finalEl.textContent = 'Rp ' + formatNum(final);
  toast(`Discount set to ${disc}% for product`, 'success');
}

async function renderOwnerReviews(content) {
  const snap = await db.ref('reviews').once('value');
  let rows = '';
  snap.forEach(c => {
    const r = { id: c.key, ...c.val() };
    rows = `<tr>
      <td>${escHtml(r.username||'')}</td>
      <td>${escHtml(r.productName||'')}</td>
      <td>${'★'.repeat(r.rating||5)}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(r.comment||'')}</td>
      <td style="font-size:.75rem;color:var(--text3)">${timeAgo(r.createdAt)}</td>
      <td><button class="btn-ghost sm" onclick="deleteReview('${r.id}')"><i class="fas fa-trash"></i></button></td>
    </tr>` + rows;
  });
  content.innerHTML = `
    <div class="owner-panel-section">
      <div class="owner-card">
        <div class="owner-card-header"><h3><i class="fas fa-star"></i> Reviews Management</h3></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>User</th><th>Product</th><th>Rating</th><th>Comment</th><th>Date</th><th>Delete</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text3)">No reviews</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

async function deleteReview(reviewId) {
  confirmAction('Delete Review', 'Are you sure you want to delete this review?', async () => {
    await db.ref('reviews/' + reviewId).remove();
    toast('Review deleted', 'success');
    renderOwnerPanel(currentOwnerTab);
  });
}

async function renderOwnerChats(content) {
  const snap = await db.ref('chats').once('value');
  let chatList = '<div class="owner-panel-section"><div class="owner-card"><div class="owner-card-header"><h3><i class="fas fa-comments"></i> Customer Chats</h3></div>';
  
  if (!snap.exists()) {
    chatList += '<p class="text-muted" style="text-align:center;padding:2rem">No chats yet</p>';
  } else {
    const chatIds = [];
    snap.forEach(c => chatIds.push(c.key));
    chatList += '<div style="display:flex;flex-direction:column;gap:.5rem">';
    chatIds.forEach(chatId => {
      chatList += `<div class="glow-panel" style="display:flex;align-items:center;justify-content:space-between;padding:.85rem 1rem;cursor:pointer" onclick="openOwnerChat('${chatId}')">
        <div><i class="fas fa-user" style="color:var(--red);margin-right:.5rem"></i><strong>${escHtml(chatId)}</strong></div>
        <button class="btn-red sm">Open Chat</button>
      </div>`;
    });
    chatList += '</div>';
  }
  chatList += '</div></div>';
  content.innerHTML = chatList + '<div id="ownerChatArea" style="margin-top:1rem"></div>';
}

async function openOwnerChat(chatId) {
  ownerChatTarget = chatId;
  const area = document.getElementById('ownerChatArea');
  if (!area) return;
  area.innerHTML = `
    <div class="owner-card">
      <div class="owner-card-header"><h3><i class="fas fa-comment"></i> Chat with ${escHtml(chatId)}</h3></div>
      <div class="chat-messages" id="ownerChatMsgs" style="max-height:350px;overflow-y:auto;background:var(--dark4);border-radius:var(--r2);padding:1rem;margin-bottom:1rem"></div>
      <div style="display:flex;gap:.5rem">
        <input type="text" id="ownerChatInput" placeholder="Type message..." onkeypress="ownerChatKey(event)" />
        <button class="btn-red" onclick="sendOwnerMsg()"><i class="fas fa-paper-plane"></i></button>
      </div>
    </div>`;

  db.ref('chats/' + chatId + '/messages').on('value', snap => {
    const msgs = document.getElementById('ownerChatMsgs');
    if (!msgs) return;
    msgs.innerHTML = '';
    snap.forEach(c => {
      const msg = c.val();
      const isOwner = msg.sender === OWNER_USERNAME.toLowerCase();
      const div = document.createElement('div');
      div.className = 'chat-msg ' + (isOwner ? 'me' : 'them');
      div.innerHTML = `<div class="chat-bubble">${escHtml(msg.text)}</div>
        <div class="chat-msg-time">${isOwner ? 'You (Owner)' : escHtml(msg.senderDisplay||msg.sender)} · ${timeAgo(msg.ts)}</div>`;
      msgs.appendChild(div);
    });
    msgs.scrollTop = msgs.scrollHeight;
  });
}

async function sendOwnerMsg() {
  if (!ownerChatTarget) return;
  const input = document.getElementById('ownerChatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await db.ref('chats/' + ownerChatTarget + '/messages').push({
    text, sender: OWNER_USERNAME.toLowerCase(),
    senderDisplay: OWNER_USERNAME, ts: Date.now()
  });
}

function ownerChatKey(e) { if (e.key === 'Enter') sendOwnerMsg(); }

async function renderOwnerSettings(content) {
  const snap = await db.ref('settings').once('value');
  const s = snap.val() || {};
  content.innerHTML = `
    <div class="owner-panel-section">
      <div style="display:grid;gap:1.5rem;grid-template-columns:1fr 1fr">

        <!-- Payment Settings -->
        <div class="owner-card">
          <div class="owner-card-header"><h3><i class="fas fa-university"></i> Payment Settings</h3></div>
          <div class="form-group"><label>Bank Name</label><input type="text" id="s_bankName" value="${escHtml(s.bankName||'')}" placeholder="BCA / Mandiri..." /></div>
          <div class="form-group"><label>Account Number</label><input type="text" id="s_bankNumber" value="${escHtml(s.bankNumber||'')}" /></div>
          <div class="form-group"><label>Account Holder</label><input type="text" id="s_bankHolder" value="${escHtml(s.bankHolder||'')}" /></div>
          <div class="divider"></div>
          <div class="form-group"><label>GoPay Number</label><input type="text" id="s_gopayNumber" value="${escHtml(s.gopayNumber||'')}" /></div>
          <div class="form-group"><label>OVO Number</label><input type="text" id="s_ovoNumber" value="${escHtml(s.ovoNumber||'')}" /></div>
          <div class="form-group"><label>DANA Number</label><input type="text" id="s_danaNumber" value="${escHtml(s.danaNumber||'')}" /></div>
          <button class="btn-red" onclick="saveSettings('payment')"><i class="fas fa-save"></i> Save Payment</button>
        </div>

        <!-- Account Settings -->
        <div class="owner-card">
          <div class="owner-card-header"><h3><i class="fas fa-user-cog"></i> Account Settings</h3></div>
          <div class="form-group"><label>Owner Display Name</label><input type="text" id="s_ownerName" value="${escHtml(s.ownerName||OWNER_USERNAME)}" /></div>
          <div class="form-group"><label>New Password</label><input type="password" id="s_ownerPassword" placeholder="Leave blank to keep current" /></div>
          <div class="form-group"><label>Discord Invite Link</label><input type="text" id="s_discordLink" value="${escHtml(s.discordLink||'')}" placeholder="https://discord.gg/..." /></div>
          <button class="btn-red" onclick="saveSettings('account')"><i class="fas fa-save"></i> Save Account</button>
        </div>

      </div>
    </div>`;
}

async function saveSettings(type) {
  const updates = {};
  if (type === 'payment') {
    updates.bankName = document.getElementById('s_bankName')?.value || '';
    updates.bankNumber = document.getElementById('s_bankNumber')?.value || '';
    updates.bankHolder = document.getElementById('s_bankHolder')?.value || '';
    updates.gopayNumber = document.getElementById('s_gopayNumber')?.value || '';
    updates.ovoNumber = document.getElementById('s_ovoNumber')?.value || '';
    updates.danaNumber = document.getElementById('s_danaNumber')?.value || '';
  } else if (type === 'account') {
    updates.ownerName = document.getElementById('s_ownerName')?.value || OWNER_USERNAME;
    const newPass = document.getElementById('s_ownerPassword')?.value;
    if (newPass && newPass.length >= 6) {
      updates.ownerPassword = newPass;
      try { await auth.currentUser?.updatePassword(newPass); } catch(e) {}
    }
    updates.discordLink = document.getElementById('s_discordLink')?.value || '';
  }
  await db.ref('settings').update(updates);
  toast('Settings saved!', 'success');
}

// ============ ADD/EDIT PRODUCT ============
function openAddProduct(productId) {
  editingProductId = productId;
  document.getElementById('addProductTitle').textContent = productId ? 'Edit Product' : 'Add Product';
  let existing = {};
  if (productId) existing = allProducts.find(p => p.id === productId) || {};

  document.getElementById('addProductContent').innerHTML = `
    <div class="form-group">
      <label>Product Image</label>
      <div class="proof-upload" onclick="document.getElementById('productImgFile').click()" id="prodImgUploadArea">
        <input type="file" id="productImgFile" accept="image/*" onchange="previewProductImg(this)" />
        ${existing.imageUrl ? `<img src="${existing.imageUrl}" style="max-height:120px;border-radius:6px" /><p style="font-size:.75rem;color:var(--text3);margin-top:.3rem">Click to change</p>` : `<i class="fas fa-image" style="font-size:2rem;color:var(--red)"></i><p style="color:var(--text2);font-size:.85rem;margin-top:.5rem">Upload image</p>`}
      </div>
      <img id="prodImgPreview" style="display:none;max-height:120px;border-radius:6px;margin-top:.5rem" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Product Name *</label>
        <input type="text" id="pName" value="${escHtml(existing.name||'')}" placeholder="Product name"/>
      </div>
      <div class="form-group">
        <label>Price (IDR) *</label>
        <input type="number" id="pPrice" value="${existing.price||''}" placeholder="50000"/>
      </div>
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="pDesc" rows="3" placeholder="Product description...">${escHtml(existing.description||'')}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Stock (leave blank = unlimited)</label>
        <input type="number" id="pStock" value="${existing.stock!==undefined?existing.stock:''}" placeholder="100"/>
      </div>
      <div class="form-group">
        <label>Discount %</label>
        <input type="number" id="pDiscount" value="${existing.discount||0}" min="0" max="99"/>
      </div>
    </div>
    <div id="addProductError" class="form-error"></div>
    <button class="btn-red full" onclick="saveProduct()"><i class="fas fa-save"></i> ${productId?'Update':'Add'} Product</button>`;
  showModal('addProductModal');
}

function previewProductImg(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('prodImgPreview');
    img.src = e.target.result; img.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function saveProduct() {
  const name = document.getElementById('pName')?.value.trim();
  const price = parseInt(document.getElementById('pPrice')?.value);
  const desc = document.getElementById('pDesc')?.value.trim();
  const stockVal = document.getElementById('pStock')?.value;
  const discount = parseInt(document.getElementById('pDiscount')?.value) || 0;
  const err = document.getElementById('addProductError');
  if (!name || !price) { err.textContent = 'Name and price are required.'; return; }

  const productData = {
    name, price, description: desc||'',
    discount: Math.max(0, Math.min(99, discount)),
    updatedAt: Date.now()
  };
  if (stockVal !== '') productData.stock = parseInt(stockVal) || 0;

  let imageUrl = editingProductId ? (allProducts.find(p=>p.id===editingProductId)?.imageUrl||'') : '';
  const fileInput = document.getElementById('productImgFile');
  if (fileInput?.files[0]) {
    toast('Uploading image...', 'info');
    const file = fileInput.files[0];
    const ref = storage.ref('products/' + Date.now() + '_' + file.name);
    await ref.put(file);
    imageUrl = await ref.getDownloadURL();
  }
  if (imageUrl) productData.imageUrl = imageUrl;
  if (!editingProductId) productData.createdAt = Date.now();

  if (editingProductId) {
    await db.ref('products/' + editingProductId).update(productData);
    toast('Product updated!', 'success');
  } else {
    await db.ref('products').push(productData);
    toast('Product added!', 'success');
  }
  closeModal('addProductModal');
}

async function deleteProduct(productId) {
  confirmAction('Delete Product', 'Delete this product permanently?', async () => {
    await db.ref('products/' + productId).remove();
    toast('Product deleted', 'success');
  });
}

// ============ BADGES ============
function initBadgePicker() {
  const grid = document.getElementById('badgePickGrid');
  if (!grid) return;
  grid.innerHTML = BADGES.map(b => `
    <div class="badge-pick ${b}" onclick="selectBadgeForGift(this,'${b}')">${BADGE_ICONS[b]} ${b}</div>`).join('');
}

function selectBadgeForGift(el, badge) {
  document.querySelectorAll('.badge-pick').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  selectedBadge = badge;
  document.getElementById('selectedBadge').value = badge;
}

function openGiftBadge(username) {
  document.getElementById('badgeUsername').value = username || '';
  showModal('badgeModal');
}

async function giftBadge() {
  const username = document.getElementById('badgeUsername').value.trim().toLowerCase();
  const badge = document.getElementById('selectedBadge').value;
  if (!username || !badge) { toast('Fill username and select badge', 'error'); return; }
  const snap = await db.ref('users/' + username).once('value');
  if (!snap.exists()) { toast('User not found', 'error'); return; }
  const user = snap.val();
  const badges = user.badges || [];
  if (!badges.includes(badge)) badges.push(badge);
  await db.ref('users/' + username + '/badges').set(badges);
  closeModal('badgeModal');
  toast(`Badge "${badge}" gifted to ${username}!`, 'success');
}

// ============ STATS ============
async function loadStats() {
  db.ref('products').on('value', snap => updateStatEl('statProducts', snap.numChildren()));
  db.ref('reviews').on('value', snap => updateStatEl('statReviews', snap.numChildren()));
  db.ref('orders').on('value', snap => updateStatEl('statOrders', snap.numChildren()));
}

function updateStatEl(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  animateCount(el, parseInt(el.textContent)||0, val);
}

function animateCount(el, from, to) {
  const dur = 1000, steps = 30;
  let step = 0;
  const inc = (to - from) / steps;
  const interval = setInterval(() => {
    step++;
    el.textContent = Math.round(from + inc * step);
    if (step >= steps) { el.textContent = to; clearInterval(interval); }
  }, dur / steps);
}

// ============ DISCORD ============
async function openDiscord() {
  const snap = await db.ref('settings/discordLink').once('value');
  const link = snap.val() || '#';
  if (link !== '#') window.open(link, '_blank');
  else toast('Discord link not set', 'info');
}

// ============ HELPERS ============
function showModal(id) {
  document.getElementById(id)?.classList.add('active');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}
function switchModal(from, to) {
  closeModal(from); showModal(to);
}

function toggleMenu() {
  document.getElementById('navLinks')?.classList.toggle('open');
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  t.innerHTML = `<i class="fas ${icons[type]||'fa-info-circle'}"></i> ${escHtml(msg)}`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(20px)'; setTimeout(() => t.remove(), 300); }, 3000);
}

function confirmAction(title, msg, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  const btn = document.getElementById('confirmBtn');
  btn.onclick = () => { closeModal('confirmModal'); callback(); };
  showModal('confirmModal');
}

function formatNum(n) {
  return (n||0).toLocaleString('id-ID');
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
  return Math.floor(diff/86400000) + 'd ago';
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function statusLabel(status) {
  const labels = { pending:'Pending', paid:'Paid', processing:'Processing', shipped:'Shipped', completed:'Completed', cancelled:'Cancelled' };
  return labels[status] || status;
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('Copied!', 'success')).catch(() => {
    const el = document.createElement('textarea');
    el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove();
    toast('Copied!', 'success');
  });
}

// ============ STAR PICKER ============
function initStarPicker() {
  const picker = document.getElementById('starPicker');
  if (!picker) return;
  picker.querySelectorAll('i').forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.getAttribute('data-v'));
      setStarRating(val);
    });
  });
}

function setStarRating(val) {
  selectedReviewRating = val;
  document.getElementById('reviewRating').value = val;
  const stars = document.querySelectorAll('#starPicker i');
  stars.forEach(s => {
    const v = parseInt(s.getAttribute('data-v'));
    s.classList.toggle('active', v <= val);
  });
}
