import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { Product, CartItem, CartContextType } from '../types';

const CartContext = createContext<CartContextType | undefined>(undefined);

type CartAction =
  | { type: 'ADD_ITEM'; payload: Product }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'UPDATE_QUANTITY'; payload: { id: number; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: CartItem[] }; // ← for localStorage persistence

interface CartState {
  items: CartItem[];
}

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const newId = Number(action.payload.id);
      const existingItem = state.items.find(item => item.id === newId);
      if (existingItem) {
        return {
          ...state,
          items: state.items.map(item =>
            item.id === newId
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }
      return {
        ...state,
        items: [...state.items, { ...action.payload, id: newId, quantity: 1 }],
      };
    }

    case 'REMOVE_ITEM': {
      const removeId = Number(action.payload);
      return {
        ...state,
        items: state.items.filter(item => item.id !== removeId),
      };
    }

    case 'UPDATE_QUANTITY': {
      const updateId = Number(action.payload.id);
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter(item => item.id !== updateId),
        };
      }
      return {
        ...state,
        items: state.items.map(item =>
          item.id === updateId
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
      };
    }

    case 'CLEAR_CART':
      return { ...state, items: [] };

    case 'LOAD_CART':
      return { ...state, items: action.payload };

    default:
      return state;
  }
};

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  // Load cart from localStorage on first mount
  useEffect(() => {
    const stored = localStorage.getItem('cart');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          dispatch({ type: 'LOAD_CART', payload: parsed });
        }
      } catch (e) {
        console.error('Failed to parse cart from localStorage:', e);
      }
    }
  }, []);

  // Save cart to localStorage on cart change
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(state.items));
  }, [state.items]);

  const addItem = (product: Product) => {
    dispatch({ type: 'ADD_ITEM', payload: product });
  };

  const removeItem = (productId: number) => {
    dispatch({ type: 'REMOVE_ITEM', payload: productId });
  };

  const updateQuantity = (productId: number, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: productId, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const value: CartContextType = {
    items: state.items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    totalItems,
    totalPrice,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};


// import React, { createContext, useContext, useReducer, ReactNode } from 'react';
// import { Product, CartItem, CartContextType } from '../types';

// const CartContext = createContext<CartContextType | undefined>(undefined);

// type CartAction =
//   | { type: 'ADD_ITEM'; payload: Product }
//   | { type: 'REMOVE_ITEM'; payload: number }
//   | { type: 'UPDATE_QUANTITY'; payload: { id: number; quantity: number } }
//   | { type: 'CLEAR_CART' };

// interface CartState {
//   items: CartItem[];
// }

// const cartReducer = (state: CartState, action: CartAction): CartState => {
//   switch (action.type) {
//     case 'ADD_ITEM': {
//       const existingItem = state.items.find(item => item.id === action.payload.id);
//       if (existingItem) {
//         return {
//           ...state,
//           items: state.items.map(item =>
//             item.id === action.payload.id
//               ? { ...item, quantity: item.quantity + 1 }
//               : item
//           ),
//         };
//       }
//       return {
//         ...state,
//         items: [...state.items, { ...action.payload, quantity: 1 }],
//       };
//     }
//     case 'REMOVE_ITEM':
//       return {
//         ...state,
//         items: state.items.filter(item => item.id !== action.payload),
//       };
//     case 'UPDATE_QUANTITY':
//       if (action.payload.quantity <= 0) {
//         return {
//           ...state,
//           items: state.items.filter(item => item.id !== action.payload.id),
//         };
//       }
//       return {
//         ...state,
//         items: state.items.map(item =>
//           item.id === action.payload.id
//             ? { ...item, quantity: action.payload.quantity }
//             : item
//         ),
//       };
//     case 'CLEAR_CART':
//       return { ...state, items: [] };
//     default:
//       return state;
//   }
// };

// export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
//   const [state, dispatch] = useReducer(cartReducer, { items: [] });

//   const addItem = (product: Product) => {
//     dispatch({ type: 'ADD_ITEM', payload: product });
//   };

//   const removeItem = (productId: number) => {
//     dispatch({ type: 'REMOVE_ITEM', payload: productId });
//   };

//   const updateQuantity = (productId: number, quantity: number) => {
//     dispatch({ type: 'UPDATE_QUANTITY', payload: { id: productId, quantity } });
//   };

//   const clearCart = () => {
//     dispatch({ type: 'CLEAR_CART' });
//   };

//   const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
//   const totalPrice = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

//   const value: CartContextType = {
//     items: state.items,
//     addItem,
//     removeItem,
//     updateQuantity,
//     clearCart,
//     totalItems,
//     totalPrice,
//   };

//   return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
// };

// export const useCart = () => {
//   const context = useContext(CartContext);
//   if (context === undefined) {
//     throw new Error('useCart must be used within a CartProvider');
//   }
//   return context;
// };