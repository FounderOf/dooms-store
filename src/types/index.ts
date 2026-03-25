export interface User {
  uid: string;
  username: string;
  email: string;
  balance: number;
  coins: number;
  badges: Badge[];
  role: 'customer' | 'owner';
  createdAt: Date;
  avatar?: string;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  color: string;
  grantedBy: string;
  grantedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  coinPrice: number;
  stock: number;
  images: string[];
  category: string;
  discount?: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface Order {
  id: string;
  userId: string;
  username: string;
  items: OrderItem[];
  totalAmount: number;
  totalCoins: number;
  paymentMethod: string;
  paymentProof?: string;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  shippingAddress: string;
  notes?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  coinPrice: number;
  image?: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  username: string;
  rating: number;
  comment: string;
  createdAt: Date;
  badges?: Badge[];
}

export interface Chat {
  id: string;
  userId: string;
  username: string;
  messages: ChatMessage[];
  lastMessageAt: Date;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

export interface Deposit {
  id: string;
  userId: string;
  username: string;
  amount: number;
  coins: number;
  paymentMethod: string;
  paymentProof?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreSettings {
  discordLink: string;
  bankAccounts: BankAccount[];
  ewallets: EWallet[];
  ownerUsername: string;
  globalDiscount?: number;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface EWallet {
  id: string;
  name: string;
  number: string;
}

export const BADGE_TYPES = {
  warrior: { id: 'warrior', name: 'Warrior', icon: '⚔️', color: '#8B4513' },
  elite: { id: 'elite', name: 'Elite', icon: '🏆', color: '#FFD700' },
  master: { id: 'master', name: 'Master', icon: '👑', color: '#9370DB' },
  grandmaster: { id: 'grandmaster', name: 'Grandmaster', icon: '💎', color: '#00CED1' },
  mythical: { id: 'mythical', name: 'Mythical', icon: '🐉', color: '#FF1493' },
};
