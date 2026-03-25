import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  increment,
  serverTimestamp,

} from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  Product, 
  Order, 
  Review, 
  Chat, 
  Deposit, 
  StoreSettings,
  Badge,
  OrderItem
} from '../types';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

interface StoreContextType {
  products: Product[];
  orders: Order[];
  reviews: Review[];
  chats: Chat[];
  deposits: Deposit[];
  settings: StoreSettings | null;
  userOrders: Order[];
  userDeposits: Deposit[];
  userChat: Chat | null;
  refreshProducts: () => void;
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  createOrder: (items: OrderItem[], paymentMethod: string, shippingAddress: string, useCoins: boolean) => Promise<string>;
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>;
  addReview: (productId: string, rating: number, comment: string) => Promise<void>;
  deleteReview: (reviewId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  markChatAsRead: (chatId: string) => Promise<void>;
  createDeposit: (amount: number, paymentMethod: string, paymentProof: string) => Promise<void>;
  approveDeposit: (depositId: string) => Promise<void>;
  rejectDeposit: (depositId: string) => Promise<void>;
  grantBadge: (userId: string, badge: Badge) => Promise<void>;
  revokeBadge: (userId: string, badgeId: string) => Promise<void>;
  updateSettings: (settings: Partial<StoreSettings>) => Promise<void>;
  changeOwnerPassword: (newPassword: string) => Promise<void>;
  getProducts: () => Promise<Product[]>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [userDeposits, setUserDeposits] = useState<Deposit[]>([]);
  const [userChat, setUserChat] = useState<Chat | null>(null);

  // Load products
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Product[];
      setProducts(prods);
    });
    return unsubscribe;
  }, []);

  // Load reviews
  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const revs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      })) as Review[];
      setReviews(revs);
    });
    return unsubscribe;
  }, []);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      const settingsDoc = await getDoc(doc(db, 'settings', 'store'));
      if (settingsDoc.exists()) {
        setSettings(settingsDoc.data() as StoreSettings);
      } else {
        // Initialize default settings
        const defaultSettings: StoreSettings = {
          discordLink: '',
          bankAccounts: [],
          ewallets: [],
          ownerUsername: 'Owner'
        };
        await setDoc(doc(db, 'settings', 'store'), defaultSettings);
        setSettings(defaultSettings);
      }
    };
    loadSettings();
  }, []);

  // Load user orders
  useEffect(() => {
    if (!user) {
      setUserOrders([]);
      return;
    }
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userOrds = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Order[];
      setUserOrders(userOrds);
    });
    return unsubscribe;
  }, [user]);

  // Load all orders for admin
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Order[];
      setOrders(allOrders);
    });
    return unsubscribe;
  }, [isAdmin]);

  // Load user deposits
  useEffect(() => {
    if (!user) {
      setUserDeposits([]);
      return;
    }
    const q = query(
      collection(db, 'deposits'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userDeps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Deposit[];
      setUserDeposits(userDeps);
    });
    return unsubscribe;
  }, [user]);

  // Load all deposits for admin
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'deposits'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allDeps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Deposit[];
      setDeposits(allDeps);
    });
    return unsubscribe;
  }, [isAdmin]);

  // Load user chat
  useEffect(() => {
    if (!user) {
      setUserChat(null);
      return;
    }
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const chatDoc = snapshot.docs[0];
        setUserChat({
          id: chatDoc.id,
          ...chatDoc.data(),
          lastMessageAt: chatDoc.data().lastMessageAt?.toDate()
        } as Chat);
      }
    });
    return unsubscribe;
  }, [user]);

  // Load all chats for admin
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'chats'), orderBy('lastMessageAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allChats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastMessageAt: doc.data().lastMessageAt?.toDate()
      })) as Chat[];
      setChats(allChats);
    });
    return unsubscribe;
  }, [isAdmin]);

  const refreshProducts = () => {
    // Trigger refresh by re-fetching
  };

  const addProduct = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    await addDoc(collection(db, 'products'), {
      ...product,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    toast.success('Produk berhasil ditambahkan');
  };

  const updateProduct = async (id: string, data: Partial<Product>) => {
    await updateDoc(doc(db, 'products', id), {
      ...data,
      updatedAt: serverTimestamp()
    });
    toast.success('Produk berhasil diupdate');
  };

  const deleteProduct = async (id: string) => {
    await updateDoc(doc(db, 'products', id), { isActive: false });
    toast.success('Produk berhasil dihapus');
  };

  const createOrder = async (
    items: OrderItem[], 
    paymentMethod: string, 
    shippingAddress: string,
    useCoins: boolean
  ): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    let totalAmount = 0;
    let totalCoins = 0;

    items.forEach(item => {
      if (useCoins) {
        totalCoins += item.coinPrice * item.quantity;
      } else {
        totalAmount += item.price * item.quantity;
      }
    });

    // Check if user has enough balance/coins
    if (useCoins) {
      if (user.coins < totalCoins) {
        throw new Error('Coin tidak mencukupi');
      }
    } else {
      if (user.balance < totalAmount) {
        throw new Error('Saldo tidak mencukupi');
      }
    }

    // Create order
    const orderData = {
      userId: user.uid,
      username: user.username,
      items,
      totalAmount: useCoins ? 0 : totalAmount,
      totalCoins: useCoins ? totalCoins : 0,
      paymentMethod,
      status: 'pending' as const,
      shippingAddress,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'orders'), orderData);

    // Deduct balance/coins
    await updateDoc(doc(db, 'users', user.uid), {
      balance: useCoins ? user.balance : increment(-totalAmount),
      coins: useCoins ? increment(-totalCoins) : user.coins
    });

    // Update product stock
    for (const item of items) {
      const productRef = doc(db, 'products', item.productId);
      await updateDoc(productRef, {
        stock: increment(-item.quantity)
      });
    }

    toast.success('Pesanan berhasil dibuat! Silakan upload bukti pembayaran.');
    return docRef.id;
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      updatedAt: serverTimestamp()
    });
    toast.success(`Status pesanan diupdate menjadi ${status}`);
  };

  const addReview = async (productId: string, rating: number, comment: string) => {
    if (!user) throw new Error('User not authenticated');

    await addDoc(collection(db, 'reviews'), {
      productId,
      userId: user.uid,
      username: user.username,
      rating,
      comment,
      badges: user.badges || [],
      createdAt: serverTimestamp()
    });
    toast.success('Ulasan berhasil ditambahkan');
  };

  const deleteReview = async (reviewId: string) => {
    await updateDoc(doc(db, 'reviews', reviewId), { deleted: true });
    toast.success('Ulasan berhasil dihapus');
  };

  const sendMessage = async (content: string) => {
    if (!user) throw new Error('User not authenticated');

    const chatQuery = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid)
    );
    const snapshot = await getDocs(chatQuery);

    if (snapshot.empty) {
      // Create new chat
      await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        username: user.username,
        messages: [{
          id: Date.now().toString(),
          senderId: user.uid,
          senderName: user.username,
          content,
          timestamp: serverTimestamp(),
          read: false
        }],
        lastMessageAt: serverTimestamp(),
        unreadCount: 0
      });
    } else {
      // Add to existing chat
      const chatId = snapshot.docs[0].id;
      const chatRef = doc(db, 'chats', chatId);
      const chatData = snapshot.docs[0].data();
      const messages = chatData.messages || [];
      
      await updateDoc(chatRef, {
        messages: [...messages, {
          id: Date.now().toString(),
          senderId: user.uid,
          senderName: user.username,
          content,
          timestamp: serverTimestamp(),
          read: false
        }],
        lastMessageAt: serverTimestamp()
      });
    }
    toast.success('Pesan terkirim');
  };

  const markChatAsRead = async (chatId: string) => {
    await updateDoc(doc(db, 'chats', chatId), { unreadCount: 0 });
  };

  const createDeposit = async (amount: number, paymentMethod: string, paymentProof: string) => {
    if (!user) throw new Error('User not authenticated');

    const coins = Math.floor(amount / 1000); // 1000 IDR = 1 coin

    await addDoc(collection(db, 'deposits'), {
      userId: user.uid,
      username: user.username,
      amount,
      coins,
      paymentMethod,
      paymentProof,
      status: 'pending' as const,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    toast.success('Deposit berhasil dibuat! Tunggu verifikasi dari admin.');
  };

  const approveDeposit = async (depositId: string) => {
    const depositRef = doc(db, 'deposits', depositId);
    const depositDoc = await getDoc(depositRef);
    const deposit = depositDoc.data() as Deposit;

    await updateDoc(depositRef, {
      status: 'approved',
      updatedAt: serverTimestamp()
    });

    // Add coins to user
    await updateDoc(doc(db, 'users', deposit.userId), {
      coins: increment(deposit.coins)
    });

    toast.success('Deposit berhasil disetujui');
  };

  const rejectDeposit = async (depositId: string) => {
    await updateDoc(doc(db, 'deposits', depositId), {
      status: 'rejected',
      updatedAt: serverTimestamp()
    });
    toast.success('Deposit ditolak');
  };

  const grantBadge = async (userId: string, badge: Badge) => {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    const badges = userData?.badges || [];

    // Check if badge already exists
    if (!badges.find((b: Badge) => b.id === badge.id)) {
      await updateDoc(userRef, {
        badges: [...badges, badge]
      });
      toast.success(`Badge ${badge.name} berhasil diberikan`);
    } else {
      toast.error('User sudah memiliki badge ini');
    }
  };

  const revokeBadge = async (userId: string, badgeId: string) => {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    const badges = userData?.badges || [];

    await updateDoc(userRef, {
      badges: badges.filter((b: Badge) => b.id !== badgeId)
    });
    toast.success('Badge berhasil dicabut');
  };

  const updateSettings = async (settingsData: Partial<StoreSettings>) => {
    await updateDoc(doc(db, 'settings', 'store'), settingsData);
    toast.success('Pengaturan berhasil diupdate');
  };

  const changeOwnerPassword = async (_newPassword: string) => {
    // This would require re-authentication in a real app
    toast.success('Password berhasil diubah (implementasi lengkap memerlukan re-auth)');
  };

  const getProducts = async (): Promise<Product[]> => {
    const snapshot = await getDocs(collection(db, 'products'));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    })) as Product[];
  };

  return (
    <StoreContext.Provider value={{
      products,
      orders,
      reviews,
      chats,
      deposits,
      settings,
      userOrders,
      userDeposits,
      userChat,
      refreshProducts,
      addProduct,
      updateProduct,
      deleteProduct,
      createOrder,
      updateOrderStatus,
      addReview,
      deleteReview,
      sendMessage,
      markChatAsRead,
      createDeposit,
      approveDeposit,
      rejectDeposit,
      grantBadge,
      revokeBadge,
      updateSettings,
      changeOwnerPassword,
      getProducts
    }}>
      {children}
    </StoreContext.Provider>
  );
};
