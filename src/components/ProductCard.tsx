import React from 'react';
import { Star, ShoppingCart, Heart, Eye } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';

interface ProductCardProps {
  product: Product;
  onViewDetails: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onViewDetails }) => {
  const { addItem } = useCart();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem(product);
  };

  const discount = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <div 
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-lg transition-all duration-300 cursor-pointer"
      onClick={() => onViewDetails(product)}
    >
      <div className="relative overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {product.badge && (
          <div className="absolute top-3 left-3">
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
              product.badge === 'New' ? 'bg-green-100 text-green-800' :
              product.badge === 'Popular' ? 'bg-blue-100 text-blue-800' :
              product.badge === 'Bestseller' ? 'bg-orange-100 text-orange-800' :
              'bg-purple-100 text-purple-800'
            }`}>
              {product.badge}
            </span>
          </div>
        )}
        {discount > 0 && (
          <div className="absolute top-3 right-3">
            <span className="bg-red-500 text-white px-2 py-1 text-xs font-bold rounded-full">
              -{discount}%
            </span>
          </div>
        )}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {!discount && (
            <button
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="bg-white p-2 rounded-full shadow-md hover:bg-gray-50 transition-colors duration-200 mb-2"
            >
              <Heart className="h-4 w-4 text-gray-600" />
            </button>
          )}
        </div>
      </div>
      
      <div className="p-6">
        <div className="mb-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors duration-200">
            {product.name}
          </h3>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
        </div>

        <div className="flex items-center mb-3">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < Math.floor(product.rating)
                    ? 'text-yellow-400 fill-current'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="ml-2 text-sm text-gray-600">
            {product.rating} ({product.reviews})
          </span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-gray-900">${product.price}</span>
            {product.originalPrice && (
              <span className="text-lg text-gray-500 line-through">
                ${product.originalPrice}
              </span>
            )}
          </div>
          <div className={`text-sm font-medium ${
            product.inStock ? 'text-green-600' : 'text-red-600'
          }`}>
            {product.inStock ? 'In Stock' : 'Out of Stock'}
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleAddToCart}
            disabled={!product.inStock}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Add to Cart</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(product);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
          >
            <Eye className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;