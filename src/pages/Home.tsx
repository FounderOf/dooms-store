import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Panel, PanelButton } from '../components/Panel';
import { ShoppingCart, Star, Coins } from 'lucide-react';

export const Home: React.FC<{ onBuy: (product: any) => void }> = ({ onBuy }) => {
  const { products, reviews } = useStore();
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', ...new Set(products.map(p => p.category))];
  
  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  const getProductRating = (productId: string) => {
    const productReviews = reviews.filter(r => r.productId === productId);
    if (productReviews.length === 0) return 0;
    return productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
  };

  const getProductReviewCount = (productId: string) => {
    return reviews.filter(r => r.productId === productId).length;
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-red-900/50 to-gray-900/50 border border-red-500/30 p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmMDAwMCIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-white mb-2">
            Welcome to <span className="text-red-500">DOOMINIKS STORE</span>
          </h1>
          <p className="text-gray-400">Premium products with secure transactions</p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              selectedCategory === cat
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {cat === 'all' ? 'Semua' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map(product => (
          <Panel key={product.id} title={product.name} className="hover:border-red-500/60 transition-colors">
            {/* Product Image */}
            <div className="aspect-video bg-gray-800 rounded-lg mb-4 overflow-hidden">
              {product.images && product.images.length > 0 ? (
                <img 
                  src={product.images[0]} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">
                  No Image
                </div>
              )}
            </div>
            <p className="text-gray-400 text-sm mb-3 line-clamp-2">{product.description}</p>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= getProductRating(product.id)
                        ? 'text-yellow-500 fill-yellow-500'
                        : 'text-gray-600'
                    }`}
                  />
                ))}
              </div>
              <span className="text-gray-400 text-sm">
                ({getProductReviewCount(product.id)} ulasan)
              </span>
            </div>

            {/* Price */}
            <div className="flex items-center justify-between mb-4">
              <div>
                {product.discount && product.discount > 0 ? (
                  <>
                    <span className="text-gray-500 line-through text-sm">
                      Rp {product.price.toLocaleString()}
                    </span>
                    <div className="text-red-400 font-bold">
                      Rp {(product.price * (1 - product.discount / 100)).toLocaleString()}
                    </div>
                  </>
                ) : (
                  <div className="text-red-400 font-bold">
                    Rp {product.price.toLocaleString()}
                  </div>
                )}
                <div className="flex items-center gap-1 text-yellow-500 text-sm">
                  <Coins className="w-4 h-4" />
                  {product.coinPrice} Coins
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm ${product.stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {product.stock > 0 ? `Stok: ${product.stock}` : 'Habis'}
                </div>
              </div>
            </div>

            {/* Buy Button */}
            <PanelButton
              onClick={() => onBuy(product)}
              className="w-full"
              disabled={product.stock === 0 || !product.isActive}
            >
              <ShoppingCart className="w-4 h-4 inline mr-2" />
              {product.stock === 0 ? 'Stok Habis' : 'Beli Sekarang'}
            </PanelButton>
          </Panel>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">Belum ada produk tersedia</p>
        </div>
      )}
    </div>
  );
};
