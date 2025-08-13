import { GoogleGenAI, Content, GenerateContentResponse } from "@google/genai";
import type { Handler, HandlerEvent } from "@netlify/functions";

// This file is a Netlify Function. It's a secure backend endpoint.
// It receives requests from your frontend, adds the secret API key,
// and proxies the request to the Google Gemini API.

if (!process.env.API_KEY) {
  throw new Error("A variável de ambiente API_KEY não está definida.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// The client sends messages in a simple format. This function converts them
// to the format the Gemini API expects.
const toGeminiHistory = (messages: {role: 'user' | 'model', text: string}[]): Content[] => {
  return messages.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }],
  }));
};

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { history, message } = JSON.parse(event.body || '{}');

    if (!message) {
      return { statusCode: 400, body: 'A mensagem não pode estar vazia.' };
    }

    const contents: Content[] = [...toGeminiHistory(history), { role: 'user', parts: [{ text: message }] }];

    const geminiStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents,
        config: {
            systemInstruction: "Você é Jarvis, um assistente de IA espirituoso, sofisticado e incrivelmente prestativo, inspirado no de Homem de Ferro. Responda em português brasileiro com uma mistura de profissionalismo, charme e um toque de humor seco. Mantenha suas respostas concisas e diretas, mas não tenha medo de ser um pouco brincalhão. Seu objetivo é ajudar o usuário de forma eficiente, mantendo sua personalidade única. Dirija-se ao usuário como 'Senhor'. Ao usar informações da internet, seja sucinto.",
            thinkingConfig: { thinkingBudget: 0 },
            tools: [{googleSearch: {}}],
        },
    });

    // `generateContentStream` returns an `AsyncGenerator`. We need to convert
    // this into a `ReadableStream` to send as the response body.
    const body = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of geminiStream) {
            // Each chunk is a `GenerateContentResponse` object.
            // We stringify it and add a newline to create a JSONL stream,
            // which is easy for the client to parse line-by-line.
            const jsonString = JSON.stringify(chunk);
            controller.enqueue(encoder.encode(jsonString + '\n'));
          }
        } catch (error) {
          console.error("Error while processing Gemini stream:", error);
          // Propagate the error to the stream reader on the client.
          controller.error(error);
        }
        // When the Gemini stream is finished, close our response stream.
        controller.close();
      },
    });

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/octet-stream",
        "Transfer-Encoding": "chunked",
       },
      body,
    };

  } catch (error) {
    console.error("Error in serverless function:", error);
    return {
      statusCode: 500,
      body: `Erro interno do servidor: ${error.message}`,
    };
  }
};

export { handler };
