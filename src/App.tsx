import React, { useState, useEffect } from 'react';
import { CartProvider } from './context/CartContext';
import Header from './components/Header';
import CategoryFilter from './components/CategoryFilter';
import ProductGrid from './components/ProductGrid';
import ProductDetail from './components/ProductDetail';
import Cart from './components/Cart';
import { Product } from './types';
import productsData from './data/products.json';
import Assistant from './components/Assistant';


function App() {
  const [products] = useState<Product[]>(productsData);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(products);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const categories = Array.from(new Set(products.map(product => product.category)));

  useEffect(() => {
    let filtered = products;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  }, [products, selectedCategory, searchQuery]);

  return (
    <CartProvider>
      <div className="min-h-screen bg-gray-50">
        <Header
          onCartClick={() => setIsCartOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar */}
            <aside className="lg:w-64 flex-shrink-0">
              <CategoryFilter
                categories={categories}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
              />
            </aside>

            {/* Main Content */}
            <div className="flex-1">
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedCategory || 'All Products'}
                  </h2>
                  <span className="text-sm text-gray-600">
                    {filteredProducts.length} products found
                  </span>
                </div>
                {searchQuery && (
                  <p className="text-sm text-gray-600 mt-2">
                    Showing results for "{searchQuery}"
                  </p>
                )}
              </div>

              <ProductGrid
                products={filteredProducts}
                onProductClick={setSelectedProduct}
              />
            </div>
          </div>
        </main>

        {/* Product Detail Modal */}
        {selectedProduct && (
          <ProductDetail
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
        )}

        {/* Cart Sidebar */}
        <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
          <Assistant />
      </div>
    </CartProvider>
  );
}

export default App;