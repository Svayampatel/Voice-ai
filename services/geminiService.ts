import { GoogleGenAI, Modality, FunctionDeclaration, Type } from "@google/genai";

// Ensure API key is present
if (!process.env.API_KEY) {
  console.error("Missing API_KEY in environment variables");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// --- MOCK BACKEND DATA & FUNCTIONS ---

const MOCK_DATABASE = {
  orders: {
    "ORD-123": { status: "Shipped", delivery_date: "2023-10-25" },
    "ORD-456": { status: "Processing", delivery_date: "TBD" },
    "ORD-789": { status: "Delivered", delivery_date: "2023-10-20" }
  },
  accounts: {
    "user_main": { balance: 1250.50, currency: "USD", plan: "Premium" }
  }
};

const getOrderStatusTool: FunctionDeclaration = {
  name: "getOrderStatus",
  description: "Get the status and delivery date of a customer order.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      orderId: {
        type: Type.STRING,
        description: "The order ID (e.g., ORD-123)",
      },
    },
    required: ["orderId"],
  },
};

const getAccountBalanceTool: FunctionDeclaration = {
  name: "getAccountBalance",
  description: "Get the current account balance and plan details.",
  parameters: {
    type: Type.OBJECT,
    properties: {}, // No params needed for this mock, assumes auth user
  },
};

// --- SERVICE FUNCTIONS ---

/**
 * Transcribe audio using gemini-2.5-flash
 */
export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio,
            },
          },
          {
            text: "Transcribe this audio exactly. Return only the text, no other commentary. If the audio is silent or unclear, return '...'",
          },
        ],
      },
    });

    const text = response.text;
    if (!text) {
       // Sometimes the model might return empty if audio is completely silent
       return ""; 
    }
    return text;
  } catch (error: any) {
    console.error("Transcription error:", error);
    if (error.toString().includes('400')) {
        throw new Error("Audio format not supported or file too short.");
    }
    throw new Error("Failed to process audio. Please try again.");
  }
};

/**
 * Generate Speech using gemini-2.5-flash-preview-tts
 */
export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<Uint8Array | null> => {
  try {
    if (!text.trim()) return null;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("Gemini returned no audio data.");
    }

    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;

  } catch (error) {
    console.error("TTS error:", error);
    throw new Error("Speech generation failed. Service might be busy.");
  }
};

/**
 * Core Bot Logic: Handles NLU, Function Calling, and Response Generation
 */
let chatSession: any = null;

export const getBotResponse = async (userText: string): Promise<{ text: string, toolUsed: boolean }> => {
  if (!chatSession) {
    chatSession = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: "You are 'Sonic', a helpful customer service voice bot. You are concise, friendly, and professional. Keep responses brief as they will be spoken aloud. You have access to tools to check order statuses and account balances.",
        tools: [{ functionDeclarations: [getOrderStatusTool, getAccountBalanceTool] }]
      }
    });
  }

  try {
    let result = await chatSession.sendMessage({ message: userText });
    let toolUsed = false;

    // Handle Function Calling Loop
    const calls = result.functionCalls;
    
    if (calls && calls.length > 0) {
      toolUsed = true;
      const parts = [];
      
      for (const call of calls) {
        const { name, args } = call;
        let apiResult;

        if (name === 'getOrderStatus') {
          const id = args.orderId as string;
          // @ts-ignore
          const order = MOCK_DATABASE.orders[id];
          apiResult = order ? order : { status: "Order not found." };
        } else if (name === 'getAccountBalance') {
          apiResult = MOCK_DATABASE.accounts["user_main"];
        } else {
            apiResult = { error: "Function not found" };
        }

        // Correctly structure the Part for the Function Response
        parts.push({
          functionResponse: {
            id: call.id,
            name: call.name,
            response: { result: apiResult }
          }
        });
      }

      // Send tool output back to model to get final natural language response
      result = await chatSession.sendMessage(parts);
    }

    // If the model returns empty text (e.g. if it crashed internally or filtered content), fallback
    const responseText = result.text;
    if (!responseText) {
        return { text: "I'm sorry, I didn't quite get that. Could you rephrase?", toolUsed: false };
    }

    return {
      text: responseText,
      toolUsed
    };

  } catch (error) {
    console.error("Bot logic error:", error);
    // Return a safe fallback instead of throwing, to keep the conversation flow alive
    return { text: "I'm having a bit of trouble connecting to my systems right now. Please try again in a moment.", toolUsed: false };
  }
};

export const resetChat = () => {
    chatSession = null;
}