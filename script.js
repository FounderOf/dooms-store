// ===== Firebase Configuration =====
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const storage = firebase.storage();
const auth = firebase.auth();

// ===== Global State =====
let currentUser = null;
let currentOrder = null;
let selectedPaymentMethod = null;
let selectedTopupPackage = null;
let ownerUsername = 'doominiks'; // Default owner username

// ===== Loading Screen =====
window.addEventListener('load', () => {
    const loadingScreen = document.getElementById('loadingScreen');
    const loadingProgress = document.querySelector('.loading-progress');
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += 5;
        loadingProgress.style.width = progress + '%';
        
        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }, 500);
        }
    }, 100);
    
    // Initialize app
    initApp();
});

// ===== Initialize App =====
function initApp() {
    loadSettings();
    loadProducts();
    loadReviews();
    checkAuth();
    setupEventListeners();
}

// ===== Setup Event Listeners =====
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Register form
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    
    // Product form
    document.getElementById('productForm').addEventListener('submit', handleProductSubmit);
    
    // File preview
    document.getElementById('proofFile').addEventListener('change', handleFilePreview);
    document.getElementById('productImage').addEventListener('change', handleProductImagePreview);
}

// ===== Authentication =====
function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateUserMenu();
        loadUserData();
    }
}

function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    database.ref('users/' + username).once('value', snapshot => {
        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.password === password) {
                currentUser = {
                    username: username,
                    email: userData.email,
                    coins: userData.coins || 0,
                    balance: userData.balance || 0,
                    badges: userData.badges || [],
                    joinDate: userData.joinDate
                };
                
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                updateUserMenu();
                loadUserData();
                closeModal('loginModal');
                showToast('Login berhasil! Selamat datang, ' + username, 'success');
                
                // Check if owner
                if (username === ownerUsername) {
                    document.getElementById('ownerPanelBtn').style.display = 'flex';
                }
            } else {
                showToast('Password salah!', 'error');
            }
        } else {
            showToast('Username tidak ditemukan!', 'error');
        }
    });
}

function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    
    if (password !== confirmPassword) {
        showToast('Password tidak cocok!', 'error');
        return;
    }
    
    database.ref('users/' + username).once('value', snapshot => {
        if (snapshot.exists()) {
            showToast('Username sudah digunakan!', 'error');
        } else {
            const newUser = {
                username: username,
                email: email,
                password: password,
                coins: 0,
                balance: 0,
                badges: [],
                joinDate: new Date().toISOString()
            };
            
            database.ref('users/' + username).set(newUser, error => {
                if (error) {
                    showToast('Gagal mendaftar: ' + error.message, 'error');
                } else {
                    showToast('Pendaftaran berhasil! Silakan login.', 'success');
                    closeModal('registerModal');
                    showLogin();
                }
            });
        }
    });
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateUserMenu();
    closeModal('profileModal');
    showToast('Logout berhasil!', 'success');
}

function updateUserMenu() {
    const userMenu = document.getElementById('userMenu');
    
    if (currentUser) {
        userMenu.innerHTML = `
            <button class="nav-btn" onclick="openProfile()">
                <i class="fas fa-user"></i> ${currentUser.username}
            </button>
            ${currentUser.username === ownerUsername ? `
                <button class="nav-btn login-btn" onclick="openOwnerPanel()">
                    <i class="fas fa-crown"></i> Owner
                </button>
            ` : ''}
        `;
    } else {
        userMenu.innerHTML = `
            <button class="nav-btn login-btn" onclick="showLogin()">
                <i class="fas fa-user"></i> Login
            </button>
        `;
    }
}

// ===== Load Settings =====
function loadSettings() {
    database.ref('settings').once('value', snapshot => {
        if (snapshot.exists()) {
            const settings = snapshot.val();
            if (settings.ownerUsername) {
                ownerUsername = settings.ownerUsername;
            }
            if (settings.discordLink) {
                window.discordLink = settings.discordLink;
            }
            if (settings.bankAccount) {
                window.bankAccount = settings.bankAccount;
            }
            if (settings.ewalletNumber) {
                window.ewalletNumber = settings.ewalletNumber;
            }
            if (settings.globalDiscount) {
                window.globalDiscount = settings.globalDiscount;
            }
        }
    });
}

// ===== Products =====
function loadProducts() {
    database.ref('products').once('value', snapshot => {
        const products = [];
        snapshot.forEach(child => {
            products.push({
                id: child.key,
                ...child.val()
            });
        });
        
        displayProducts(products);
        displayFeaturedProducts(products);
        updateOwnerProductsList(products);
        updateHomeStats(products);
    });
}

function displayProducts(products) {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = '';
    
    products.forEach(product => {
        const card = createProductCard(product);
        grid.appendChild(card);
    });
}

