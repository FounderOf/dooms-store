// Firebase Configuration
// IMPORTANT: Replace with your own Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAuZLwwomxlNUjcPp4JYILdSz4EAWtoRxY",
    authDomain: "dooniniks-paradise.firebaseapp.com",
    databaseURL: "https://dooniniks-paradise-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dooniniks-paradise",
    storageBucket: "dooniniks-paradise.firebasestorage.app",
    messagingSenderId: "140802324914",
    appId: "1:140802324914:web:0bf5330384553d6d40ccab"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
const rtdb = firebase.database();

// Global Variables
let currentUser = null;
let allProducts = [];
let allReviews = [];
let allOrders = [];

// Owner Account Credentials (stored in Firebase, default values)
const OWNER_USERNAME = 'admin';

// Initialize App
window.addEventListener('load', () => {
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        loadingScreen.style.animation = 'fadeOut 0.5s ease';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            checkAuthState();
        }, 500);
    }, 2000);
});

// Check Authentication State
function checkAuthState() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainApp();
    } else {
        showLoginModal();
    }
}

// Show Login Modal
function showLoginModal() {
    document.getElementById('loginModal').classList.add('active');
}

// Auth Tab Switching
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tabName + 'Form').classList.add('active');
    });
});

// Register
async function register() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    if (!username || !password || !confirmPassword) {
        alert('Please fill in all fields');
        return;
    }

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    if (username.length < 3) {
        alert('Username must be at least 3 characters');
        return;
    }

    try {
        // Check if username exists
        const userDoc = await db.collection('users').doc(username).get();
        if (userDoc.exists) {
            alert('Username already exists');
            return;
        }

        // Create user
        await db.collection('users').doc(username).set({
            username: username,
            password: password, // In production, use proper password hashing
            balance: 0,
            coins: 0,
            badge: '👤',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('Registration successful! Please login.');
        document.querySelector('.auth-tab[data-tab="login"]').click();
        document.getElementById('loginUsername').value = username;
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed. Please try again.');
    }
}

// Login
async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const userDoc = await db.collection('users').doc(username).get();
        
        if (!userDoc.exists) {
            alert('User not found');
            return;
        }

        const userData = userDoc.data();
        if (userData.password !== password) {
            alert('Incorrect password');
            return;
        }

        currentUser = {
            username: username,
            balance: userData.balance || 0,
            coins: userData.coins || 0,
            badge: userData.badge || '👤',
            isOwner: username === OWNER_USERNAME
        };

        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        document.getElementById('loginModal').classList.remove('active');
        showMainApp();
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

// Show Main App
function showMainApp() {
    document.getElementById('mainApp').style.display = 'block';
    updateUserDisplay();
    loadProducts();
    loadReviews();
    loadOrders();
    loadSettings();
    loadChatMessages();
    
    if (currentUser.isOwner) {
        document.querySelectorAll('.owner-only').forEach(el => el.style.display = '');
        loadOwnerData();
    }

    // Setup real-time listeners
    setupRealtimeListeners();
}

// Update User Display
function updateUserDisplay() {
    document.getElementById('headerUsername').textContent = currentUser.username;
    document.getElementById('headerCoins').textContent = currentUser.coins;
    document.getElementById('headerBalance').textContent = currentUser.balance.toLocaleString();
    document.getElementById('userBadge').textContent = currentUser.badge;
    
    document.getElementById('profileUsername').textContent = currentUser.username;
    document.getElementById('profileCoins').textContent = currentUser.coins;
    document.getElementById('profileBalance').textContent = currentUser.balance.toLocaleString();
    document.getElementById('profileBadge').textContent = currentUser.badge;
}

// Logout
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('currentUser');
        currentUser = null;
        location.reload();
    }
}

// Toggle Profile Menu
function toggleProfileMenu() {
    document.getElementById('profileMenu').classList.toggle('active');
}

// Close profile menu when clicking outside
document.addEventListener('click', (e) => {
    const profileMenu = document.getElementById('profileMenu');
    const userInfo = document.querySelector('.user-info');
    if (!userInfo.contains(e.target) && !profileMenu.contains(e.target)) {
        profileMenu.classList.remove('active');
    }
});

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const panel = btn.dataset.panel;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(panel + 'Panel').classList.add('active');
    });
});

