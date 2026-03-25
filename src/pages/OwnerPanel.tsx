import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { Panel, PanelButton, PanelInput, PanelTextarea } from '../components/Panel';
import { 
  Settings, Users, Package, DollarSign, MessageSquare, 
  Award, ShoppingCart, TrendingUp, Plus, Trash2,
  Edit, Key
} from 'lucide-react';
import { BADGE_TYPES, User, Product } from '../types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import toast from 'react-hot-toast';

export const OwnerPanel: React.FC = () => {
  const { user } = useAuth();
  const {
    orders,
    deposits,
    chats,
    reviews,
    products,
    settings,
    addProduct,
    updateProduct,
    deleteProduct,
    updateOrderStatus,
    approveDeposit,
    rejectDeposit,
    grantBadge,
    revokeBadge,
    updateSettings,
    changeOwnerPassword
  } = useStore();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Product form state
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: 0,
    coinPrice: 0,
    stock: 0,
    images: [''],
    category: '',
    discount: 0
  });

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    discordLink: settings?.discordLink || '',
    ownerUsername: settings?.ownerUsername || ''
  });

  // Bank & E-wallet state
  const [bankAccount, setBankAccount] = useState({
    bankName: '',
    accountNumber: '',
    accountName: ''
  });
  const [ewallet, setEwallet] = useState({
    name: '',
    number: ''
  });

  // Badge grant state
  const [selectedBadge, setSelectedBadge] = useState('warrior');
  const [selectedUserId, _setSelectedUserId] = useState('');

  // Password change state
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersList = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        badges: doc.data().badges?.map((b: any) => ({
          ...b,
          grantedAt: b.grantedAt?.toDate()
        })) || []
      })) as User[];
      setUsers(usersList);
      toast.success('Data user dimuat');
    } catch (error) {
      toast.error('Gagal memuat data user');
    }
    setLoadingUsers(false);
  };

  const handleAddProduct = async () => {
    if (!productForm.name || !productForm.price || !productForm.stock) {
      toast.error('Lengkapi data produk');
      return;
    }

    const images = productForm.images.filter(img => img.trim() !== '');

    await addProduct({
      ...productForm,
      images,
      isActive: true
    });

    setShowProductForm(false);
    resetProductForm();
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    const images = productForm.images.filter(img => img.trim() !== '');

    await updateProduct(editingProduct.id, {
      ...productForm,
      images
    });

    setShowProductForm(false);
    setEditingProduct(null);
    resetProductForm();
  };

  const resetProductForm = () => {
    setProductForm({
      name: '',
      description: '',
      price: 0,
      coinPrice: 0,
      stock: 0,
      images: [''],
      category: '',
      discount: 0
    });
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      coinPrice: product.coinPrice,
      stock: product.stock,
      images: product.images.length > 0 ? product.images : [''],
      category: product.category,
      discount: product.discount || 0
    });
    setShowProductForm(true);
  };

  const handleAddBank = async () => {
    if (!bankAccount.bankName || !bankAccount.accountNumber) {
      toast.error('Lengkapi data bank');
      return;
    }

    const currentBanks = settings?.bankAccounts || [];
    await updateSettings({
      bankAccounts: [...currentBanks, { id: Date.now().toString(), ...bankAccount }]
    });

    setBankAccount({ bankName: '', accountNumber: '', accountName: '' });
  };

  const handleAddEwallet = async () => {
    if (!ewallet.name || !ewallet.number) {
      toast.error('Lengkapi data e-wallet');
      return;
    }

    const currentEwallets = settings?.ewallets || [];
    await updateSettings({
      ewallets: [...currentEwallets, { id: Date.now().toString(), ...ewallet }]
    });

    setEwallet({ name: '', number: '' });
  };

  const handleGrantBadge = async () => {
    if (!selectedUserId) {
      toast.error('Pilih user');
      return;
    }

    const badge = Object.values(BADGE_TYPES).find(b => b.id === selectedBadge);
    if (!badge) return;

    await grantBadge(selectedUserId, {
      ...badge,
      grantedBy: user?.uid || 'admin',
      grantedAt: new Date()
    });
  };

  const totalRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const processingOrders = orders.filter(o => o.status === 'processing').length;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <TrendingUp /> },
    { id: 'products', label: 'Produk', icon: <ShoppingCart /> },
    { id: 'orders', label: 'Pesanan', icon: <Package /> },
    { id: 'deposits', label: 'Deposit', icon: <DollarSign /> },
    { id: 'users', label: 'Users', icon: <Users /> },
    { id: 'reviews', label: 'Ulasan', icon: <MessageSquare /> },
    { id: 'chat', label: 'Chat', icon: <MessageSquare /> },
    { id: 'settings', label: 'Pengaturan', icon: <Settings /> },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tab.icon}
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Panel title="Total Pendapatan">
            <p className="text-3xl font-bold text-green-400">
              Rp {totalRevenue.toLocaleString()}
            </p>
          </Panel>
          <Panel title="Total Pesanan">
            <p className="text-3xl font-bold text-white">{orders.length}</p>
          </Panel>
          <Panel title="Menunggu Pembayaran">
            <p className="text-3xl font-bold text-yellow-400">{pendingOrders}</p>
          </Panel>
          <Panel title="Sedang Diproses">
            <p className="text-3xl font-bold text-purple-400">{processingOrders}</p>
          </Panel>
          <Panel title="Total Deposit">
            <p className="text-3xl font-bold text-blue-400">
              Rp {deposits.filter(d => d.status === 'approved').reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
            </p>
          </Panel>
          <Panel title="Pending Deposit">
            <p className="text-3xl font-bold text-orange-400">
              {deposits.filter(d => d.status === 'pending').length}
            </p>
          </Panel>
          <Panel title="Total Produk">
            <p className="text-3xl font-bold text-white">{products.length}</p>
          </Panel>
          <Panel title="Total Chat">
            <p className="text-3xl font-bold text-white">{chats.length}</p>
          </Panel>
        </div>
      )}

      {/* Products */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Manajemen Produk</h2>
            <PanelButton onClick={() => setShowProductForm(true)}>
              <Plus className="w-4 h-4 inline mr-2" />
              Tambah Produk
            </PanelButton>
          </div>

          {showProductForm && (
            <Panel title={editingProduct ? 'Edit Produk' : 'Tambah Produk'}>
              <div className="space-y-4">
                <PanelInput
                  label="Nama Produk"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
                <PanelTextarea
                  label="Deskripsi"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  rows={3}
                />
                <div className="grid grid-cols-2 gap-4">
                  <PanelInput
                    label="Harga (IDR)"
                    type="number"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                  />
                  <PanelInput
                    label="Harga (Coins)"
                    type="number"
                    value={productForm.coinPrice}
                    onChange={(e) => setProductForm({ ...productForm, coinPrice: Number(e.target.value) })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <PanelInput
                    label="Stok"
                    type="number"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })}
                  />
                  <PanelInput
                    label="Diskon (%)"
                    type="number"
                    value={productForm.discount}
                    onChange={(e) => setProductForm({ ...productForm, discount: Number(e.target.value) })}
                  />
                </div>
                <PanelInput
                  label="Kategori"
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                />
                <div>
                  <label className="block text-red-300 text-sm font-semibold mb-2">URL Gambar</label>
                  {productForm.images.map((img, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={img}
                        onChange={(e) => {
                          const newImages = [...productForm.images];
                          newImages[idx] = e.target.value;
                          setProductForm({ ...productForm, images: newImages });
                        }}
                        className="flex-1 px-4 py-2 bg-gray-800 border border-red-500/30 rounded-lg text-white"
                        placeholder="URL gambar"
                      />
                      <button
                        onClick={() => {
                          const newImages = productForm.images.filter((_, i) => i !== idx);
                          setProductForm({ ...productForm, images: newImages.length > 0 ? newImages : [''] });
                        }}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setProductForm({ ...productForm, images: [...productForm.images, ''] })}
                    className="text-red-400 text-sm hover:underline"
                  >
                    + Tambah Gambar
                  </button>
                </div>
                <div className="flex gap-2">
                  <PanelButton onClick={editingProduct ? handleUpdateProduct : handleAddProduct}>
                    {editingProduct ? 'Update' : 'Simpan'}
                  </PanelButton>
                  <button
                    onClick={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                      resetProductForm();
                    }}
                    className="px-6 py-3 bg-gray-700 text-white rounded-lg"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </Panel>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(product => (
              <Panel key={product.id} title={product.name}>
                <div className="aspect-video bg-gray-800 rounded-lg mb-4 overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">No Image</div>
                  )}
                </div>
                <p className="text-gray-400 text-sm mb-2">Stok: {product.stock}</p>
                <p className="text-red-400 font-bold mb-2">Rp {product.price.toLocaleString()}</p>
                <div className="flex gap-2">
                  <PanelButton onClick={() => openEditProduct(product)} className="flex-1">
                    <Edit className="w-4 h-4" />
                  </PanelButton>
                  <button
                    onClick={() => deleteProduct(product.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Panel>
            ))}
          </div>
        </div>
      )}

      {/* Orders */}
      {activeTab === 'orders' && (
        <Panel title="Log Pesanan">
          <div className="space-y-4">
            {orders.map(order => (
              <div key={order.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white font-semibold">Order: {order.id.slice(0, 8)}...</p>
                    <p className="text-gray-400 text-sm">{order.username}</p>
                    <p className="text-gray-400 text-sm">
                      {order.createdAt?.toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    order.status === 'pending' ? 'bg-yellow-600' :
                    order.status === 'processing' ? 'bg-purple-600' :
                    order.status === 'shipped' ? 'bg-orange-600' :
                    order.status === 'delivered' ? 'bg-green-600' :
                    'bg-red-600'
                  } text-white`}>
                    {order.status.toUpperCase()}
                  </span>
                </div>
                <div className="space-y-2 mb-4">
                  {order.items.map((item, idx) => (
                    <p key={idx} className="text-gray-300 text-sm">
                      {item.productName} x{item.quantity}
                    </p>
                  ))}
                </div>
                <p className="text-red-400 font-bold mb-4">
                  Total: {order.totalCoins > 0 ? `${order.totalCoins} Coins` : `Rp ${order.totalAmount.toLocaleString()}`}
                </p>
                {order.paymentProof && (
                  <a href={order.paymentProof} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm hover:underline block mb-4">
                    📄 Lihat Bukti Pembayaran
                  </a>
                )}
                <div className="flex gap-2 flex-wrap">
                  {order.status === 'pending' && order.paymentProof && (
                    <>
                      <PanelButton onClick={() => updateOrderStatus(order.id, 'processing')} className="text-sm">
                        Terima Pesanan
                      </PanelButton>
                    </>
                  )}
                  {order.status === 'processing' && (
                    <PanelButton onClick={() => updateOrderStatus(order.id, 'shipped')} className="text-sm">
                      Kirim Pesanan
                    </PanelButton>
                  )}
                  {order.status === 'shipped' && (
                    <PanelButton onClick={() => updateOrderStatus(order.id, 'delivered')} className="text-sm">
                      Tandai Diterima
                    </PanelButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Deposits */}
      {activeTab === 'deposits' && (
        <Panel title="Riwayat Deposit">
          <div className="space-y-4">
            {deposits.map(deposit => (
              <div key={deposit.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-white font-semibold">{deposit.username}</p>
                    <p className="text-gray-400 text-sm">
                      {deposit.coins} Coins - Rp {deposit.amount.toLocaleString()}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {deposit.createdAt?.toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    deposit.status === 'approved' ? 'bg-green-600' :
                    deposit.status === 'rejected' ? 'bg-red-600' :
                    'bg-yellow-600'
                  } text-white`}>
                    {deposit.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mb-2">Metode: {deposit.paymentMethod}</p>
                {deposit.paymentProof && (
                  <a href={deposit.paymentProof} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm hover:underline block mb-4">
                    📄 Lihat Bukti
                  </a>
                )}
                {deposit.status === 'pending' && (
                  <div className="flex gap-2">
                    <PanelButton onClick={() => approveDeposit(deposit.id)} className="text-sm">
                      Setujui
                    </PanelButton>
                    <button
                      onClick={() => rejectDeposit(deposit.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
                    >
                      Tolak
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Users */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <Panel title="Daftar Users">
            <PanelButton onClick={loadUsers} disabled={loadingUsers} className="mb-4">
              {loadingUsers ? 'Memuat...' : 'Muat Data Users'}
            </PanelButton>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {users.map(u => (
                <div key={u.uid} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-white font-semibold">{u.username}</p>
                      <p className="text-gray-400 text-sm">{u.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 text-sm">Saldo: Rp {u.balance?.toLocaleString()}</p>
                      <p className="text-yellow-400 text-sm">Coins: {u.coins}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {u.badges?.map((badge, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: badge.color + '20', color: badge.color }}
                      >
                        {badge.icon} {badge.name}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4">
                    <select
                      value={selectedBadge}
                      onChange={(e) => setSelectedBadge(e.target.value)}
                      className="px-3 py-2 bg-gray-700 text-white rounded-lg"
                    >
                      {Object.values(BADGE_TYPES).map(b => (
                        <option key={b.id} value={b.id}>{b.icon} {b.name}</option>
                      ))}
                    </select>
                    <PanelButton onClick={() => handleGrantBadge()} className="text-sm">
                      <Award className="w-4 h-4 inline mr-1" />
                      Berikan Badge
                    </PanelButton>
                    <button
                      onClick={() => {
                        const badge = u.badges?.[0];
                        if (badge) revokeBadge(u.uid, badge.id);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
                    >
                      Cabut Badge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Reviews */}
      {activeTab === 'reviews' && (
        <Panel title="Ulasan Produk">
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold">
                      {review.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{review.username}</p>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <span key={star} className={star <= review.rating ? 'text-yellow-500' : 'text-gray-600'}>
                            ⭐
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm">
                    {review.createdAt?.toLocaleDateString('id-ID')}
                  </p>
                </div>
                <p className="text-gray-300">{review.comment}</p>
                {review.badges && review.badges.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {review.badges.map((badge, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: badge.color + '20', color: badge.color }}
                      >
                        {badge.icon} {badge.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Chat */}
      {activeTab === 'chat' && (
        <Panel title="Chat dengan Customer">
          <p className="text-gray-400">Gunakan tab Chat di menu utama untuk berkomunikasi dengan customer</p>
        </Panel>
      )}

      {/* Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <Panel title="Pengaturan Akun Owner">
            <div className="space-y-4">
              <PanelInput
                label="Username Owner"
                value={settingsForm.ownerUsername}
                onChange={(e) => setSettingsForm({ ...settingsForm, ownerUsername: e.target.value })}
              />
              <PanelInput
                label="Link Discord"
                value={settingsForm.discordLink}
                onChange={(e) => setSettingsForm({ ...settingsForm, discordLink: e.target.value })}
                placeholder="https://discord.gg/..."
              />
              <PanelButton onClick={() => updateSettings(settingsForm)}>
                Simpan Pengaturan
              </PanelButton>
            </div>
          </Panel>

          <Panel title="Pengaturan Pembayaran">
            <div className="space-y-6">
              {/* Bank Accounts */}
              <div>
                <h3 className="text-white font-bold mb-3">Tambah Rekening Bank</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <PanelInput
                    label="Nama Bank"
                    value={bankAccount.bankName}
                    onChange={(e) => setBankAccount({ ...bankAccount, bankName: e.target.value })}
                    className="mb-0"
                  />
                  <PanelInput
                    label="Nomor Rekening"
                    value={bankAccount.accountNumber}
                    onChange={(e) => setBankAccount({ ...bankAccount, accountNumber: e.target.value })}
                    className="mb-0"
                  />
                  <PanelInput
                    label="Atas Nama"
                    value={bankAccount.accountName}
                    onChange={(e) => setBankAccount({ ...bankAccount, accountName: e.target.value })}
                    className="mb-0"
                  />
                </div>
                <PanelButton onClick={handleAddBank}>
                  <Plus className="w-4 h-4 inline mr-2" />
                  Tambah Bank
                </PanelButton>
              </div>

              {/* E-Wallets */}
              <div>
                <h3 className="text-white font-bold mb-3">Tambah E-Wallet</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <PanelInput
                    label="Nama E-Wallet"
                    value={ewallet.name}
                    onChange={(e) => setEwallet({ ...ewallet, name: e.target.value })}
                    className="mb-0"
                  />
                  <PanelInput
                    label="Nomor"
                    value={ewallet.number}
                    onChange={(e) => setEwallet({ ...ewallet, number: e.target.value })}
                    className="mb-0"
                  />
                </div>
                <PanelButton onClick={handleAddEwallet}>
                  <Plus className="w-4 h-4 inline mr-2" />
                  Tambah E-Wallet
                </PanelButton>
              </div>

              {/* Current Payment Methods */}
              {settings?.bankAccounts && settings.bankAccounts.length > 0 && (
                <div>
                  <h3 className="text-white font-bold mb-3">Rekening Terdaftar</h3>
                  <div className="space-y-2">
                    {settings.bankAccounts.map(bank => (
                      <div key={bank.id} className="bg-gray-800/50 rounded p-3">
                        <p className="text-white">{bank.bankName} - {bank.accountNumber} (a.n {bank.accountName})</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {settings?.ewallets && settings.ewallets.length > 0 && (
                <div>
                  <h3 className="text-white font-bold mb-3">E-Wallet Terdaftar</h3>
                  <div className="space-y-2">
                    {settings.ewallets.map(ew => (
                      <div key={ew.id} className="bg-gray-800/50 rounded p-3">
                        <p className="text-white">{ew.name} - {ew.number}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Keamanan">
            <PanelInput
              label="Password Baru"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <PanelButton onClick={() => changeOwnerPassword(newPassword)}>
              <Key className="w-4 h-4 inline mr-2" />
              Ubah Password
            </PanelButton>
          </Panel>
        </div>
      )}
    </div>
  );
};