function displayFeaturedProducts(products) {
    const grid = document.getElementById('featuredProducts');
    grid.innerHTML = '';
    
    const featured = products.slice(0, 4);
    featured.forEach(product => {
        const card = createProductCard(product);
        grid.appendChild(card);
    });
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const stockClass = product.stock > 0 ? 'in-stock' : 'out-of-stock';
    const stockText = product.stock > 0 ? `Stok: ${product.stock}` : 'Habis';
    
    const discount = window.globalDiscount || 0;
    const discountedPrice = product.price - (product.price * discount / 100);
    
    card.innerHTML = `
        <img src="${product.image || 'https://via.placeholder.com/300x200?text=No+Image'}" alt="${product.name}" class="product-image">
        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-description">${product.description}</p>
            <div class="product-prices">
                <span class="product-price">Rp ${formatNumber(discountedPrice)}</span>
                <span class="product-coins"><i class="fas fa-coins"></i> ${formatNumber(product.coins)} Coins</span>
            </div>
            <p class="product-stock ${stockClass}">${stockText}</p>
            <div class="product-actions">
                <button class="btn btn-primary" onclick="buyProduct('${product.id}')" ${product.stock === 0 ? 'disabled' : ''}>
                    <i class="fas fa-shopping-cart"></i> Beli
                </button>
                <button class="btn btn-secondary" onclick="viewProductDetails('${product.id}')">
                    <i class="fas fa-eye"></i> Detail
                </button>
            </div>
        </div>
    `;
    
    return card;
}

function searchProducts() {
    const search = document.getElementById('productSearch').value.toLowerCase();
    const filter = document.getElementById('productFilter').value;
    
    database.ref('products').once('value', snapshot => {
        let products = [];
        snapshot.forEach(child => {
            const product = { id: child.key, ...child.val() };
            
            const matchSearch = product.name.toLowerCase().includes(search) ||
                              product.description.toLowerCase().includes(search);
            const matchFilter = filter === 'all' || product.category === filter;
            
            if (matchSearch && matchFilter) {
                products.push(product);
            }
        });
        
        displayProducts(products);
    });
}

function filterProducts() {
    searchProducts();
}

// ===== Buy Product =====
function buyProduct(productId) {
    if (!currentUser) {
        showToast('Silakan login terlebih dahulu!', 'error');
        showLogin();
        return;
    }
    
    database.ref('products/' + productId).once('value', snapshot => {
        if (snapshot.exists()) {
            const product = snapshot.val();
            
            if (product.stock <= 0) {
                showToast('Stok produk habis!', 'error');
                return;
            }
            
            currentOrder = {
                productId: productId,
                productName: product.name,
                productImage: product.image,
                price: product.price,
                coins: product.coins,
                stock: product.stock
            };
            
            showPaymentModal(product);
        }
    });
}

function showPaymentModal(product) {
    const modal = document.getElementById('paymentModal');
    const summary = document.getElementById('orderSummary');
    const options = document.getElementById('paymentOptions');
    const instructions = document.getElementById('paymentInstructions');
    
    const discount = window.globalDiscount || 0;
    const discountedPrice = product.price - (product.price * discount / 100);
    
    summary.innerHTML = `
        <div class="order-item">
            <img src="${product.image || 'https://via.placeholder.com/60'}" alt="${product.name}">
            <div class="order-item-info">
                <p class="order-item-name">${product.name}</p>
                <p class="order-item-price">Rp ${formatNumber(discountedPrice)} atau ${formatNumber(product.coins)} Coins</p>
            </div>
        </div>
    `;
    
    options.innerHTML = `
        <div class="payment-option" onclick="selectPayment('bank')">
            <i class="fas fa-university"></i>
            <span>Transfer Bank</span>
        </div>
        <div class="payment-option" onclick="selectPayment('ewallet')">
            <i class="fas fa-wallet"></i>
            <span>E-Wallet</span>
        </div>
        <div class="payment-option" onclick="selectPayment('coins')">
            <i class="fas fa-coins"></i>
            <span>Coins</span>
        </div>
    `;
    
    instructions.innerHTML = `
        <li>Pilih metode pembayaran</li>
        <li>Lakukan pembayaran sesuai nominal</li>
        <li>Upload bukti transfer</li>
        <li>Tunggu konfirmasi dari admin</li>
    `;
    
    modal.classList.add('active');
}