// Owner Tab Navigation
document.querySelectorAll('.owner-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        document.querySelectorAll('.owner-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.owner-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tabName.replace(/-/g, '') + 'Tab').classList.add('active');
    });
});

// Load Products
async function loadProducts() {
    try {
        const snapshot = await db.collection('products').get();
        allProducts = [];
        snapshot.forEach(doc => {
            allProducts.push({ id: doc.id, ...doc.data() });
        });
        displayProducts();
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

// Display Products
function displayProducts() {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = '';

    if (allProducts.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1/-1;">No products available yet.</p>';
        return;
    }

    allProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        const originalPrice = product.price;
        const discountedPrice = product.discount > 0 ? 
            originalPrice * (1 - product.discount / 100) : originalPrice;
        
        const originalPriceCoins = product.priceCoins;
        const discountedPriceCoins = product.discount > 0 ? 
            Math.floor(originalPriceCoins * (1 - product.discount / 100)) : originalPriceCoins;

        card.innerHTML = `
            <img src="${product.imageUrl || 'https://via.placeholder.com/300x200?text=No+Image'}" 
                 alt="${product.name}" class="product-image">
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-price">
                    ${product.discount > 0 ? `
                        <div>
                            <span class="price-idr">Rp ${discountedPrice.toLocaleString()}</span>
                            <span class="discount-badge">${product.discount}% OFF</span>
                        </div>
                        <span class="price-discount">Rp ${originalPrice.toLocaleString()}</span>
                        <div>
                            <span class="price-coins">${discountedPriceCoins} Coins</span>
                        </div>
                        <span class="price-discount">${originalPriceCoins} Coins</span>
                    ` : `
                        <span class="price-idr">Rp ${originalPrice.toLocaleString()}</span>
                        <span class="price-coins">${originalPriceCoins} Coins</span>
                    `}
                </div>
                <p class="product-stock ${product.stock < 5 ? 'stock-low' : ''} ${product.stock === 0 ? 'stock-out' : ''}">
                    Stock: ${product.stock} ${product.stock < 5 && product.stock > 0 ? '(Low Stock!)' : ''}
                    ${product.stock === 0 ? '(Out of Stock)' : ''}
                </p>
                <button class="btn-buy" onclick="openProductDetail('${product.id}')" 
                        ${product.stock === 0 ? 'disabled' : ''}>
                    ${product.stock === 0 ? 'Out of Stock' : 'View & Buy'}
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Open Product Detail
function openProductDetail(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const discountedPrice = product.discount > 0 ? 
        product.price * (1 - product.discount / 100) : product.price;
    const discountedPriceCoins = product.discount > 0 ? 
        Math.floor(product.priceCoins * (1 - product.discount / 100)) : product.priceCoins;

    const detail = document.getElementById('productDetail');
    detail.innerHTML = `
        <img src="${product.imageUrl || 'https://via.placeholder.com/800x400?text=No+Image'}" 
             alt="${product.name}" class="product-detail-image">
        <h2>${product.name}</h2>
        <p>${product.description}</p>
        <div class="product-price">
            ${product.discount > 0 ? `
                <div>
                    <span class="price-idr">Rp ${discountedPrice.toLocaleString()}</span>
                    <span class="discount-badge">${product.discount}% OFF</span>
                </div>
                <span class="price-discount">Rp ${product.price.toLocaleString()}</span>
            ` : `
                <span class="price-idr">Rp ${product.price.toLocaleString()}</span>
            `}
        </div>
        <div class="product-price">
            ${product.discount > 0 ? `
                <span class="price-coins">${discountedPriceCoins} Coins</span>
                <span class="price-discount">${product.priceCoins} Coins</span>
            ` : `
                <span class="price-coins">${product.priceCoins} Coins</span>
            `}
        </div>
        <h3 style="margin-top: 2rem; color: var(--primary-red);">Select Payment Method</h3>
        <div class="payment-method" onclick="selectPaymentMethod('idr', '${product.id}', ${discountedPrice})">
            <h4>💵 Pay with IDR (Bank/E-Wallet)</h4>
            <p>Total: Rp ${discountedPrice.toLocaleString()}</p>
        </div>
        <div class="payment-method" onclick="selectPaymentMethod('coins', '${product.id}', ${discountedPriceCoins})">
            <h4>🪙 Pay with Coins</h4>
            <p>Total: ${discountedPriceCoins} Coins</p>
            <p style="font-size: 0.9rem; opacity: 0.8;">Your balance: ${currentUser.coins} Coins</p>
        </div>
    `;

    document.getElementById('productModal').classList.add('active');
}

// Close Product Modal
function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

// Select Payment Method
async function selectPaymentMethod(method, productId, amount) {
    const product = allProducts.find(p => p.id === productId);
    
    if (method === 'coins') {
        if (currentUser.coins < amount) {
            alert('Insufficient coins! Please top up your coins first.');
            return;
        }
        
        if (confirm(`Confirm purchase of ${product.name} for ${amount} coins?`)) {
            await processCoinPurchase(product, amount);
        }
    } else {
        openPaymentModal(product, amount);
    }
}

// Process Coin Purchase
async function processCoinPurchase(product, amount) {
    try {
        // Update user coins
        const newCoins = currentUser.coins - amount;
        await db.collection('users').doc(currentUser.username).update({
            coins: newCoins
        });

        // Update product stock
        const newStock = product.stock - 1;
        await db.collection('products').doc(product.id).update({
            stock: newStock
        });

        // Create order
        await db.collection('orders').add({
            userId: currentUser.username,
            productId: product.id,
            productName: product.name,
            amount: amount,
            paymentMethod: 'coins',
            status: 'shipped',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Create transaction log
        await db.collection('transactions').add({
            userId: currentUser.username,
            type: 'purchase',
            productName: product.name,
            amount: amount,
            method: 'coins',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        currentUser.coins = newCoins;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserDisplay();
        
        alert('Purchase successful! Your order has been processed.');
        closeProductModal();
        loadProducts();
        loadOrders();
    } catch (error) {
        console.error('Purchase error:', error);
        alert('Purchase failed. Please try again.');
    }
}

// Open Payment Modal
async function openPaymentModal(product, amount) {
    try {
        const settingsDoc = await db.collection('settings').doc('payment').get();
        const settings = settingsDoc.exists ? settingsDoc.data() : {};

        const content = document.getElementById('paymentContent');
        content.innerHTML = `
            <h3>Product: ${product.name}</h3>
            <p>Amount: Rp ${amount.toLocaleString()}</p>
            
            <div class="form-group">
                <label>Select Payment Method</label>
                <select id="paymentMethodSelect" onchange="showPaymentDetails()">
                    <option value="">-- Select Method --</option>
                    ${settings.bankName ? `<option value="bank">Bank Transfer - ${settings.bankName}</option>` : ''}
                    ${settings.ewalletType ? `<option value="ewallet">E-Wallet - ${settings.ewalletType}</option>` : ''}
                </select>
            </div>
            
            <div id="paymentDetailsSection" style="display: none;">
                <div class="payment-details">
                    <div class="payment-info" id="paymentInfo"></div>
                    <div class="upload-proof">
                        <label>Upload Payment Proof</label>
                        <input type="file" id="paymentProof" accept="image/*">
                    </div>
                </div>
                <button class="btn-primary" onclick="submitPayment('${product.id}', ${amount})">
                    Submit Payment
                </button>
            </div>
        `;

        // Store payment settings temporarily
        window.paymentSettings = settings;
        window.currentPaymentProduct = product;

        document.getElementById('paymentModal').classList.add('active');
        closeProductModal();
    } catch (error) {
        console.error('Error loading payment settings:', error);
        alert('Payment system error. Please contact support.');
    }
}

// Show Payment Details
function showPaymentDetails() {
    const method = document.getElementById('paymentMethodSelect').value;
    const settings = window.paymentSettings;
    const section = document.getElementById('paymentDetailsSection');
    const info = document.getElementById('paymentInfo');

    if (!method) {
        section.style.display = 'none';
        return;
    }

    let details = '';
    if (method === 'bank') {
        details = `
            <p><strong>Bank:</strong> ${settings.bankName}</p>
            <p><strong>Account Number:</strong> ${settings.bankAccount}</p>
            <p><strong>Account Name:</strong> DOOMINIKS STORE</p>
        `;
    } else if (method === 'ewallet') {
        details = `
            <p><strong>E-Wallet:</strong> ${settings.ewalletType}</p>
            <p><strong>Number:</strong> ${settings.ewalletNumber}</p>
            <p><strong>Name:</strong> DOOMINIKS STORE</p>
        `;
    }

    info.innerHTML = details + '<p style="margin-top: 1rem; color: var(--primary-red);">Please make the payment and upload proof below.</p>';
    section.style.display = 'block';
}

// Submit Payment
async function submitPayment(productId, amount) {
    const proofFile = document.getElementById('paymentProof').files[0];
    const method = document.getElementById('paymentMethodSelect').value;
    const product = window.currentPaymentProduct;

    if (!proofFile) {
        alert('Please upload payment proof');
        return;
    }

    if (!method) {
        alert('Please select payment method');
        return;
    }

    try {
        // Upload payment proof
        const storageRef = storage.ref(`payment-proofs/${Date.now()}_${proofFile.name}`);
        await storageRef.put(proofFile);
        const proofUrl = await storageRef.getDownloadURL();

        // Create order
        await db.collection('orders').add({
            userId: currentUser.username,
            productId: product.id,
            productName: product.name,
            amount: amount,
            paymentMethod: method,
            paymentProof: proofUrl,
            status: 'processing',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Create transaction log
        await db.collection('transactions').add({
            userId: currentUser.username,
            type: 'purchase',
            productName: product.name,
            amount: amount,
            method: method,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('Payment submitted! Your order is being processed.');
        closePaymentModal();
        loadOrders();
    } catch (error) {
        console.error('Payment submission error:', error);
        alert('Failed to submit payment. Please try again.');
    }
}

// Close Payment Modal
function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

// Open Top Up Modal
function openTopupModal() {
    document.getElementById('profileMenu').classList.remove('active');
    document.getElementById('topupModal').classList.add('active');
}

// Close Top Up Modal
function closeTopupModal() {
    document.getElementById('topupModal').classList.remove('active');
}

// Process Top Up
async function processTopup() {
    const amount = parseInt(document.getElementById('topupAmount').value);
    
    if (!amount || amount < 1000) {
        alert('Minimum top up amount is Rp 1,000');
        return;
    }

    try {
        const settingsDoc = await db.collection('settings').doc('payment').get();
        const settings = settingsDoc.exists ? settingsDoc.data() : {};

        const content = document.getElementById('paymentContent');
        content.innerHTML = `
            <h3>Top Up Balance</h3>
            <p>Amount: Rp ${amount.toLocaleString()}</p>
            
            <div class="form-group">
                <label>Select Payment Method</label>
                <select id="topupMethodSelect" onchange="showTopupPaymentDetails()">
                    <option value="">-- Select Method --</option>
                    ${settings.bankName ? `<option value="bank">Bank Transfer - ${settings.bankName}</option>` : ''}
                    ${settings.ewalletType ? `<option value="ewallet">E-Wallet - ${settings.ewalletType}</option>` : ''}
                </select>
            </div>
            
            <div id="topupPaymentDetailsSection" style="display: none;">
                <div class="payment-details">
                    <div class="payment-info" id="topupPaymentInfo"></div>
                    <div class="upload-proof">
                        <label>Upload Payment Proof</label>
                        <input type="file" id="topupPaymentProof" accept="image/*">
                    </div>
                </div>
                <button class="btn-primary" onclick="submitTopup(${amount})">
                    Submit Payment
                </button>
            </div>
        `;

        window.paymentSettings = settings;
        closeTopupModal();
        document.getElementById('paymentModal').classList.add('active');
    } catch (error) {
        console.error('Error processing topup:', error);
        alert('Top up failed. Please try again.');
    }
}

// Show Top Up Payment Details
function showTopupPaymentDetails() {
    const method = document.getElementById('topupMethodSelect').value;
    const settings = window.paymentSettings;
    const section = document.getElementById('topupPaymentDetailsSection');
    const info = document.getElementById('topupPaymentInfo');

    if (!method) {
        section.style.display = 'none';
        return;
    }

    let details = '';
    if (method === 'bank') {
        details = `
            <p><strong>Bank:</strong> ${settings.bankName}</p>
            <p><strong>Account Number:</strong> ${settings.bankAccount}</p>
            <p><strong>Account Name:</strong> DOOMINIKS STORE</p>
        `;
    } else if (method === 'ewallet') {
        details = `
            <p><strong>E-Wallet:</strong> ${settings.ewalletType}</p>
            <p><strong>Number:</strong> ${settings.ewalletNumber}</p>
            <p><strong>Name:</strong> DOOMINIKS STORE</p>
        `;
    }

    info.innerHTML = details + '<p style="margin-top: 1rem; color: var(--primary-red);">Please make the payment and upload proof below.</p>';
    section.style.display = 'block';
}

// Submit Top Up
async function submitTopup(amount) {
    const proofFile = document.getElementById('topupPaymentProof').files[0];
    const method = document.getElementById('topupMethodSelect').value;

    if (!proofFile) {
        alert('Please upload payment proof');
        return;
    }

    try {
        // Upload payment proof
        const storageRef = storage.ref(`topup-proofs/${Date.now()}_${proofFile.name}`);
        await storageRef.put(proofFile);
        const proofUrl = await storageRef.getDownloadURL();

        // Create top up request
        await db.collection('topups').add({
            userId: currentUser.username,
            amount: amount,
            paymentMethod: method,
            paymentProof: proofUrl,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('Top up request submitted! We will process it shortly.');
        closePaymentModal();
    } catch (error) {
        console.error('Top up submission error:', error);
        alert('Failed to submit top up. Please try again.');
    }
}

// Load Reviews
async function loadReviews() {
    try {
        const snapshot = await db.collection('reviews').orderBy('createdAt', 'desc').get();
        allReviews = [];
        snapshot.forEach(doc => {
            allReviews.push({ id: doc.id, ...doc.data() });
        });
        displayReviews();
    } catch (error) {
        console.error('Error loading reviews:', error);
    }
}

// Display Reviews
function displayReviews() {
    const container = document.getElementById('reviewsContainer');
    container.innerHTML = '';

    if (allReviews.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No reviews yet.</p>';
        return;
    }

    allReviews.forEach(review => {
        const card = document.createElement('div');
        card.className = 'review-card';
        
        const stars = '⭐'.repeat(review.rating);
        
        card.innerHTML = `
            <div class="review-header">
                <div class="reviewer-info">
                    <span class="reviewer-badge">${review.userBadge || '👤'}</span>
                    <span class="reviewer-name">${review.username}</span>
                </div>
                <div class="review-rating">${stars}</div>
            </div>
            <p class="review-text">${review.text}</p>
            <p class="review-product">Product: ${review.productName}</p>
        `;
        container.appendChild(card);
    });
}

// Load Orders
async function loadOrders() {
    try {
        const snapshot = await db.collection('orders')
            .where('userId', '==', currentUser.username)
            .orderBy('createdAt', 'desc')
            .get();
        
        allOrders = [];
        snapshot.forEach(doc => {
            allOrders.push({ id: doc.id, ...doc.data() });
        });
        displayOrders();
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

// Display Orders
function displayOrders() {
    const container = document.getElementById('ordersContainer');
    container.innerHTML = '';

    if (allOrders.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No orders yet.</p>';
        return;
    }

    allOrders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-card';
        
        const statusClass = order.status === 'processing' ? 'status-processing' : 
                          order.status === 'shipped' ? 'status-shipped' : 'status-pending';
        
        const statusText = order.status === 'processing' ? 'Processing' : 
                         order.status === 'shipped' ? 'Shipped/Received' : 'Pending';
        
        const date = order.createdAt ? new Date(order.createdAt.toDate()).toLocaleDateString() : 'N/A';
        
        card.innerHTML = `
            <div class="order-header">
                <span class="order-id">Order #${order.id.substring(0, 8)}</span>
                <span class="order-status ${statusClass}">${statusText}</span>
            </div>
            <div class="order-details">
                <p class="order-product">${order.productName}</p>
                <p>Amount: ${order.paymentMethod === 'coins' ? `${order.amount} Coins` : `Rp ${order.amount.toLocaleString()}`}</p>
                <p>Payment: ${order.paymentMethod === 'coins' ? 'Coins' : order.paymentMethod === 'bank' ? 'Bank Transfer' : 'E-Wallet'}</p>
                <p class="order-date">${date}</p>
                ${order.status === 'shipped' && order.paymentMethod !== 'coins' ? `
                    <button class="btn-primary" style="margin-top: 1rem;" onclick="submitReview('${order.id}', '${order.productName}')">
                        Write Review
                    </button>
                ` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

// Submit Review
async function submitReview(orderId, productName) {
    const rating = prompt('Rate this product (1-5 stars):');
    if (!rating || rating < 1 || rating > 5) {
        alert('Please enter a valid rating (1-5)');
        return;
    }

    const text = prompt('Write your review:');
    if (!text) {
        alert('Please write a review');
        return;
    }

    try {
        await db.collection('reviews').add({
            userId: currentUser.username,
            username: currentUser.username,
            userBadge: currentUser.badge,
            productName: productName,
            rating: parseInt(rating),
            text: text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('Thank you for your review!');
        loadReviews();
    } catch (error) {
        console.error('Error submitting review:', error);
        alert('Failed to submit review. Please try again.');
    }
}

// Chat Functions
async function loadChatMessages() {
    try {
        const snapshot = await db.collection('chats')
            .where('userId', '==', currentUser.username)
            .orderBy('timestamp', 'asc')
            .get();
        
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';

        snapshot.forEach(doc => {
            const msg = doc.data();
            addMessageToUI(msg.sender, msg.message, msg.timestamp);
        });

        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Error loading chat:', error);
    }
}

// Add Message to UI
function addMessageToUI(sender, message, timestamp) {
    const container = document.getElementById('chatMessages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender === currentUser.username ? 'user' : 'support'}`;
    
    const time = timestamp ? new Date(timestamp.toDate()).toLocaleTimeString() : new Date().toLocaleTimeString();
    
    msgDiv.innerHTML = `
        <div class="message-sender">${sender === currentUser.username ? 'You' : 'Support'}</div>
        <div>${message}</div>
        <div class="message-time">${time}</div>
    `;
    
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

// Send Message
async function sendMessage() {
    const input = document.getElementById('chatMessageInput');
    const message = input.value.trim();
    
    if (!message) return;

    try {
        await db.collection('chats').add({
            userId: currentUser.username,
            sender: currentUser.username,
            message: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        input.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Enter key to send message
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatMessageInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
});

// Load Settings (Discord link, etc.)
async function loadSettings() {
    try {
        const doc = await db.collection('settings').doc('general').get();
        if (doc.exists) {
            const data = doc.data();
            if (data.discordLink) {
                const btn = document.getElementById('discordButton');
                btn.href = data.discordLink;
                btn.style.display = 'flex';
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// ===== OWNER FUNCTIONS =====

// Load Owner Data
async function loadOwnerData() {
    loadOwnerProducts();
    loadOwnerOrders();
    loadTransactions();
    loadOwnerSettings();
}

// Load Owner Products
async function loadOwnerProducts() {
    const list = document.getElementById('ownerProductsList');
    list.innerHTML = '';

    allProducts.forEach(product => {
        const item = document.createElement('div');
        item.className = 'owner-product-item';
        item.innerHTML = `
            <h4>${product.name}</h4>
            <p>Price: Rp ${product.price.toLocaleString()} / ${product.priceCoins} Coins</p>
            <p>Stock: ${product.stock}</p>
            <p>Discount: ${product.discount}%</p>
            <button class="btn-danger" onclick="deleteProduct('${product.id}')">Delete</button>
        `;
        list.appendChild(item);
    });
}

// Add Product
async function addProduct() {
    const name = document.getElementById('productName').value.trim();
    const description = document.getElementById('productDescription').value.trim();
    const price = parseInt(document.getElementById('productPrice').value);
    const priceCoins = parseInt(document.getElementById('productPriceCoins').value);
    const stock = parseInt(document.getElementById('productStock').value);
    const discount = parseInt(document.getElementById('productDiscount').value) || 0;
    const imageFile = document.getElementById('productImage').files[0];

    if (!name || !description || !price || !priceCoins || !stock) {
        alert('Please fill in all required fields');
        return;
    }

    try {
        let imageUrl = '';
        
        if (imageFile) {
            const storageRef = storage.ref(`products/${Date.now()}_${imageFile.name}`);
            await storageRef.put(imageFile);
            imageUrl = await storageRef.getDownloadURL();
        }

        await db.collection('products').add({
            name: name,
            description: description,
            price: price,
            priceCoins: priceCoins,
            stock: stock,
            discount: discount,
            imageUrl: imageUrl,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('Product added successfully!');
        
        // Clear form
        document.getElementById('productName').value = '';
        document.getElementById('productDescription').value = '';
        document.getElementById('productPrice').value = '';
        document.getElementById('productPriceCoins').value = '';
        document.getElementById('productStock').value = '';
        document.getElementById('productDiscount').value = '0';
        document.getElementById('productImage').value = '';
        
        loadProducts();
    } catch (error) {
        console.error('Error adding product:', error);
        alert('Failed to add product. Please try again.');
    }
}

// Delete Product
async function deleteProduct(productId) {
    if (confirm('Are you sure you want to delete this product?')) {
        try {
            await db.collection('products').doc(productId).delete();
            alert('Product deleted successfully!');
            loadProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Failed to delete product. Please try again.');
        }
    }
}

// Load Owner Orders
async function loadOwnerOrders() {
    try {
        const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
        const list = document.getElementById('ownerOrdersList');
        list.innerHTML = '';

        snapshot.forEach(doc => {
            const order = doc.data();
            const item = document.createElement('div');
            item.className = 'owner-order-item';
            
            const date = order.createdAt ? new Date(order.createdAt.toDate()).toLocaleDateString() : 'N/A';
            
            item.innerHTML = `
                <h4>Order #${doc.id.substring(0, 8)}</h4>
                <p>Customer: ${order.userId}</p>
                <p>Product: ${order.productName}</p>
                <p>Amount: ${order.paymentMethod === 'coins' ? `${order.amount} Coins` : `Rp ${order.amount.toLocaleString()}`}</p>
                <p>Status: ${order.status}</p>
                <p>Date: ${date}</p>
                ${order.paymentProof ? `<p><a href="${order.paymentProof}" target="_blank" style="color: var(--primary-red);">View Payment Proof</a></p>` : ''}
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    ${order.status !== 'shipped' ? `
                        <button class="btn-primary" onclick="updateOrderStatus('${doc.id}', 'shipped')">Mark as Shipped</button>
                    ` : ''}
                    ${order.status === 'pending' ? `
                        <button class="btn-danger" onclick="updateOrderStatus('${doc.id}', 'processing')">Approve Payment</button>
                    ` : ''}
                </div>
            `;
            list.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading owner orders:', error);
    }
}

// Update Order Status
async function updateOrderStatus(orderId, newStatus) {
    try {
        await db.collection('orders').doc(orderId).update({
            status: newStatus
        });

        // If approving payment, also update stock
        if (newStatus === 'processing') {
            const orderDoc = await db.collection('orders').doc(orderId).get();
            const order = orderDoc.data();
            
            const productDoc = await db.collection('products').doc(order.productId).get();
            if (productDoc.exists) {
                const product = productDoc.data();
                await db.collection('products').doc(order.productId).update({
                    stock: product.stock - 1
                });
            }
        }

        alert('Order status updated!');
        loadOwnerOrders();
        loadProducts();
    } catch (error) {
        console.error('Error updating order:', error);
        alert('Failed to update order status.');
    }
}

// Give Badge
async function giveBadge() {
    const username = document.getElementById('badgeUsername').value.trim();
    const badgeType = document.getElementById('badgeType').value;

    if (!username) {
        alert('Please enter a username');
        return;
    }

    const badges = {
        warrior: '⚔️',
        elite: '💎',
        master: '🏆',
        grandmaster: '👑',
        mythical: '🔮'
    };

    try {
        const userDoc = await db.collection('users').doc(username).get();
        if (!userDoc.exists) {
            alert('User not found');
            return;
        }

        await db.collection('users').doc(username).update({
            badge: badges[badgeType]
        });

        alert(`Badge given to ${username} successfully!`);
        document.getElementById('badgeUsername').value = '';
    } catch (error) {
        console.error('Error giving badge:', error);
        alert('Failed to give badge. Please try again.');
    }
}

// Load Owner Settings
async function loadOwnerSettings() {
    try {
        // Load payment settings
        const paymentDoc = await db.collection('settings').doc('payment').get();
        if (paymentDoc.exists) {
            const data = paymentDoc.data();
            document.getElementById('bankName').value = data.bankName || '';
            document.getElementById('bankAccount').value = data.bankAccount || '';
            document.getElementById('ewalletType').value = data.ewalletType || '';
            document.getElementById('ewalletNumber').value = data.ewalletNumber || '';
        }

        // Load general settings
        const generalDoc = await db.collection('settings').doc('general').get();
        if (generalDoc.exists) {
            const data = generalDoc.data();
            document.getElementById('discordLink').value = data.discordLink || '';
        }

        // Load owner account
        document.getElementById('ownerUsername').value = currentUser.username;
    } catch (error) {
        console.error('Error loading owner settings:', error);
    }
}

// Update Owner Account
async function updateOwnerAccount() {
    const newUsername = document.getElementById('ownerUsername').value.trim();
    const newPassword = document.getElementById('ownerNewPassword').value;

    if (!newUsername) {
        alert('Username cannot be empty');
        return;
    }

    try {
        const updates = {};
        
        if (newPassword) {
            updates.password = newPassword;
        }

        await db.collection('users').doc(currentUser.username).update(updates);

        alert('Account updated successfully!');
        document.getElementById('ownerNewPassword').value = '';
    } catch (error) {
        console.error('Error updating account:', error);
        alert('Failed to update account.');
    }
}

// Update Payment Settings
async function updatePaymentSettings() {
    const bankName = document.getElementById('bankName').value.trim();
    const bankAccount = document.getElementById('bankAccount').value.trim();
    const ewalletType = document.getElementById('ewalletType').value.trim();
    const ewalletNumber = document.getElementById('ewalletNumber').value.trim();

    try {
        await db.collection('settings').doc('payment').set({
            bankName: bankName,
            bankAccount: bankAccount,
            ewalletType: ewalletType,
            ewalletNumber: ewalletNumber
        });

        alert('Payment settings updated successfully!');
    } catch (error) {
        console.error('Error updating payment settings:', error);
        alert('Failed to update payment settings.');
    }
}

// Update Discord Link
async function updateDiscordLink() {
    const discordLink = document.getElementById('discordLink').value.trim();

    try {
        await db.collection('settings').doc('general').set({
            discordLink: discordLink
        }, { merge: true });

        alert('Discord link updated successfully!');
        loadSettings();
    } catch (error) {
        console.error('Error updating Discord link:', error);
        alert('Failed to update Discord link.');
    }
}

// Load Transactions
async function loadTransactions() {
    try {
        const snapshot = await db.collection('transactions').orderBy('timestamp', 'desc').limit(50).get();
        const list = document.getElementById('transactionsList');
        list.innerHTML = '';

        snapshot.forEach(doc => {
            const trans = doc.data();
            const item = document.createElement('div');
            item.className = 'transaction-item';
            
            const date = trans.timestamp ? new Date(trans.timestamp.toDate()).toLocaleString() : 'N/A';
            
            item.innerHTML = `
                <p><strong>${trans.userId}</strong> - ${trans.type}</p>
                <p>${trans.productName || 'Top Up'}</p>
                <p>Amount: ${trans.method === 'coins' ? `${trans.amount} Coins` : `Rp ${trans.amount.toLocaleString()}`}</p>
                <p>Method: ${trans.method}</p>
                <p>${date}</p>
            `;
            list.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

// Setup Real-time Listeners
function setupRealtimeListeners() {
    // Listen to products changes
    db.collection('products').onSnapshot(() => {
        loadProducts();
        if (currentUser.isOwner) {
            loadOwnerProducts();
        }
    });

    // Listen to reviews changes
    db.collection('reviews').onSnapshot(() => {
        loadReviews();
    });

    // Listen to chat messages
    db.collection('chats')
        .where('userId', '==', currentUser.username)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const msg = change.doc.data();
                    if (document.getElementById('chatMessages').children.length > 0) {
                        addMessageToUI(msg.sender, msg.message, msg.timestamp);
                    }
                }
            });
        });

    // Listen to user balance changes
    db.collection('users').doc(currentUser.username).onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            currentUser.balance = data.balance || 0;
            currentUser.coins = data.coins || 0;
            currentUser.badge = data.badge || '👤';
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateUserDisplay();
        }
    });

    if (currentUser.isOwner) {
        // Listen to orders for owner
        db.collection('orders').onSnapshot(() => {
            loadOwnerOrders();
        });

        // Listen to transactions
        db.collection('transactions').onSnapshot(() => {
            loadTransactions();
        });
    }
}