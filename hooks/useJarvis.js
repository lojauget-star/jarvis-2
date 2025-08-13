import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';

// Polyfill for webkitSpeechRecognition
const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;

export const useJarvis = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);
  
  const recognitionRef = useRef(null);
  const chatRef = useRef(null);
  const onResultCallbackRef = useRef((_) => {});
  const utteranceQueueRef = useRef([]);
  const isCancelingRef = useRef(false);

  const isBrowserSupported = !!SpeechRecognitionApi && !!window.speechSynthesis;

  useEffect(() => {
    if (!process.env.API_KEY) {
      console.error("API_KEY environment variable not set.");
      return;
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    chatRef.current = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: "Você é Jarvis, um assistente de IA espirituoso, sofisticado e incrivelmente prestativo, inspirado no de Homem de Ferro. Responda em português brasileiro com uma mistura de profissionalismo, charme e um toque de humor seco. Mantenha suas respostas concisas e diretas, mas não tenha medo de ser um pouco brincalhão. Seu objetivo é ajudar o usuário de forma eficiente, mantendo sua personalidade única. Dirija-se ao usuário como 'Senhor'. Ao usar informações da internet, seja sucinto.",
        thinkingConfig: { thinkingBudget: 0 },
        tools: [{googleSearch: {}}],
      },
    });
    setIsApiReady(true);
  }, []);
  
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }
  }, []);

  const startListening = useCallback((onResultCallback) => {
    if (isListening || isSpeaking || !isBrowserSupported) return;

    onResultCallbackRef.current = onResultCallback;
    const recognition = new SpeechRecognitionApi();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'pt-BR';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      onResultCallbackRef.current(transcript);
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [isListening, isSpeaking, isBrowserSupported]);


  const getJarvisResponseStream = useCallback(async (message) => {
    if (!chatRef.current) {
      throw new Error("Jarvis AI not initialized.");
    }
    const response = await chatRef.current.sendMessageStream({ message });
    return response;
  }, []);

  const processQueue = useCallback(() => {
    if (window.speechSynthesis.speaking || utteranceQueueRef.current.length === 0) {
      return;
    }
    const utterance = utteranceQueueRef.current.shift();
    if (utterance) {
      isCancelingRef.current = false;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const speak = useCallback((text) => {
    if (!isBrowserSupported || !text.trim()) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 3.0; // Increased speech rate by 2x from 1.5

    utterance.onstart = () => setIsSpeaking(true);

    utterance.onend = () => {
      if (utteranceQueueRef.current.length > 0) {
        processQueue();
      } else {
        setIsSpeaking(false);
      }
    };

    utterance.onerror = (e) => {
      if (e.error === 'interrupted' && isCancelingRef.current) {
        // This is an intentional cancellation, do not log an error.
        isCancelingRef.current = false;
      } else {
        console.error(`Speech synthesis error: ${e.error}`);
      }
      
      if (utteranceQueueRef.current.length > 0) {
        processQueue();
      } else {
        setIsSpeaking(false);
      }
    };

    utteranceQueueRef.current.push(utterance);
    processQueue();
  }, [isBrowserSupported, processQueue]);

  const cancelSpeech = useCallback(() => {
    if (isBrowserSupported) {
      isCancelingRef.current = true;
      utteranceQueueRef.current = [];
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isBrowserSupported]);

  return { 
    isListening, 
    startListening, 
    stopListening, 
    isSpeaking, 
    speak,
    isApiReady,
    isBrowserSupported,
    getJarvisResponseStream,
    cancelSpeech,
  };
};
