// NOTE: The Gemini AI initialization and chat logic have been integrated 
// directly into the `useJarvis.js` custom hook. This was done to colocate 
// the AI chat instance with the speech recognition and synthesis logic that 
// directly consumes it, simplifying state management for this specific application.

// In a larger, more complex application, it would be beneficial to keep the service
// separate, like this:

/*
import { GoogleGenAI } from '@google/genai';

let chat = null;

export const initializeChat = () => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: "You are Jarvis...",
    },
  });
};

export const getChatInstance = () => {
  if (!chat) {
    throw new Error("Chat not initialized. Call initializeChat() first.");
  }
  return chat;
}
*/

// This file is kept for structural clarity but is not actively used.
export {};
