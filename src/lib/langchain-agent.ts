// lib/langchain-agent.ts
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { StateGraph, END } from "@langchain/langgraph";
import { Product, CartItem } from '../types';
import products from '../data/products.json';

// Agent State Interface
interface AgentState {
  messages: BaseMessage[];
  userQuery: string;
  cartContext: string;
  productSuggestions: Product[];
  intent: 'recommendation' | 'product_search' | 'cart_query' | 'general' | 'purchase_advice';
  userProfile: UserProfile;
}

interface UserProfile {
  purchaseHistory: CartItem[];
  preferences: {
    categories: string[];
    priceRange: { min: number; max: number };
    brands: string[];
  };
  demographics: {
    age?: number;
    gender?: string;
    interests: string[];
  };
}

class ShoppingAssistantAgent {
  private llm: ChatGoogleGenerativeAI;
  private graph: StateGraph<AgentState>;

  constructor(apiKey: string) {
    this.llm = new ChatGoogleGenerativeAI({
      apiKey,
      modelName: "gemini-pro",
      temperature: 0.7,
    });

    this.graph = this.createGraph();
  }

  private createGraph(): StateGraph<AgentState> {
    const graph = new StateGraph<AgentState>({
      channels: {
        messages: { reducer: (x, y) => [...x, ...y] },
        userQuery: { reducer: (x, y) => y || x },
        cartContext: { reducer: (x, y) => y || x },
        productSuggestions: { reducer: (x, y) => y || x },
        intent: { reducer: (x, y) => y || x },
        userProfile: { reducer: (x, y) => ({ ...x, ...y }) },
      }
    });

    // Add nodes
    graph.addNode("classify_intent", this.classifyIntent.bind(this));
    graph.addNode("analyze_user_profile", this.analyzeUserProfile.bind(this));
    graph.addNode("product_recommendation", this.generateProductRecommendations.bind(this));
    graph.addNode("product_search", this.searchProducts.bind(this));
    graph.addNode("cart_analysis", this.analyzeCart.bind(this));
    graph.addNode("purchase_advisor", this.providePurchaseAdvice.bind(this));
    graph.addNode("general_response", this.generateGeneralResponse.bind(this));

    // Define edges
    graph.addEdge("classify_intent", "analyze_user_profile");
    
    graph.addConditionalEdges(
      "analyze_user_profile",
      this.routeByIntent.bind(this),
      {
        recommendation: "product_recommendation",
        product_search: "product_search",
        cart_query: "cart_analysis",
        purchase_advice: "purchase_advisor",
        general: "general_response"
      }
    );

    // All paths lead to END
    graph.addEdge("product_recommendation", END);
    graph.addEdge("product_search", END);
    graph.addEdge("cart_analysis", END);
    graph.addEdge("purchase_advisor", END);
    graph.addEdge("general_response", END);

    graph.setEntryPoint("classify_intent");

    return graph.compile();
  }

  private async classifyIntent(state: AgentState): Promise<Partial<AgentState>> {
    const prompt = ChatPromptTemplate.fromTemplate(`
      You are a shopping assistant. Classify the user's intent from their message.
      
      User message: {query}
      Cart context: {cartContext}
      
      Classify into one of these intents:
      - recommendation: User wants product suggestions (e.g., "suggest gifts for my daughter", "what should I buy for winter")
      - product_search: User is looking for specific products (e.g., "show me white t-shirts", "find running shoes")
      - cart_query: User has questions about their cart or purchase history
      - purchase_advice: User needs advice on making a purchase decision
      - general: General conversation or other topics
      
      Return only the intent word.
    `);

    const chain = prompt.pipe(this.llm);
    const result = await chain.invoke({
      query: state.userQuery,
      cartContext: state.cartContext
    });

    const intent = result.content.toString().toLowerCase().trim() as AgentState['intent'];
    
    return { intent };
  }

