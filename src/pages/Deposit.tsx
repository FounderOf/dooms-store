import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Panel, PanelButton, PanelInput } from '../components/Panel';
import { Coins, Upload, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

export const Deposit: React.FC = () => {
  const { userDeposits, createDeposit, settings } = useStore();
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentProof, setPaymentProof] = useState('');
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);

  const coins = amount ? Math.floor(Number(amount) / 1000) : 0;

  const handleSubmit = async () => {
    if (!amount || !paymentMethod || !paymentProof) {
      toast.error('Mohon lengkapi semua data');
      return;
    }

    setCreating(true);
    try {
      await createDeposit(Number(amount), paymentMethod, paymentProof);
      setStep(1);
      setAmount('');
      setPaymentMethod('');
      setPaymentProof('');
    } catch (error) {
      toast.error('Gagal membuat deposit');
    }
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      {/* Deposit Form */}
      <Panel title="Top Up Coins" icon={<Coins />}>
        <div className="space-y-6">
          {/* Info */}
          <div className="bg-gradient-to-r from-yellow-600/20 to-yellow-800/20 border border-yellow-500/30 rounded-lg p-4">
            <h3 className="text-yellow-400 font-bold mb-2">💰 Rate Konversi</h3>
            <p className="text-white">1,000 IDR = 1 Coin</p>
            <p className="text-gray-400 text-sm mt-2">
              Coins dapat digunakan untuk membeli produk di store
            </p>
          </div>

          {/* Step 1: Enter Amount */}
          {step === 1 && (
            <div className="space-y-4">
              <PanelInput
                label="Jumlah Deposit (IDR)"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Minimal 10,000"
                min="10000"
                step="1000"
              />
              
              {amount && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-gray-400">Anda akan mendapatkan:</p>
                  <p className="text-3xl font-bold text-yellow-400 flex items-center gap-2">
                    <Coins className="w-8 h-8" />
                    {coins.toLocaleString()} Coins
                  </p>
                </div>
              )}

              <PanelButton 
                onClick={() => setStep(2)}
                disabled={!amount || Number(amount) < 10000}
                className="w-full"
              >
                Lanjut ke Pembayaran
              </PanelButton>
            </div>
          )}

          {/* Step 2: Payment Info */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h3 className="text-blue-400 font-bold mb-3">Metode Pembayaran</h3>
                
                {/* Bank Accounts */}
                {settings?.bankAccounts && settings.bankAccounts.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-400 text-sm mb-2">Transfer Bank:</p>
                    {settings.bankAccounts.map(bank => (
                      <div key={bank.id} className="bg-gray-800/50 rounded p-3 mb-2">
                        <p className="text-white font-semibold">{bank.bankName}</p>
                        <p className="text-gray-300">{bank.accountNumber}</p>
                        <p className="text-gray-400 text-sm">a.n {bank.accountName}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* E-Wallets */}
                {settings?.ewallets && settings.ewallets.length > 0 && (
                  <div>
                    <p className="text-gray-400 text-sm mb-2">E-Wallet:</p>
                    {settings.ewallets.map(ewallet => (
                      <div key={ewallet.id} className="bg-gray-800/50 rounded p-3 mb-2">
                        <p className="text-white font-semibold">{ewallet.name}</p>
                        <p className="text-gray-300">{ewallet.number}</p>
                      </div>
                    ))}
                  </div>
                )}

                {(!settings?.bankAccounts?.length && !settings?.ewallets?.length) && (
                  <p className="text-gray-400">Hubungi admin untuk informasi pembayaran</p>
                )}
              </div>

              <PanelInput
                label="Pilih Metode Pembayaran"
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="Contoh: BCA, Dana, OVO, Gopay"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                >
                  Kembali
                </button>
                <PanelButton 
                  onClick={() => setStep(3)}
                  disabled={!paymentMethod}
                  className="flex-1"
                >
                  Lanjut
                </PanelButton>
              </div>
            </div>
          )}

          {/* Step 3: Upload Proof */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <h3 className="text-green-400 font-bold mb-2">✅ Lakukan Pembayaran</h3>
                <p className="text-white mb-2">Jumlah: <span className="font-bold">Rp {Number(amount).toLocaleString()}</span></p>
                <p className="text-gray-400 text-sm">
                  Setelah transfer, screenshot bukti pembayaran dan upload di bawah ini.
                </p>
              </div>

              <PanelInput
                label="URL Bukti Pembayaran"
                type="text"
                value={paymentProof}
                onChange={(e) => setPaymentProof(e.target.value)}
                placeholder="Paste URL gambar bukti transfer (imgur, dll)"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                >
                  Kembali
                </button>
                <PanelButton 
                  onClick={handleSubmit}
                  disabled={!paymentProof || creating}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 inline mr-2" />
                  {creating ? 'Memproses...' : 'Kirim Bukti'}
                </PanelButton>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Deposit History */}
      <Panel title="Riwayat Deposit" icon={<DollarSign />}>
        {userDeposits.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Belum ada riwayat deposit</p>
        ) : (
          <div className="space-y-3">
            {userDeposits.map(deposit => (
              <div 
                key={deposit.id}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-white font-semibold">
                      {deposit.coins} Coins
                    </p>
                    <p className="text-gray-400 text-sm">
                      {deposit.createdAt?.toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    deposit.status === 'approved' 
                      ? 'bg-green-600 text-white'
                      : deposit.status === 'rejected'
                      ? 'bg-red-600 text-white'
                      : 'bg-yellow-600 text-white'
                  }`}>
                    {deposit.status === 'approved' ? 'Disetujui' 
                      : deposit.status === 'rejected' ? 'Ditolak' 
                      : 'Menunggu Verifikasi'}
                  </span>
                </div>
                <p className="text-gray-400 text-sm">
                  Metode: {deposit.paymentMethod}
                </p>
                {deposit.paymentProof && (
                  <a 
                    href={deposit.paymentProof}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-400 text-sm hover:underline"
                  >
                    Lihat Bukti
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
};