function selectPayment(method) {
    selectedPaymentMethod = method;
    
    document.querySelectorAll('.payment-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    event.target.closest('.payment-option').classList.add('selected');
    
    const instructions = document.getElementById('paymentInstructions');
    
    if (method === 'bank') {
        instructions.innerHTML = `
            <li>Transfer ke: ${window.bankAccount || 'Belum diatur'}</li>
            <li>Nominal: Rp ${formatNumber(currentOrder.price)}</li>
            <li>Upload bukti transfer</li>
            <li>Tunggu konfirmasi dari admin</li>
        `;
    } else if (method === 'ewallet') {
        instructions.innerHTML = `
            <li>Transfer ke E-Wallet: ${window.ewalletNumber || 'Belum diatur'}</li>
            <li>Nominal: Rp ${formatNumber(currentOrder.price)}</li>
            <li>Upload bukti transfer</li>
            <li>Tunggu konfirmasi dari admin</li>
        `;
    } else if (method === 'coins') {
        instructions.innerHTML = `
            <li>Pembayaran akan langsung dipotong dari saldo Coins Anda</li>
            <li>Jumlah: ${formatNumber(currentOrder.coins)} Coins</li>
            <li>Saldo Coins Anda: ${formatNumber(currentUser.coins)}</li>
            <li>Pesanan akan langsung diproses</li>
        `;
    }
}

function submitPayment() {
    if (!selectedPaymentMethod) {
        showToast('Pilih metode pembayaran!', 'error');
        return;
    }
    
    const proofFile = document.getElementById('proofFile').files[0];
    
    if (selectedPaymentMethod === 'coins') {
        // Instant payment with coins
        if (currentUser.coins < currentOrder.coins) {
            showToast('Coins tidak mencukupi!', 'error');
            return;
        }
        
        processOrder('coins', 'paid');
    } else {
        // Payment with proof upload
        if (!proofFile) {
            showToast('Upload bukti transfer terlebih dahulu!', 'error');
            return;
        }
        
        // Upload proof
        const storageRef = storage.ref('proofs/' + Date.now() + '_' + proofFile.name);
        storageRef.put(proofFile).then(snapshot => {
            snapshot.ref.getDownloadURL().then(url => {
                processOrder(selectedPaymentMethod, 'pending', url);
            });
        }).catch(error => {
            showToast('Gagal upload bukti: ' + error.message, 'error');
        });
    }
}

function processOrder(paymentMethod, status, proofUrl = '') {
    const order = {
        username: currentUser.username,
        productId: currentOrder.productId,
        productName: currentOrder.productName,
        productImage: currentOrder.productImage,
        price: currentOrder.price,
        coins: currentOrder.coins,
        paymentMethod: paymentMethod,
        proofUrl: proofUrl,
        status: status,
        orderDate: new Date().toISOString()
    };
    
    database.ref('orders').push(order, error => {
        if (error) {
            showToast('Gagal membuat pesanan: ' + error.message, 'error');
        } else {
            // Deduct coins if paid with coins
            if (paymentMethod === 'coins') {
                database.ref('users/' + currentUser.username).update({
                    coins: currentUser.coins - currentOrder.coins
                });
                
                currentUser.coins -= currentOrder.coins;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }
            
            // Reduce stock
            database.ref('products/' + currentOrder.productId).update({
                stock: currentOrder.stock - 1
            });
            
            showToast('Pesanan berhasil dibuat!', 'success');
            closeModal('paymentModal');
            loadProducts();
            loadUserData();
        }
    });
}

// ===== Reviews =====
function loadReviews() {
    database.ref('reviews').once('value', snapshot => {
        const reviews = [];
        snapshot.forEach(child => {
            reviews.push({
                id: child.key,
                ...child.val()
            });
        });
        
        displayReviews(reviews);
    });
}

function displayReviews(reviews) {
    const container = document.getElementById('reviewsContainer');
    container.innerHTML = '';
    
    if (reviews.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Belum ada ulasan.</p>';
        return;
    }
    
    reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    reviews.forEach(review => {
        const card = document.createElement('div');
        card.className = 'review-card';
        
        const badgesHtml = review.badges ? review.badges.map(badge => {
            return `<span class="badge badge-${badge}"><i class="fas fa-medal"></i> ${capitalize(badge)}</span>`;
        }).join('') : '';
        
        let stars = '';
        for (let i = 0; i < 5; i++) {
            stars += i < review.rating ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
        }
        
        card.innerHTML = `
            <div class="review-header">
                <div class="review-user">
                    <div class="review-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <p class="review-username">${review.username}</p>
                        <div class="review-badges">${badgesHtml}</div>
                    </div>
                </div>
                <div class="review-rating">${stars}</div>
            </div>
            <p class="review-content">${review.content}</p>
            <p class="review-date">${formatDate(review.date)}</p>
        `;
        
        container.appendChild(card);
    });
}

function showReviewForm() {
    if (!currentUser) {
        showToast('Silakan login terlebih dahulu!', 'error');
        showLogin();
        return;
    }
    
    const content = prompt('Tulis ulasan Anda:');
    if (!content) return;
    
    const rating = prompt('Rating (1-5):');
    if (!rating || rating < 1 || rating > 5) {
        showToast('Rating harus antara 1-5!', 'error');
        return;
    }
    
    const review = {
        username: currentUser.username,
        content: content,
        rating: parseInt(rating),
        badges: currentUser.badges || [],
        date: new Date().toISOString()
    };
    
    database.ref('reviews').push(review, error => {
        if (error) {
            showToast('Gagal mengirim ulasan: ' + error.message, 'error');
        } else {
            showToast('Ulasan berhasil dikirim!', 'success');
            loadReviews();
        }
    });
}

// ===== Top Up =====
function showTopup() {
    const modal = document.getElementById('topupModal');
    const packages = document.getElementById('coinPackages');
    const paymentOptions = document.getElementById('topupPaymentOptions');
    
    packages.innerHTML = `
        <div class="package-card" onclick="selectTopupPackage(100, 10000)">
            <i class="fas fa-coins"></i>
            <p class="coins">100 Coins</p>
            <p class="price">Rp 10.000</p>
        </div>
        <div class="package-card" onclick="selectTopupPackage(250, 25000)">
            <i class="fas fa-coins"></i>
            <p class="coins">250 Coins</p>
            <p class="price">Rp 25.000</p>
        </div>
        <div class="package-card" onclick="selectTopupPackage(500, 48000)">
            <i class="fas fa-coins"></i>
            <p class="coins">500 Coins</p>
            <p class="price">Rp 48.000</p>
        </div>
        <div class="package-card" onclick="selectTopupPackage(1000, 90000)">
            <i class="fas fa-coins"></i>
            <p class="coins">1000 Coins</p>
            <p class="price">Rp 90.000</p>
        </div>
        <div class="package-card" onclick="selectTopupPackage(2500, 220000)">
            <i class="fas fa-coins"></i>
            <p class="coins">2500 Coins</p>
            <p class="price">Rp 220.000</p>
        </div>
        <div class="package-card" onclick="selectTopupPackage(5000, 430000)">
            <i class="fas fa-coins"></i>
            <p class="coins">5000 Coins</p>
            <p class="price">Rp 430.000</p>
        </div>
    `;
    
    paymentOptions.innerHTML = `
        <div class="payment-option" onclick="selectTopupPayment('bank')">
            <i class="fas fa-university"></i>
            <span>Transfer Bank</span>
        </div>
        <div class="payment-option" onclick="selectTopupPayment('ewallet')">
            <i class="fas fa-wallet"></i>
            <span>E-Wallet</span>
        </div>
    `;
    
    modal.classList.add('active');
}

function selectTopupPackage(coins, price) {
    selectedTopupPackage = { coins, price };
    
    document.querySelectorAll('.package-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    event.target.closest('.package-card').classList.add('selected');
}

function selectTopupPayment(method) {
    selectedPaymentMethod = method;
    
    document.querySelectorAll('.payment-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    event.target.closest('.payment-option').classList.add('selected');
}

function submitTopup() {
    const customCoins = document.getElementById('customCoins').value;
    
    if (!selectedTopupPackage && !customCoins) {
        showToast('Pilih paket coins atau masukkan jumlah custom!', 'error');
        return;
    }
    
    if (!selectedPaymentMethod) {
        showToast('Pilih metode pembayaran!', 'error');
        return;
    }
    
    const coins = selectedTopupPackage ? selectedTopupPackage.coins : parseInt(customCoins);
    const price = selectedTopupPackage ? selectedTopupPackage.price : coins * 100;
    
    const proofFile = document.getElementById('proofFile').files[0];
    
    if (!proofFile) {
        showToast('Upload bukti transfer terlebih dahulu!', 'error');
        return;
    }
    
    const storageRef = storage.ref('proofs/' + Date.now() + '_' + proofFile.name);
    storageRef.put(proofFile).then(snapshot => {
        snapshot.ref.getDownloadURL().then(url => {
            const topup = {
                username: currentUser.username,
                coins: coins,
                price: price,
                paymentMethod: selectedPaymentMethod,
                proofUrl: url,
                status: 'pending',
                date: new Date().toISOString()
            };
            
            database.ref('topups').push(topup, error => {
                if (error) {
                    showToast('Gagal membuat top up: ' + error.message, 'error');
                } else {
                    showToast('Top up berhasil dibuat! Tunggu konfirmasi admin.', 'success');
                    closeModal('topupModal');
                }
            });
        });
    });
}

// ===== Orders =====
function showOrders() {
    if (!currentUser) return;
    
    const modal = document.getElementById('ordersModal');
    const container = document.getElementById('ordersContainer');
    
    database.ref('orders').orderByChild('username').equalTo(currentUser.username).once('value', snapshot => {
        container.innerHTML = '';
        
        if (!snapshot.exists()) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Belum ada pesanan.</p>';
        } else {
            snapshot.forEach(child => {
                const order = child.val();
                const card = createOrderCard(order, child.key);
                container.appendChild(card);
            });
        }
        
        modal.classList.add('active');
    });
}

function createOrderCard(order, orderId) {
    const card = document.createElement('div');
    card.className = 'order-card';
    
    card.innerHTML = `
        <div class="order-header">
            <span class="order-id">Order #${orderId.substr(0, 8).toUpperCase()}</span>
            <span class="order-status ${order.status}">${capitalize(order.status)}</span>
        </div>
        <div class="order-items">
            <div class="order-item">
                <img src="${order.productImage || 'https://via.placeholder.com/60'}" alt="${order.productName}">
                <div class="order-item-info">
                    <p class="order-item-name">${order.productName}</p>
                    <p class="order-item-price">Rp ${formatNumber(order.price)} / ${formatNumber(order.coins)} Coins</p>
                </div>
            </div>
        </div>
        <p class="order-total">Total: Rp ${formatNumber(order.price)}</p>
        <p class="order-date">${formatDate(order.orderDate)}</p>
        ${order.status === 'pending' && order.proofUrl ? `
            <p style="color: var(--text-secondary); margin-top: 10px; font-size: 12px;">
                <i class="fas fa-check-circle"></i> Bukti transfer sudah diupload
            </p>
        ` : ''}
    `;
    
    return card;
}

// ===== Profile =====
function openProfile() {
    if (!currentUser) return;
    
    const modal = document.getElementById('profileModal');
    
    document.getElementById('profileUsername').textContent = currentUser.username;
    document.getElementById('profileCoins').textContent = formatNumber(currentUser.coins);
    document.getElementById('profileBalance').textContent = 'Rp ' + formatNumber(currentUser.balance);
    
    const badgesContainer = document.getElementById('profileBadges');
    badgesContainer.innerHTML = '';
    
    if (currentUser.badges && currentUser.badges.length > 0) {
        currentUser.badges.forEach(badge => {
            const badgeEl = document.createElement('span');
            badgeEl.className = `badge badge-${badge}`;
            badgeEl.innerHTML = `<i class="fas fa-medal"></i> ${capitalize(badge)}`;
            badgesContainer.appendChild(badgeEl);
        });
    }
    
    // Load order count
    database.ref('orders').orderByChild('username').equalTo(currentUser.username).once('value', snapshot => {
        document.getElementById('profileOrders').textContent = snapshot.numChildren();
    });
    
    modal.classList.add('active');
}

function loadUserData() {
    if (!currentUser) return;
    
    database.ref('users/' + currentUser.username).once('value', snapshot => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            currentUser.coins = data.coins || 0;
            currentUser.balance = data.balance || 0;
            currentUser.badges = data.badges || [];
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }
    });
}

