import { GoogleGenerativeAI } from "@google/generative-ai";
const API_KEY = import.meta.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(API_KEY);

export async function askGemini(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      }
    });

    const result = await model.generateContent({
      contents: [{ 
        role: "user",
        parts: [{ text: prompt }] 
      }],
    });

    return (await result.response).text();
  } catch (err) {
    console.error("Gemini Error:", err);
    throw new Error("Failed to get response from Gemini");
  }
}