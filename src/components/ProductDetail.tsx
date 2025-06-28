import React, { useState } from 'react';
import { X, Star, ShoppingCart, Heart, Share2, Truck, Shield, RotateCcw } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';

interface ProductDetailProps {
  product: Product;
  onClose: () => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ product, onClose }) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      addItem(product);
    }
  };

  const discount = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Product Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Product Images */}
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={product.images[selectedImage]}
                  alt={product.name}
                  className="w-full h-96 object-cover rounded-xl"
                />
                {product.badge && (
                  <div className="absolute top-4 left-4">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
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
                  <div className="absolute top-4 right-4">
                    <span className="bg-red-500 text-white px-3 py-1 text-sm font-bold rounded-full">
                      -{discount}% OFF
                    </span>
                  </div>
                )}
              </div>
              
              {product.images.length > 1 && (
                <div className="flex space-x-2">
                  {product.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                        selectedImage === index
                          ? 'border-blue-500'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`${product.name} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
                <p className="text-gray-600 leading-relaxed">{product.description}</p>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.floor(product.rating)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-lg text-gray-600">
                  {product.rating} ({product.reviews} reviews)
                </span>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center space-x-4 mb-4">
                  <span className="text-4xl font-bold text-gray-900">${product.price}</span>
                  {product.originalPrice && (
                    <span className="text-2xl text-gray-500 line-through">
                      ${product.originalPrice}
                    </span>
                  )}
                  {discount > 0 && (
                    <span className="text-lg font-semibold text-red-600">
                      Save ${product.originalPrice! - product.price}
                    </span>
                  )}
                </div>
                
                <div className={`text-lg font-medium mb-6 ${
                  product.inStock ? 'text-green-600' : 'text-red-600'
                }`}>
                  {product.inStock ? '✓ In Stock - Ready to Ship' : '✗ Out of Stock'}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700">Quantity:</label>
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-2 hover:bg-gray-50 transition-colors duration-200"
                    >
                      -
                    </button>
                    <span className="px-4 py-2 text-center min-w-[3rem]">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="px-3 py-2 hover:bg-gray-50 transition-colors duration-200"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleAddToCart}
                    disabled={!product.inStock}
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2"
                  >
                    <ShoppingCart className="h-5 w-5" />
                    <span>Add to Cart</span>
                  </button>
                  <button className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                    <Heart className="h-5 w-5 text-gray-600" />
                  </button>
                  <button className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                    <Share2 className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Product Features */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Features</h3>
                <ul className="space-y-2">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Shipping & Returns */}
              <div className="border-t border-gray-200 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Truck className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">Free Shipping</div>
                      <div className="text-xs text-gray-600">Orders over $50</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RotateCcw className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">30-Day Returns</div>
                      <div className="text-xs text-gray-600">Hassle-free returns</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-purple-600" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">Warranty</div>
                      <div className="text-xs text-gray-600">1-year guarantee</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;