// ===== Chat =====
function openChat() {
    const modal = document.getElementById('chatModal');
    modal.classList.add('active');
    
    loadChatMessages();
    
    // Listen for new messages
    if (currentUser) {
        database.ref('chats/' + currentUser.username).limitToLast(50).on('child_added', snapshot => {
            const message = snapshot.val();
            displayChatMessage(message);
        });
    }
}

function loadChatMessages() {
    const container = document.getElementById('chatMessages');
    container.innerHTML = '';
    
    if (!currentUser) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Silakan login untuk chat.</p>';
        return;
    }
    
    database.ref('chats/' + currentUser.username).limitToLast(50).once('value', snapshot => {
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const message = child.val();
                displayChatMessage(message);
            });
        } else {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Belum ada pesan.</p>';
        }
    });
}

function displayChatMessage(message) {
    const container = document.getElementById('chatMessages');
    
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${message.sender}`;
    messageEl.innerHTML = `
        <p>${message.content}</p>
        <p class="time">${formatTime(message.timestamp)}</p>
    `;
    
    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const content = input.value.trim();
    
    if (!content || !currentUser) return;
    
    const message = {
        sender: 'user',
        content: content,
        timestamp: new Date().toISOString()
    };
    
    database.ref('chats/' + currentUser.username).push(message);
    input.value = '';
}

// ===== Owner Panel =====
function openOwnerPanel() {
    if (!currentUser || currentUser.username !== ownerUsername) {
        showToast('Akses ditolak!', 'error');
        return;
    }
    
    const modal = document.getElementById('ownerPanelModal');
    modal.classList.add('active');
    
    loadOwnerDashboard();
}

function loadOwnerDashboard() {
    // Load products count
    database.ref('products').once('value', snapshot => {
        document.getElementById('ownerTotalProducts').textContent = snapshot.numChildren();
    });
    
    // Load orders count
    database.ref('orders').once('value', snapshot => {
        document.getElementById('ownerTotalOrders').textContent = snapshot.numChildren();
        
        // Load recent orders
        const recentOrdersContainer = document.getElementById('ownerRecentOrders');
        recentOrdersContainer.innerHTML = '';
        
        snapshot.limitToLast(5).forEach(child => {
            const order = child.val();
            const card = document.createElement('div');
            card.className = 'order-card';
            card.innerHTML = `
                <div class="order-header">
                    <span class="order-id">${order.username} - ${order.productName}</span>
                    <span class="order-status ${order.status}">${capitalize(order.status)}</span>
                </div>
                <p class="order-total">Rp ${formatNumber(order.price)}</p>
            `;
            recentOrdersContainer.appendChild(card);
        });
    });
    
    // Load users count
    database.ref('users').once('value', snapshot => {
        document.getElementById('ownerTotalUsers').textContent = snapshot.numChildren();
    });
    
    // Load revenue
    database.ref('orders').once('value', snapshot => {
        let revenue = 0;
        snapshot.forEach(child => {
            const order = child.val();
            if (order.status === 'completed') {
                revenue += order.price;
            }
        });
        document.getElementById('ownerTotalRevenue').textContent = 'Rp ' + formatNumber(revenue);
    });
}

function showOwnerTab(tab) {
    document.querySelectorAll('.owner-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    event.target.closest('.tab-btn').classList.add('active');
    document.getElementById('owner' + capitalize(tab)).classList.add('active');
    
    if (tab === 'products') {
        updateOwnerProductsList();
    } else if (tab === 'orders') {
        updateOwnerOrdersList();
    } else if (tab === 'users') {
        updateOwnerUsersList();
    }
}

function updateOwnerProductsList() {
    database.ref('products').once('value', snapshot => {
        const container = document.getElementById('ownerProductsList');
        container.innerHTML = '';
        
        snapshot.forEach(child => {
            const product = child.val();
            const card = document.createElement('div');
            card.className = 'order-card';
            card.innerHTML = `
                <div class="order-header">
                    <span>${product.name}</span>
                    <span>Stok: ${product.stock}</span>
                </div>
                <p>Rp ${formatNumber(product.price)} / ${formatNumber(product.coins)} Coins</p>
                <div style="margin-top: 10px;">
                    <button class="btn btn-secondary" onclick="editProduct('${child.key}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger" onclick="deleteProduct('${child.key}')">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

function updateOwnerOrdersList(filter = 'all') {
    database.ref('orders').once('value', snapshot => {
        const container = document.getElementById('ownerOrdersList');
        container.innerHTML = '';
        
        snapshot.forEach(child => {
            const order = child.val();
            
            if (filter !== 'all' && order.status !== filter) return;
            
            const card = document.createElement('div');
            card.className = 'order-card';
            card.innerHTML = `
                <div class="order-header">
                    <span>${order.username} - ${order.productName}</span>
                    <span class="order-status ${order.status}">${capitalize(order.status)}</span>
                </div>
                <p>Metode: ${order.paymentMethod}</p>
                <p class="order-total">Rp ${formatNumber(order.price)}</p>
                <p class="order-date">${formatDate(order.orderDate)}</p>
                ${order.proofUrl ? `
                    <a href="${order.proofUrl}" target="_blank" style="color: var(--primary-color); display: block; margin-top: 10px;">
                        <i class="fas fa-image"></i> Lihat Bukti Transfer
                    </a>
                ` : ''}
                <div style="margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap;">
                    ${order.status === 'pending' ? `
                        <button class="btn btn-primary" onclick="updateOrderStatus('${child.key}', 'processing')">
                            <i class="fas fa-check"></i> Terima
                        </button>
                        <button class="btn btn-danger" onclick="updateOrderStatus('${child.key}', 'cancelled')">
                            <i class="fas fa-times"></i> Tolak
                        </button>
                    ` : ''}
                    ${order.status === 'processing' ? `
                        <button class="btn btn-primary" onclick="updateOrderStatus('${child.key}', 'shipped')">
                            <i class="fas fa-shipping-fast"></i> Kirim
                        </button>
                    ` : ''}
                    ${order.status === 'shipped' ? `
                        <button class="btn btn-primary" onclick="updateOrderStatus('${child.key}', 'completed')">
                            <i class="fas fa-check-double"></i> Selesai
                        </button>
                    ` : ''}
                </div>
            `;
            container.appendChild(card);
        });
    });
}

function filterOrders(status) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    event.target.closest('.filter-btn').classList.add('active');
    updateOwnerOrdersList(status);
}

