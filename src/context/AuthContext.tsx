import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { User } from '../types';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              ...userData,
              createdAt: userData.createdAt?.toDate(),
              badges: userData.badges?.map((b: any) => ({
                ...b,
                grantedAt: b.grantedAt?.toDate()
              })) || []
            } as User);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Login berhasil!');
    } catch (error: any) {
      toast.error(error.message || 'Login gagal');
      throw error;
    }
  };

  const register = async (email: string, password: string, username: string) => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: username });
      
      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid,
        username,
        email,
        balance: 0,
        coins: 0,
        badges: [],
        role: 'customer',
        createdAt: new Date(),
        avatar: null
      });
      
      toast.success('Registrasi berhasil!');
    } catch (error: any) {
      toast.error(error.message || 'Registrasi gagal');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast.success('Logout berhasil');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const isAdmin = user?.role === 'owner';

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, login, register, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
