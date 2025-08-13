import { useState, useRef, useCallback } from 'react';
import { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent, SpeechSynthesisErrorEvent, Message } from '../types';

// Polyfill for webkitSpeechRecognition
const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;

export const useJarvis = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultCallbackRef = useRef<(transcript: string) => void>((_) => {});
  const utteranceQueueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const isCancelingRef = useRef(false);

  const isBrowserSupported = !!SpeechRecognitionApi && !!window.speechSynthesis;
  
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }
  }, []);

  const startListening = useCallback((onResultCallback: (transcript: string) => void) => {
    if (isListening || isSpeaking || !isBrowserSupported) return;

    onResultCallbackRef.current = onResultCallback;
    const recognition = new SpeechRecognitionApi();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'pt-BR';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      onResultCallbackRef.current(transcript);
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [isListening, isSpeaking, isBrowserSupported]);


  const getJarvisResponseStream = useCallback(async function* (message: string, history: Message[]): AsyncGenerator<any> {
      const response = await fetch('/.netlify/functions/jarvis-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`A solicitação para a API falhou: ${errorText}`);
      }

      if (!response.body) {
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            try {
              yield JSON.parse(buffer);
            } catch (e) {
              console.error('Error parsing final JSON chunk:', e, 'Chunk:', buffer);
            }
          }
          break;
        }

        buffer += value;
        const lines = buffer.split('\n');
        
        // The last item might be an incomplete line, so we keep it in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              yield JSON.parse(line);
            } catch (e) {
              console.error('Error parsing JSON chunk:', e, 'Chunk:', line);
            }
          }
        }
      }
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

  const speak = useCallback((text: string) => {
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
      const errorEvent = e as SpeechSynthesisErrorEvent;
      if (errorEvent.error === 'interrupted' && isCancelingRef.current) {
        // This is an intentional cancellation, do not log an error.
        isCancelingRef.current = false;
      } else {
        console.error(`Speech synthesis error: ${errorEvent.error}`);
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
    isBrowserSupported,
    getJarvisResponseStream,
    cancelSpeech,
  };
};