function updateOrderStatus(orderId, status) {
    database.ref('orders/' + orderId).update({ status: status }, error => {
        if (error) {
            showToast('Gagal update status: ' + error.message, 'error');
        } else {
            showToast('Status berhasil diupdate!', 'success');
            updateOwnerOrdersList();
        }
    });
}

function updateOwnerUsersList() {
    database.ref('users').once('value', snapshot => {
        const container = document.getElementById('ownerUsersList');
        container.innerHTML = '';
        
        snapshot.forEach(child => {
            const user = child.val();
            const card = document.createElement('div');
            card.className = 'order-card';
            card.innerHTML = `
                <div class="order-header">
                    <span>${user.username}</span>
                    <span>Coins: ${user.coins || 0}</span>
                </div>
                <p>Email: ${user.email}</p>
                <p>Saldo: Rp ${formatNumber(user.balance || 0)}</p>
                <div style="margin-top: 10px;">
                    <button class="btn btn-primary" onclick="showGiveBadge('${user.username}')">
                        <i class="fas fa-medal"></i> Berikan Badge
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

function showAddProduct() {
    document.getElementById('productModalTitle').innerHTML = '<i class="fas fa-box"></i> Tambah Produk';
    document.getElementById('editProductId').value = '';
    document.getElementById('productForm').reset();
    document.getElementById('productImagePreview').innerHTML = '';
    document.getElementById('productModal').classList.add('active');
}

function handleProductSubmit(e) {
    e.preventDefault();
    
    const editId = document.getElementById('editProductId').value;
    const name = document.getElementById('productName').value;
    const description = document.getElementById('productDescription').value;
    const price = parseInt(document.getElementById('productPrice').value);
    const coins = parseInt(document.getElementById('productCoins').value);
    const stock = parseInt(document.getElementById('productStock').value);
    const category = document.getElementById('productCategory').value;
    const imageFile = document.getElementById('productImage').files[0];
    
    const saveProduct = (imageUrl) => {
        const product = {
            name,
            description,
            price,
            coins,
            stock,
            category,
            image: imageUrl,
            updatedAt: new Date().toISOString()
        };
        
        if (editId) {
            database.ref('products/' + editId).update(product, error => {
                if (error) {
                    showToast('Gagal update produk: ' + error.message, 'error');
                } else {
                    showToast('Produk berhasil diupdate!', 'success');
                    closeModal('productModal');
                    loadProducts();
                }
            });
        } else {
            database.ref('products').push(product, error => {
                if (error) {
                    showToast('Gagal tambah produk: ' + error.message, 'error');
                } else {
                    showToast('Produk berhasil ditambahkan!', 'success');
                    closeModal('productModal');
                    loadProducts();
                }
            });
        }
    };
    
    if (imageFile) {
        const storageRef = storage.ref('products/' + Date.now() + '_' + imageFile.name);
        storageRef.put(imageFile).then(snapshot => {
            snapshot.ref.getDownloadURL().then(url => {
                saveProduct(url);
            });
        }).catch(error => {
            showToast('Gagal upload gambar: ' + error.message, 'error');
        });
    } else {
        saveProduct('');
    }
}

function editProduct(productId) {
    database.ref('products/' + productId).once('value', snapshot => {
        const product = snapshot.val();
        
        document.getElementById('productModalTitle').innerHTML = '<i class="fas fa-box"></i> Edit Produk';
        document.getElementById('editProductId').value = productId;
        document.getElementById('productName').value = product.name;
        document.getElementById('productDescription').value = product.description;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productCoins').value = product.coins;
        document.getElementById('productStock').value = product.stock;
        document.getElementById('productCategory').value = product.category;
        
        if (product.image) {
            document.getElementById('productImagePreview').innerHTML = `
                <img src="${product.image}" alt="${product.name}" style="max-width: 100%; max-height: 200px; border-radius: 12px;">
            `;
        }
        
        closeModal('ownerPanelModal');
        document.getElementById('productModal').classList.add('active');
    });
}

function deleteProduct(productId) {
    if (!confirm('Yakin ingin menghapus produk ini?')) return;
    
    database.ref('products/' + productId).remove(error => {
        if (error) {
            showToast('Gagal hapus produk: ' + error.message, 'error');
        } else {
            showToast('Produk berhasil dihapus!', 'success');
            loadProducts();
        }
    });
}

function showGiveBadge(username) {
    document.getElementById('badgeUsername').value = username;
    document.getElementById('selectedBadge').value = '';
    document.querySelectorAll('.badge-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    document.getElementById('badgeModal').classList.add('active');
}

function selectBadge(badge) {
    document.getElementById('selectedBadge').value = badge;
    document.querySelectorAll('.badge-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    event.target.closest('.badge-option').classList.add('selected');
}

function giveBadge() {
    const username = document.getElementById('badgeUsername').value;
    const badge = document.getElementById('selectedBadge').value;
    
    if (!badge) {
        showToast('Pilih badge terlebih dahulu!', 'error');
        return;
    }
    
    database.ref('users/' + username).once('value', snapshot => {
        if (snapshot.exists()) {
            const user = snapshot.val();
            const badges = user.badges || [];
            
            if (!badges.includes(badge)) {
                badges.push(badge);
                
                database.ref('users/' + username).update({ badges: badges }, error => {
                    if (error) {
                        showToast('Gagal memberikan badge: ' + error.message, 'error');
                    } else {
                        showToast('Badge berhasil diberikan!', 'success');
                        closeModal('badgeModal');
                        updateOwnerUsersList();
                    }
                });
            } else {
                showToast('User sudah memiliki badge ini!', 'error');
            }
        }
    });
}

// ===== Owner Settings =====
function updateOwnerSettings() {
    const username = document.getElementById('ownerUsernameSetting').value;
    const password = document.getElementById('ownerPasswordSetting').value;
    
    if (username) {
        database.ref('settings/ownerUsername').set(username);
        ownerUsername = username;
    }
    
    if (password) {
        database.ref('users/' + ownerUsername).update({ password: password });
    }
    
    showToast('Pengaturan berhasil diupdate!', 'success');
}

function updatePaymentSettings() {
    const bankAccount = document.getElementById('bankAccount').value;
    const ewalletNumber = document.getElementById('ewalletNumber').value;
    
    const updates = {};
    if (bankAccount) updates.bankAccount = bankAccount;
    if (ewalletNumber) updates.ewalletNumber = ewalletNumber;
    
    database.ref('settings').update(updates, error => {
        if (error) {
            showToast('Gagal update: ' + error.message, 'error');
        } else {
            showToast('Pengaturan pembayaran berhasil diupdate!', 'success');
            window.bankAccount = bankAccount;
            window.ewalletNumber = ewalletNumber;
        }
    });
}

function updateDiscordSettings() {
    const discordLink = document.getElementById('discordLink').value;
    
    if (discordLink) {
        database.ref('settings/discordLink').set(discordLink, error => {
            if (error) {
                showToast('Gagal update: ' + error.message, 'error');
            } else {
                showToast('Link Discord berhasil diupdate!', 'success');
                window.discordLink = discordLink;
            }
        });
    }
}

function updateDiscountSettings() {
    const discount = parseInt(document.getElementById('globalDiscount').value) || 0;
    
    database.ref('settings/globalDiscount').set(discount, error => {
        if (error) {
            showToast('Gagal update: ' + error.message, 'error');
        } else {
            showToast('Diskon berhasil diupdate!', 'success');
            window.globalDiscount = discount;
            loadProducts();
        }
    });
}

// ===== File Previews =====
function handleFilePreview(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('filePreview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 12px;">`;
        };
        reader.readAsDataURL(file);
    }
}

function handleProductImagePreview(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('productImagePreview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 12px;">`;
        };
        reader.readAsDataURL(file);
    }
}

// ===== Utility Functions =====
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showLogin() {
    document.getElementById('loginModal').classList.add('active');
}

function showRegister() {
    closeModal('loginModal');
    document.getElementById('registerModal').classList.add('active');
}

function showPage(page) {
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    document.getElementById(page + 'Page').classList.add('active');
    
    // Update active nav
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('onclick').includes(page)) {
            link.classList.add('active');
        }
    });
}

function showDiscord() {
    if (window.discordLink) {
        window.open(window.discordLink, '_blank');
    } else {
        showToast('Link Discord belum diatur!', 'error');
    }
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('id-ID', options);
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function updateHomeStats(products) {
    document.getElementById('homeTotalProducts').textContent = products.length;
    
    database.ref('users').once('value', snapshot => {
        document.getElementById('homeTotalUsers').textContent = snapshot.numChildren();
    });
    
    database.ref('reviews').once('value', snapshot => {
        let totalRating = 0;
        let count = 0;
        
        snapshot.forEach(child => {
            const review = child.val();
            totalRating += review.rating;
            count++;
        });
        
        const avgRating = count > 0 ? (totalRating / count).toFixed(1) : '0.0';
        document.getElementById('homeAvgRating').textContent = avgRating;
    });
}

// Auto-refresh data every 30 seconds
setInterval(() => {
    loadProducts();
    loadReviews();
    if (currentUser) {
        loadUserData();
    }
}, 30000);