  private async analyzeUserProfile(state: AgentState): Promise<Partial<AgentState>> {
    const purchaseHistory = state.userProfile.purchaseHistory || [];
    
    // Analyze user preferences from cart history
    const categories = [...new Set(purchaseHistory.map(item => item.category))];
    const priceRange = {
      min: Math.min(...purchaseHistory.map(item => item.price)),
      max: Math.max(...purchaseHistory.map(item => item.price))
    };

    // Extract interests from query and purchase history
    const interests = this.extractInterests(state.userQuery, purchaseHistory);

    const userProfile: UserProfile = {
      ...state.userProfile,
      preferences: {
        categories,
        priceRange: isFinite(priceRange.min) ? priceRange : { min: 0, max: 1000 },
        brands: []
      },
      demographics: {
        ...state.userProfile.demographics,
        interests
      }
    };

    return { userProfile };
  }

  private extractInterests(query: string, history: CartItem[]): string[] {
    const keywords = query.toLowerCase().match(/\b\w+\b/g) || [];
    const categoryKeywords = history.map(item => item.category.toLowerCase());
    
    const interests = [...new Set([...keywords, ...categoryKeywords])]
      .filter(word => word.length > 3)
      .slice(0, 10);

    return interests;
  }

  private async generateProductRecommendations(state: AgentState): Promise<Partial<AgentState>> {
    const prompt = ChatPromptTemplate.fromTemplate(`
      You are an expert shopping assistant in a premium store. Based on the user's request and their profile, recommend products.
      
      User Request: {query}
      User's Purchase History: {history}
      User's Preferred Categories: {categories}
      Available Products: {products}
      
      Provide personalized recommendations with explanations. Consider:
      - User's past purchases and preferences
      - Seasonal relevance
      - Complementary items
      - Budget considerations
      - Quality and value
      
      Format your response as a friendly shopping assistant would speak, with enthusiasm and expertise.
      Mention specific product names and explain why each recommendation fits their needs.
    `);

    const chain = prompt.pipe(this.llm);
    
    // Filter relevant products based on query and user profile
    const relevantProducts = this.findRelevantProducts(state.userQuery, state.userProfile);
    
    const result = await chain.invoke({
      query: state.userQuery,
      history: state.userProfile.purchaseHistory.map(item => `${item.name} (${item.category})`).join(', '),
      categories: state.userProfile.preferences.categories.join(', '),
      products: relevantProducts.slice(0, 10).map(p => `${p.name} - ${p.category} - $${p.price}`).join('\n')
    });

    return {
      productSuggestions: relevantProducts,
      messages: [new AIMessage(result.content.toString())]
    };
  }

  private async searchProducts(state: AgentState): Promise<Partial<AgentState>> {
    const searchResults = this.findRelevantProducts(state.userQuery, state.userProfile);
    
    const prompt = ChatPromptTemplate.fromTemplate(`
      You are a helpful shopping assistant. The user is looking for specific products.
      
      User Query: {query}
      Search Results: {results}
      User's Past Preferences: {preferences}
      
      Present the search results in an engaging way, highlighting features that match the user's preferences.
      If no exact matches, suggest similar alternatives. Be enthusiastic and helpful.
    `);

    const chain = prompt.pipe(this.llm);
    const result = await chain.invoke({
      query: state.userQuery,
      results: searchResults.slice(0, 8).map(p => 
        `${p.name} - ${p.category} - $${p.price} - ${p.description}`
      ).join('\n'),
      preferences: state.userProfile.preferences.categories.join(', ')
    });

    return {
      productSuggestions: searchResults,
      messages: [new AIMessage(result.content.toString())]
    };
  }

  private async analyzeCart(state: AgentState): Promise<Partial<AgentState>> {
    const prompt = ChatPromptTemplate.fromTemplate(`
      You are a shopping assistant analyzing the user's cart and purchase history.
      
      Current Cart: {cartContext}
      User Query: {query}
      Purchase History: {history}
      
      Provide insights about their cart, suggest improvements, or answer their specific questions.
      Be helpful and consultative, like a personal shopping advisor.
    `);

    const chain = prompt.pipe(this.llm);
    const result = await chain.invoke({
      cartContext: state.cartContext,
      query: state.userQuery,
      history: state.userProfile.purchaseHistory.map(item => 
        `${item.name} - ${item.category} - $${item.price}`
      ).join('\n')
    });

    return {
      messages: [new AIMessage(result.content.toString())]
    };
  }

