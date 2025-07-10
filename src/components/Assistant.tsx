import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { askGemini } from '../lib/gemini';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatAnthropic } from "@langchain/anthropic";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import productsData from '../data/products.json';
import { Product, CartItem } from '../types';

interface Message {
  type: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
  products?: Product[];
  showProducts?: boolean;
}

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSuggestedProducts, setLastSuggestedProducts] = useState<Product[]>([]);
  const [conversationContext, setConversationContext] = useState<string>('');
  const [userProfile, setUserProfile] = useState({
    searches: [] as string[],
    interests: [] as string[],
    priceRange: { min: 0, max: 1000 }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cart = useCart();

  // Debug: Check if cart context is available
  useEffect(() => {
    console.log('Cart context:', cart);
    console.log('Cart items:', cart?.items);
    console.log('Add item function:', typeof cart?.addItem);
  }, [cart]);

  // Check if user is asking for product suggestions
  const isAskingForProducts = (query: string): boolean => {
    const lowerQuery = query.toLowerCase();
    
    // Direct product inquiry patterns
    const productInquiries = [
      'do you have', 'what', 'any', 'show me', 'looking for', 'need', 'want',
      'sell', 'available', 'got', 'find', 'search', 'recommend', 'suggest'
    ];
    
    // Product categories and types
    const productTypes = [
      'book', 'laptop', 'phone', 'shoe', 'clothes', 'electronics', 'fashion',
      'home', 'food', 'coffee', 'computer', 'device', 'sneaker', 'bag'
    ];
    
    // Check if query contains inquiry + product type pattern
    const hasInquiry = productInquiries.some(inquiry => lowerQuery.includes(inquiry));
    const hasProductType = productTypes.some(type => lowerQuery.includes(type));
    
    // Also check for question patterns
    const isQuestion = lowerQuery.includes('?') || lowerQuery.startsWith('what') || 
                     lowerQuery.startsWith('do you') || lowerQuery.startsWith('can you');
    
    return (hasInquiry && hasProductType) || (isQuestion && hasProductType);
  };

  // Enhanced cart action parsing with context awareness
  const parseCartAction = (query: string, context: string): { action: 'add' | 'remove' | null, products?: Product[] } => {
    const lowerQuery = query.toLowerCase();
    
    console.log('Parsing cart action for query:', query);
    console.log('Last suggested products:', lastSuggestedProducts.map(p => p.name));
    
    // Add patterns - more comprehensive
    const addPatterns = [
      'add to cart', 'add it', 'add this', 'add that', 'buy it', 'buy this', 
      'purchase it', 'purchase this', 'get it', 'get this', 'i want it',
      'i want this', 'i\'ll take it', 'i\'ll take this', 'add the first',
      'add the second', 'add the third', 'add both', 'add all'
    ];
    
    // Remove patterns
    const removePatterns = [
      'remove from cart', 'remove it', 'remove this', 'delete it', 
      'delete this', 'take it out', 'don\'t want it'
    ];
    
    const isAddAction = addPatterns.some(pattern => lowerQuery.includes(pattern));
    const isRemoveAction = removePatterns.some(pattern => lowerQuery.includes(pattern));
    
    console.log('Is add action:', isAddAction);
    console.log('Is remove action:', isRemoveAction);
    
    if (isAddAction) {
      // Try to determine which products to add
      const productsToAdd = determineProductsFromContext(query, lastSuggestedProducts);
      console.log('Products to add:', productsToAdd.map(p => p.name));
      return { action: 'add', products: productsToAdd };
    }
    
    if (isRemoveAction) {
      // For remove, try to find products from cart or context
      const productsToRemove = determineProductsFromContext(query, lastSuggestedProducts);
      console.log('Products to remove:', productsToRemove.map(p => p.name));
      return { action: 'remove', products: productsToRemove };
    }
    
    return { action: null };
  };

  // Determine which products user is referring to
  const determineProductsFromContext = (query: string, availableProducts: Product[]): Product[] => {
    const lowerQuery = query.toLowerCase();
    
    console.log('Determining products from query:', query);
    console.log('Available products:', availableProducts.map(p => p.name));
    
    // Handle specific product mentions by name
    const mentionedProducts = availableProducts.filter(product => 
      lowerQuery.includes(product.name.toLowerCase())
    );
    
    if (mentionedProducts.length > 0) {
      console.log('Found mentioned products:', mentionedProducts.map(p => p.name));
      return mentionedProducts;
    }
    
    // Handle positional references (first, second, etc.)
    if (lowerQuery.includes('first') || lowerQuery.includes('1st')) {
      console.log('Adding first product:', availableProducts[0]?.name);
      return availableProducts.slice(0, 1);
    }
    if (lowerQuery.includes('second') || lowerQuery.includes('2nd')) {
      console.log('Adding second product:', availableProducts[1]?.name);
      return availableProducts.slice(1, 2);
    }
    if (lowerQuery.includes('third') || lowerQuery.includes('3rd')) {
      console.log('Adding third product:', availableProducts[2]?.name);
      return availableProducts.slice(2, 3);
    }
    if (lowerQuery.includes('last')) {
      console.log('Adding last product:', availableProducts[availableProducts.length - 1]?.name);
      return availableProducts.slice(-1);
    }
    
    // Handle collective references
    if (lowerQuery.includes('both') && availableProducts.length >= 2) {
      console.log('Adding both products:', availableProducts.slice(0, 2).map(p => p.name));
      return availableProducts.slice(0, 2);
    }
    if (lowerQuery.includes('all')) {
      console.log('Adding all products:', availableProducts.map(p => p.name));
      return availableProducts;
    }
    
    // Handle generic references (it, this, that)
    if (lowerQuery.includes('it') || lowerQuery.includes('this') || lowerQuery.includes('that')) {
      // Default to first product if available
      console.log('Adding default (first) product:', availableProducts[0]?.name);
      return availableProducts.slice(0, 1);
    }
    
    console.log('No products determined from context');
    return [];
  };

  // Build conversation context for AI
  const buildConversationContext = (): string => {
    const recentMessages = messages.slice(-6); // Last 6 messages for context
    const contextParts = [];
    
    if (recentMessages.length > 0) {
      contextParts.push("RECENT CONVERSATION:");
      recentMessages.forEach(msg => {
        if (msg.type === 'user') {
          contextParts.push(`User: ${msg.content}`);
        } else if (msg.type === 'assistant') {
          contextParts.push(`Assistant: ${msg.content}`);
          if (msg.products && msg.products.length > 0) {
            contextParts.push(`[Suggested products: ${msg.products.map(p => p.name).join(', ')}]`);
          }
        }
      });
    }
    
    if (lastSuggestedProducts.length > 0) {
      contextParts.push(`\nLAST SUGGESTED PRODUCTS: ${lastSuggestedProducts.map(p => p.name).join(', ')}`);
    }
    
    return contextParts.join('\n');
  };

  // Natural language understanding system prompt with context
  const getSystemPrompt = (showProducts: boolean = false, context: string = '') => {
    const cartCategories = [...new Set(cart.items.map(item => {
      const product = productsData.find(p => p.name === item.name);
      return product?.category;
    }))];
    
    const userInterests = userProfile.interests.length > 0 ? userProfile.interests : [];
    const recentSearches = userProfile.searches.slice(-5);
    
    const basePrompt = `You are a helpful shopping assistant for an e-commerce store. You maintain conversation context and can understand references to previously mentioned products.

USER CONTEXT:
- Items in cart: ${cart.items.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'Empty cart'}
- Previous interests: ${userInterests.join(', ') || 'None yet'}
- Recent searches: ${recentSearches.join(', ') || 'None'}

${context ? `CONVERSATION CONTEXT:\n${context}\n` : ''}

INSTRUCTIONS:
1. Maintain conversation context - remember what products were just suggested
2. Understand references like "add it", "the first one", "both", etc.
3. When user says "add it" or similar, refer to the most recently suggested products
4. Answer questions naturally and conversationally
5. Be helpful and informative, like a real store assistant
6. Don't use excessive formatting - just natural conversation
7. Only mention specific products when user is clearly asking for product recommendations
8. For general questions, provide helpful answers without pushing products`;

    if (showProducts) {
      return basePrompt + `

OUR COMPLETE PRODUCT CATALOG:
${JSON.stringify(productsData, null, 2)}

PRODUCT RECOMMENDATION INSTRUCTIONS:
- When user asks about products, check our catalog and respond with specific recommendations
- If we have the item, mention specific products with names and prices
- If we don't have exactly what they want, suggest the closest alternatives
- Focus only on the most relevant products - don't add random suggestions
- Remember these suggestions for follow-up questions

EXAMPLES:
User: "Do you have any books?"
Assistant: "Yes! We have some great books. I can recommend 'The Art of Programming' for $45 - it's a comprehensive guide with real-world examples and has excellent reviews. We also have 'Modern Web Design' for $39, which covers the latest design trends and techniques."

User: "Any shoes available?"
Assistant: "We have Running Sneakers for $129. They feature advanced cushioning system and breathable mesh upper - perfect for both exercise and casual wear. They have great reviews too!"`;
    }

    return basePrompt;
  };

  // Natural language product search - only return highly relevant products
  const findRelevantProducts = (query: string): Product[] => {
    const lowerQuery = query.toLowerCase();
    
    // Define search patterns for natural language
    const patterns = {
      books: ['book', 'books', 'read', 'programming', 'design', 'learning'],
      electronics: ['phone', 'laptop', 'computer', 'tech', 'electronic', 'device', 'mouse', 'headphone'],
      fashion: ['clothes', 'clothing', 'wear', 'fashion', 'shoe', 'shoes', 'sneaker', 'coat', 'bag', 'handbag'],
      home: ['home', 'garden', 'house', 'decor', 'lamp', 'plant', 'pot'],
      food: ['coffee', 'food', 'drink', 'beverage', 'organic']
    };
    
    const scored = productsData.map(product => {
      let score = 0;
      
      // Direct keyword matching - higher scores for exact matches
      const searchTerms = lowerQuery.split(' ');
      searchTerms.forEach(term => {
        // Exact matches get highest score
        if (product.name.toLowerCase().includes(term)) score += 30;
        if (product.category.toLowerCase().includes(term)) score += 25;
        if (product.description.toLowerCase().includes(term)) score += 15;
        
        // Feature matching
        product.features.forEach(feature => {
          if (feature.toLowerCase().includes(term)) score += 10;
        });
      });
      
      // Pattern matching for natural language
      Object.entries(patterns).forEach(([category, keywords]) => {
        keywords.forEach(keyword => {
          if (lowerQuery.includes(keyword)) {
            if (product.category.toLowerCase() === category || 
                product.name.toLowerCase().includes(keyword) ||
                product.description.toLowerCase().includes(keyword)) {
              score += 35;
            }
          }
        });
      });
      
      // Handle specific product type questions with high precision
      if (lowerQuery.includes('shoe') || lowerQuery.includes('sneaker')) {
        if (product.name.toLowerCase().includes('sneaker') || 
            product.name.toLowerCase().includes('shoe')) score += 40;
      }
      
      if (lowerQuery.includes('laptop') || lowerQuery.includes('computer')) {
        if (product.name.toLowerCase().includes('macbook') ||
            product.name.toLowerCase().includes('laptop')) score += 40;
      }
      
      if (lowerQuery.includes('phone')) {
        if (product.name.toLowerCase().includes('iphone') ||
            product.name.toLowerCase().includes('phone')) score += 40;
      }
      
      // Boost popular products slightly
      if (product.badge === 'Popular' || product.badge === 'Bestseller') score += 5;
      
      return { ...product, score };
    });

    // Only return products with significant relevance scores
    return scored
      .filter(p => p.score >= 25) // Higher threshold for relevance
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Limit to top 3 most relevant
  };

  const generateResponse = async (query: string): Promise<{ content: string, products: Product[], showProducts: boolean }> => {
    // Update user profile with search
    setUserProfile(prev => ({
      ...prev,
      searches: [...prev.searches, query].slice(-10)
    }));

    // Build conversation context
    const context = buildConversationContext();

    // Check for cart actions first (with context awareness)
    const cartAction = parseCartAction(query, context);
    if (cartAction.action && cartAction.products && cartAction.products.length > 0) {
      if (cartAction.action === 'add') {
        // Add all specified products to cart
        const addedProducts = [];
        for (const product of cartAction.products) {
          try {
            cart.addItem(product);
            addedProducts.push(product.name);
            console.log('Added to cart:', product.name); // Debug log
          } catch (error) {
            console.error('Error adding to cart:', error);
          }
        }
        
        if (addedProducts.length > 0) {
          return {
            content: `Perfect! I've added ${addedProducts.join(' and ')} to your cart. You now have ${cart.items.length} item(s) in your cart.`,
            products: [],
            showProducts: false
          };
        }
      } else if (cartAction.action === 'remove') {
        // Remove all specified products from cart
        const removedProducts = [];
        for (const product of cartAction.products) {
          try {
            cart.removeItem(product.id);
            removedProducts.push(product.name);
            console.log('Removed from cart:', product.name); // Debug log
          } catch (error) {
            console.error('Error removing from cart:', error);
          }
        }
        
        if (removedProducts.length > 0) {
          return {
            content: `I've removed ${removedProducts.join(' and ')} from your cart. You now have ${cart.items.length} item(s) in your cart.`,
            products: [],
            showProducts: false
          };
        }
      }
    }

    // Check if user is asking for products
    const askingForProducts = isAskingForProducts(query);

    try {
      const fullPrompt = `${getSystemPrompt(askingForProducts, context)}\n\nUser: ${query}`;
      
      // Find relevant products only if user is asking for them
      const relevantProducts = askingForProducts ? findRelevantProducts(query) : [];
      
      try {
        const aiResponse = await askGemini(fullPrompt);
        
        // Update last suggested products if we're showing products
        if (askingForProducts && relevantProducts.length > 0) {
          setLastSuggestedProducts(relevantProducts);
        }
        
        return { 
          content: aiResponse, 
          products: relevantProducts,
          showProducts: askingForProducts && relevantProducts.length > 0
        };
      } catch (geminiError) {
        console.warn("Falling back to LangChain...");
        const model = new ChatAnthropic({
          modelName: "claude-3-haiku-20240307",
          temperature: 0.4,
        });
        
        const chain = RunnableSequence.from([
          ChatPromptTemplate.fromMessages([
            ["system", getSystemPrompt(askingForProducts, context)],
            ["human", "{input}"],
          ]),
          model,
          new StringOutputParser(),
        ]);

        const aiResponse = await chain.invoke({ input: query });
        
        // Update last suggested products if we're showing products
        if (askingForProducts && relevantProducts.length > 0) {
          setLastSuggestedProducts(relevantProducts);
        }
        
        return { 
          content: aiResponse, 
          products: relevantProducts,
          showProducts: askingForProducts && relevantProducts.length > 0
        };
      }
    } catch (err) {
      console.error("AI Error:", err);
      return { 
        content: "I'm having trouble connecting right now. Please try again later.", 
        products: [],
        showProducts: false
      };
    }
  };

  const handleAddToCart = (product: Product) => {
    cart.addItem(product);
    
    // Add a system message to show the item was added
    const systemMessage: Message = {
      type: 'assistant',
      content: `Great! I've added ${product.name} to your cart for $${product.price}.`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const handleRemoveFromCart = (productId: number) => {
    const product = productsData.find(p => p.id === productId);
    cart.removeItem(productId);
    
    // Add a system message to show the item was removed
    const systemMessage: Message = {
      type: 'assistant',
      content: `I've removed ${product?.name || 'the item'} from your cart.`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = {
      type: 'user',
      content: input,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    
    try {
      const { content, products, showProducts } = await generateResponse(currentInput);
      const botMessage: Message = {
        type: 'assistant',
        content,
        timestamp: new Date(),
        products: showProducts ? products : undefined,
        showProducts
      };
      setMessages(prev => [...prev, botMessage]);
      
      // Update user interests based on successful product searches
      if (showProducts && products.length > 0) {
        const categories = [...new Set(products.map(p => p.category))];
        setUserProfile(prev => ({
          ...prev,
          interests: [...new Set([...prev.interests, ...categories])].slice(-5)
        }));
      }
    } catch (error) {
      const errorMessage: Message = {
        type: 'error',
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Example questions for users
  const quickActions = [
    { label: "📚 Do you have books?", query: "Do you have any books?" },
    { label: "👟 Any shoes available?", query: "Do you have shoes?" },
    { label: "📱 What phones do you sell?", query: "What phones do you have?" },
    { label: "💻 Any laptops?", query: "Do you sell laptops?" },
    { label: "☕ Got coffee?", query: "Do you have coffee?" }
  ];

  const handleQuickAction = (query: string) => {
    setInput(query);
    setTimeout(() => handleSend(), 100);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        type: 'assistant',
        content: "Hi! I'm your shopping assistant. I can help you find products, answer questions, and manage your cart. What can I help you with today?",
        timestamp: new Date(),
      }]);
    }
  }, [open]);

  return (
    <>
      <motion.div
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-5 right-5 bg-gradient-to-r from-purple-600 to-pink-500 shadow-xl rounded-full p-4 text-2xl text-white cursor-pointer z-50 hover:shadow-2xl transition-all"
        title="Shopping Assistant"
      >
        <motion.div 
          animate={{ rotate: open ? 360 : 0 }}
          transition={{ duration: 0.3 }}
        >
          🛍️
        </motion.div>
        {isListening && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
          />
        )}
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-20 right-5 h-[70vh] w-[90vw] max-w-md bg-white shadow-2xl rounded-xl border border-gray-200 z-50 flex flex-col overflow-hidden"
          >
            <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-3 rounded-t-xl text-lg font-bold flex items-center justify-between">
              <span>Smart Shopping Assistant</span>
              <button 
                onClick={() => setOpen(false)}
                className="text-white hover:text-gray-200 text-xl"
              >
                ×
              </button>
            </div>
            
            {/* Quick Actions */}
            {messages.length <= 1 && (
              <div className="p-3 bg-gray-50 border-b">
                <div className="text-xs text-gray-600 mb-2">Quick suggestions:</div>
                <div className="flex flex-wrap gap-1">
                  {quickActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickAction(action.query)}
                      className="text-xs bg-white border rounded-full px-2 py-1 hover:bg-purple-50 hover:border-purple-300 transition-colors"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ x: msg.type === 'user' ? 40 : -40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`rounded-xl px-4 py-2 max-w-[85%] ${
                      msg.type === 'user'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : msg.type === 'error'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-white text-gray-800 border'
                    } shadow-md`}
                  >
                    <div className="whitespace-pre-line">{msg.content}</div>
                    
                    {/* Product suggestions - only show when explicitly requested */}
                    {msg.showProducts && msg.products && msg.products.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.products.map((product, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3 text-sm border">
                            <div className="font-medium text-purple-600 mb-1">{product.name}</div>
                            <div className="text-gray-600 mb-1">${product.price}</div>
                            <div className="text-gray-500 text-xs mb-2">
                              Rating: {product.rating}/5 • {product.reviews} reviews
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleAddToCart(product)}
                                className="bg-purple-500 text-white px-3 py-1 rounded text-xs hover:bg-purple-600 transition-colors"
                              >
                                Add to Cart
                              </button>
                              {cart.items.some(item => item.name === product.name) && (
                                <button 
                                  onClick={() => handleRemoveFromCart(product.id)}
                                  className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600 transition-colors"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="text-xs mt-1 opacity-70">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-white border text-gray-800 rounded-xl px-4 py-2 max-w-[80%]">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
            
            <div className="border-t p-3 bg-white flex gap-2">
              <input
                className="flex-1 p-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything or request product recommendations..."
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}