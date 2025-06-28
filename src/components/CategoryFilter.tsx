import React from 'react';
import { Smartphone, Shirt, Book, Home, Coffee, Mouse } from 'lucide-react';

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onCategoryChange,
}) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Electronics':
        return <Smartphone className="h-5 w-5" />;
      case 'Fashion':
        return <Shirt className="h-5 w-5" />;
      case 'Books':
        return <Book className="h-5 w-5" />;
      case 'Home & Garden':
        return <Home className="h-5 w-5" />;
      case 'Food & Beverage':
        return <Coffee className="h-5 w-5" />;
      default:
        return <Mouse className="h-5 w-5" />;
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Categories</h3>
      <div className="space-y-2">
        <button
          onClick={() => onCategoryChange('')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
            selectedCategory === ''
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Mouse className="h-5 w-5" />
          <span className="font-medium">All Products</span>
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
              selectedCategory === category
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {getCategoryIcon(category)}
            <span className="font-medium">{category}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryFilter;