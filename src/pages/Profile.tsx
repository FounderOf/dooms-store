import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Panel, PanelButton, Badge } from '../components/Panel';
import { User, Coins, Wallet, Award } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Panel title="Profil Saya" icon={<User />}>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-4xl font-bold text-white">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{user.username}</h2>
            <p className="text-gray-400">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                user.role === 'owner' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-700 text-gray-300'
              }`}>
                {user.role === 'owner' ? 'OWNER' : 'CUSTOMER'}
              </span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Balance & Coins */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel title="Saldo" icon={<Wallet />}>
          <div className="text-3xl font-bold text-green-400">
            Rp {user.balance.toLocaleString()}
          </div>
          <p className="text-gray-400 text-sm mt-2">Saldo tersedia untuk pembelian</p>
        </Panel>

        <Panel title="Coins" icon={<Coins />}>
          <div className="text-3xl font-bold text-yellow-400 flex items-center gap-2">
            <Coins className="w-8 h-8" />
            {user.coins.toLocaleString()}
          </div>
          <p className="text-gray-400 text-sm mt-2">Gunakan coins untuk pembelian produk</p>
        </Panel>
      </div>

      {/* Badges */}
      <Panel title="Badge Koleksi" icon={<Award />}>
        {user.badges && user.badges.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {user.badges.map((badge, index) => (
              <Badge key={index} badge={badge} />
            ))}
          </div>
        ) : (
          <p className="text-gray-400">Belum ada badge. Dapatkan badge spesial dari owner!</p>
        )}
      </Panel>

      {/* Account Info */}
      <Panel title="Informasi Akun">
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm">Username</label>
            <p className="text-white font-semibold">{user.username}</p>
          </div>
          <div>
            <label className="text-gray-400 text-sm">Email</label>
            <p className="text-white font-semibold">{user.email}</p>
          </div>
          <div>
            <label className="text-gray-400 text-sm">Tanggal Bergabung</label>
            <p className="text-white font-semibold">
              {user.createdAt?.toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>

        <PanelButton onClick={logout} className="mt-6 w-full">
          Logout
        </PanelButton>
      </Panel>
    </div>
  );
};
