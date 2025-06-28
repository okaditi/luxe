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
}

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState({
    searches: [] as string[],
    interests: [] as string[],
    priceRange: { min: 0, max: 1000 }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cart = useCart();

  // Natural language understanding system prompt
  const getSystemPrompt = () => {
    const cartCategories = [...new Set(cart.items.map(item => {
      const product = productsData.find(p => p.name === item.name);
      return product?.category;
    }))];
    
    const userInterests = userProfile.interests.length > 0 ? userProfile.interests : [];
    const recentSearches = userProfile.searches.slice(-5);
    
    return `You are a helpful shopping assistant for an e-commerce store. Answer user questions naturally about our available products.

OUR COMPLETE PRODUCT CATALOG:
${JSON.stringify(productsData, null, 2)}

USER CONTEXT:
- Items in cart: ${cart.items.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'Empty cart'}
- Previous interests: ${userInterests.join(', ') || 'None yet'}
- Recent searches: ${recentSearches.join(', ') || 'None'}

INSTRUCTIONS:
1. Answer questions naturally about what products we have
2. When user asks "do you have books?" check our catalog and respond conversationally
3. If we have the item, mention specific products with names and prices
4. If we don't have exactly what they want, suggest the closest alternatives
5. Be helpful and informative, like a real store assistant
6. Don't use excessive formatting - just natural conversation
7. Always check the actual product catalog above for accurate information

EXAMPLES:
User: "Do you have any books?"
Assistant: "Yes! We have some great books. I can recommend 'The Art of Programming' for $45 - it's a comprehensive guide with real-world examples and has excellent reviews. We also have 'Modern Web Design' for $39, which covers the latest design trends and techniques."

User: "Any shoes available?"
Assistant: "We have Running Sneakers for $129. They feature advanced cushioning system and breathable mesh upper - perfect for both exercise and casual wear. They have great reviews too!"

User: "What about laptops?"
Assistant: "I have the MacBook Air M3 for $1,299. It's powered by the M3 chip with 8-core CPU, has an 18-hour battery life, and a beautiful 13.6-inch display. It's been getting fantastic reviews!"`;
  };

  // Natural language product search
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
      
      // Direct keyword matching
      const searchTerms = lowerQuery.split(' ');
      searchTerms.forEach(term => {
        // Exact matches get highest score
        if (product.name.toLowerCase().includes(term)) score += 20;
        if (product.category.toLowerCase().includes(term)) score += 15;
        if (product.description.toLowerCase().includes(term)) score += 10;
        
        // Feature matching
        product.features.forEach(feature => {
          if (feature.toLowerCase().includes(term)) score += 5;
        });
      });
      
      // Pattern matching for natural language
      Object.entries(patterns).forEach(([category, keywords]) => {
        keywords.forEach(keyword => {
          if (lowerQuery.includes(keyword)) {
            if (product.category.toLowerCase() === category || 
                product.name.toLowerCase().includes(keyword) ||
                product.description.toLowerCase().includes(keyword)) {
              score += 25;
            }
          }
        });
      });
      
      // Handle specific product type questions
      if (lowerQuery.includes('shoe') || lowerQuery.includes('sneaker')) {
        if (product.name.toLowerCase().includes('sneaker') || 
            product.name.toLowerCase().includes('shoe')) score += 30;
      }
      
      if (lowerQuery.includes('laptop') || lowerQuery.includes('computer')) {
        if (product.name.toLowerCase().includes('macbook') ||
            product.name.toLowerCase().includes('laptop')) score += 30;
      }
      
      if (lowerQuery.includes('phone')) {
        if (product.name.toLowerCase().includes('iphone') ||
            product.name.toLowerCase().includes('phone')) score += 30;
      }
      
      // Boost popular products slightly
      if (product.badge === 'Popular' || product.badge === 'Bestseller') score += 5;
      
      return { ...product, score };
    });

    return scored
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Return more products for better selection
  };

  const generateResponse = async (query: string): Promise<{ content: string, products: Product[] }> => {
    // Update user profile with search
    setUserProfile(prev => ({
      ...prev,
      searches: [...prev.searches, query].slice(-10)
    }));

    try {
      // Always use AI for natural language understanding, but provide product context
      const fullPrompt = `${getSystemPrompt()}\n\nUser: ${query}`;
      
      // Find relevant products to include in response
      const relevantProducts = findRelevantProducts(query);
      
      try {
        const aiResponse = await askGemini(fullPrompt);
        return { content: aiResponse, products: relevantProducts };
      } catch (geminiError) {
        console.warn("Falling back to LangChain...");
        const model = new ChatAnthropic({
          modelName: "claude-3-haiku-20240307",
          temperature: 0.4,
        });
        
        const chain = RunnableSequence.from([
          ChatPromptTemplate.fromMessages([
            ["system", getSystemPrompt()],
            ["human", "{input}"],
          ]),
          model,
          new StringOutputParser(),
        ]);

        const aiResponse = await chain.invoke({ input: query });
        return { content: aiResponse, products: relevantProducts };
      }
    } catch (err) {
      console.error("AI Error:", err);
      return { 
        content: "I'm having trouble connecting right now. Please try again later.", 
        products: [] 
      };
    }
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
      const { content, products } = await generateResponse(currentInput);
      const botMessage: Message = {
        type: 'assistant',
        content,
        timestamp: new Date(),
        products
      };
      setMessages(prev => [...prev, botMessage]);
      
      // Update user interests based on successful searches
      if (products.length > 0) {
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
        content: "Hi! I'm your shopping assistant. I'll suggest products directly based on what you're looking for. Try asking for shoes, electronics, or anything else!",
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
                    
                    {/* Product suggestions */}
                    {msg.products && msg.products.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.products.map((product, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-2 text-sm">
                            <div className="font-medium text-purple-600">{product.name}</div>
                            <div className="text-gray-600">Rating: {product.rating}/5 • {product.reviews} reviews</div>
                            <button className="mt-1 bg-purple-500 text-white px-2 py-1 rounded text-xs hover:bg-purple-600">
                              Add to Cart
                            </button>
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
                placeholder="Ask for products (e.g., 'shoes', 'laptop')..."
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