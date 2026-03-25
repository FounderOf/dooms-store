import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Panel, PanelButton, PanelInput } from '../components/Panel';
import { Package, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

export const Orders: React.FC = () => {
  const { userOrders, updateOrderStatus } = useStore();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [paymentProof, setPaymentProof] = useState('');
  const [uploading, setUploading] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-400';
      case 'paid': return 'text-blue-400';
      case 'processing': return 'text-purple-400';
      case 'shipped': return 'text-orange-400';
      case 'delivered': return 'text-green-400';
      case 'cancelled': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Menunggu Pembayaran';
      case 'paid': return 'Pembayaran Diterima';
      case 'processing': return 'Sedang Diproses';
      case 'shipped': return 'Dikirim';
      case 'delivered': return 'Diterima';
      case 'cancelled': return 'Dibatalkan';
      default: return status;
    }
  };

  const handleUploadProof = async (orderId: string) => {
    if (!paymentProof) {
      toast.error('Masukkan URL bukti pembayaran');
      return;
    }
    setUploading(true);
    try {
      await updateOrderStatus(orderId, 'paid');
      // In a real app, you would update the paymentProof field
      toast.success('Bukti pembayaran uploaded!');
      setPaymentProof('');
      setSelectedOrder(null);
    } catch (error) {
      toast.error('Gagal upload bukti pembayaran');
    }
    setUploading(false);
  };

  return (
    <div className="space-y-6">
      <Panel title="Riwayat Pesanan" icon={<Package />}>
        {userOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">Belum ada pesanan</p>
          </div>
        ) : (
          <div className="space-y-4">
            {userOrders.map(order => (
              <div 
                key={order.id}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-red-500/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-gray-400 text-sm">Order ID: {order.id.slice(0, 8)}...</p>
                    <p className="text-gray-400 text-sm">
                      {order.createdAt?.toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <span className={`font-bold ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                </div>

                {/* Order Items */}
                <div className="space-y-2 mb-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      {item.image && (
                        <img 
                          src={item.image} 
                          alt={item.productName}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-white font-semibold">{item.productName}</p>
                        <p className="text-gray-400 text-sm">
                          {item.quantity} x Rp {item.price.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="border-t border-gray-700 pt-4 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Total</span>
                    <span className="text-red-400 font-bold">
                      {order.totalCoins > 0 
                        ? `${order.totalCoins} Coins`
                        : `Rp ${order.totalAmount.toLocaleString()}`
                      }
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mt-2">
                    Pembayaran: {order.paymentMethod}
                  </p>
                </div>

                {/* Shipping Address */}
                <div className="bg-gray-900/50 rounded p-3 mb-4">
                  <p className="text-gray-400 text-sm mb-1">Alamat Pengiriman:</p>
                  <p className="text-white">{order.shippingAddress}</p>
                </div>

                {/* Upload Payment Proof */}
                {order.status === 'pending' && (
                  <div className="border-t border-gray-700 pt-4">
                    {selectedOrder === order.id ? (
                      <div className="space-y-3">
                        <PanelInput
                          label="URL Bukti Pembayaran"
                          type="text"
                          value={paymentProof}
                          onChange={(e) => setPaymentProof(e.target.value)}
                          placeholder="Paste URL gambar bukti transfer"
                        />
                        <div className="flex gap-2">
                          <PanelButton 
                            onClick={() => handleUploadProof(order.id)}
                            disabled={uploading}
                          >
                            <Upload className="w-4 h-4 inline mr-2" />
                            {uploading ? 'Uploading...' : 'Upload Bukti'}
                          </PanelButton>
                          <button
                            onClick={() => setSelectedOrder(null)}
                            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <PanelButton onClick={() => setSelectedOrder(order.id)}>
                        <Upload className="w-4 h-4 inline mr-2" />
                        Upload Bukti Pembayaran
                      </PanelButton>
                    )}
                  </div>
                )}

                {/* Order Status Timeline */}
                {order.status !== 'pending' && order.status !== 'cancelled' && (
                  <div className="border-t border-gray-700 pt-4 mt-4">
                    <p className="text-gray-400 text-sm mb-3">Status Pesanan:</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        ['paid', 'processing', 'shipped', 'delivered'].includes(order.status) 
                          ? 'bg-green-500' 
                          : 'bg-gray-600'
                      }`}></div>
                      <span className={getStatusColor('paid')}>Dibayar</span>
                      
                      <div className={`w-8 h-0.5 ${
                        ['processing', 'shipped', 'delivered'].includes(order.status) 
                          ? 'bg-green-500' 
                          : 'bg-gray-600'
                      }`}></div>
                      
                      <div className={`w-3 h-3 rounded-full ${
                        ['processing', 'shipped', 'delivered'].includes(order.status) 
                          ? 'bg-green-500' 
                          : 'bg-gray-600'
                      }`}></div>
                      <span className={getStatusColor('processing')}>Diproses</span>
                      
                      <div className={`w-8 h-0.5 ${
                        ['shipped', 'delivered'].includes(order.status) 
                          ? 'bg-green-500' 
                          : 'bg-gray-600'
                      }`}></div>
                      
                      <div className={`w-3 h-3 rounded-full ${
                        ['shipped', 'delivered'].includes(order.status) 
                          ? 'bg-green-500' 
                          : 'bg-gray-600'
                      }`}></div>
                      <span className={getStatusColor('shipped')}>Dikirim</span>
                      
                      <div className={`w-8 h-0.5 ${
                        order.status === 'delivered' 
                          ? 'bg-green-500' 
                          : 'bg-gray-600'
                      }`}></div>
                      
                      <div className={`w-3 h-3 rounded-full ${
                        order.status === 'delivered' 
                          ? 'bg-green-500' 
                          : 'bg-gray-600'
                      }`}></div>
                      <span className={getStatusColor('delivered')}>Diterima</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
};