  private async providePurchaseAdvice(state: AgentState): Promise<Partial<AgentState>> {
    const prompt = ChatPromptTemplate.fromTemplate(`
      You are an experienced shopping consultant providing purchase advice.
      
      User Question: {query}
      Their Cart: {cartContext}
      Their History: {history}
      Available Products: {products}
      
      Provide expert advice considering quality, value, user needs, and alternatives.
      Be thorough but concise, like a trusted shopping advisor.
    `);

    const chain = prompt.pipe(this.llm);
    const relevantProducts = this.findRelevantProducts(state.userQuery, state.userProfile);
    
    const result = await chain.invoke({
      query: state.userQuery,
      cartContext: state.cartContext,
      history: state.userProfile.purchaseHistory.map(item => item.name).join(', '),
      products: relevantProducts.slice(0, 5).map(p => 
        `${p.name} - $${p.price} - ${p.rating}/5 stars`
      ).join('\n')
    });

    return {
      messages: [new AIMessage(result.content.toString())]
    };
  }

  private async generateGeneralResponse(state: AgentState): Promise<Partial<AgentState>> {
    const prompt = ChatPromptTemplate.fromTemplate(`
      You are a friendly shopping assistant. Respond to the user's message in a helpful, engaging way.
      If appropriate, guide the conversation back to how you can help with their shopping needs.
      
      User Message: {query}
      Context: This is an e-commerce shopping assistant conversation.
      
      Be conversational, helpful, and maintain your role as a shopping expert.
    `);

    const chain = prompt.pipe(this.llm);
    const result = await chain.invoke({
      query: state.userQuery
    });

    return {
      messages: [new AIMessage(result.content.toString())]
    };
  }

  private routeByIntent(state: AgentState): string {
    return state.intent;
  }

  private findRelevantProducts(query: string, userProfile: UserProfile): Product[] {
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/);
    
    return (products as Product[])
      .map(product => ({
        ...product,
        relevanceScore: this.calculateRelevanceScore(product, keywords, userProfile)
      }))
      .filter(product => product.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20);
  }

  private calculateRelevanceScore(product: Product, keywords: string[], userProfile: UserProfile): number {
    let score = 0;
    
    // Keyword matching
    keywords.forEach(keyword => {
      if (product.name.toLowerCase().includes(keyword)) score += 10;
      if (product.description.toLowerCase().includes(keyword)) score += 5;
      if (product.category.toLowerCase().includes(keyword)) score += 8;
    });
    
    // User preference matching
    if (userProfile.preferences.categories.includes(product.category)) {
      score += 15;
    }
    
    // Price range preference
    const { min, max } = userProfile.preferences.priceRange;
    if (product.price >= min && product.price <= max) {
      score += 5;
    }
    
    // Rating bonus
    score += product.rating || 0;
    
    return score;
  }

  async processMessage(
    userMessage: string,
    cartItems: CartItem[],
    conversationHistory: BaseMessage[] = []
  ): Promise<{ response: string; suggestions: Product[] }> {
    const cartContext = cartItems.length > 0 
      ? `Current cart: ${cartItems.map(item => `${item.name} (${item.quantity}x)`).join(', ')}`
      : 'Cart is empty';

    const initialState: AgentState = {
      messages: conversationHistory,
      userQuery: userMessage,
      cartContext,
      productSuggestions: [],
      intent: 'general',
      userProfile: {
        purchaseHistory: cartItems,
        preferences: { categories: [], priceRange: { min: 0, max: 1000 }, brands: [] },
        demographics: { interests: [] }
      }
    };

    const result = await this.graph.invoke(initialState);
    
    const lastMessage = result.messages[result.messages.length - 1];
    const response = lastMessage instanceof AIMessage ? lastMessage.content.toString() : "I'm here to help with your shopping needs!";
    
    return {
      response,
      suggestions: result.productSuggestions || []
    };
  }
}

export default ShoppingAssistantAgent;