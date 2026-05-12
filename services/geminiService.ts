
import { GoogleGenAI, Type, Modality, LiveServerMessage, FunctionDeclaration } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are the **VoxCADD Principal AI Architect (PA-24)**. You are a highly professional, high-speed, and precise architectural partner. 

### YOUR CORE PROTOCOL: "ACTION FIRST"
1. **Immediate Execution**: If the user requests a drawing (e.g., "draw a 500mm square", "2BHK plan"), you MUST generate the CAD commands IMMEDIATELY.
2. **CAD Command Mastery**: You communicate primarily through CAD commands. Every architectural idea should be accompanied by clear drafting code.
3. **Zero Friction**: Do not ask for confirmation or clarification for simple requests. Assume standard architectural defaults:
   - Interior Walls: 115mm thick.
   - Exterior Walls: 230mm thick.
   - Floor Height: 3000mm.
   - Origin: Start at 0,0 unless specified.
4. **Unit Conversion**: Automatically convert all units to mm (1 inch = 25.4mm, 1ft = 304.8mm).

### COMMAND SYNTAX (V-CORE 10)
- 'la [Layer]': Change layer (A-WALL, A-WALL-PART, A-DOOR, A-WINDOW, A-FURN, A-ANNO, A-DIM, A-TEXT).
- 'l x1,y1 x2,y2 x3,y3 ...': Draw a series of lines.
- 'rec x1,y1 x2,y2': Draw a rectangle from corner to corner.
- 'c x,y r': Draw a circle with center and radius.
- 'dl x1,y1 x2,y2 [thick]': Draw a double-line (wall segment). thick defaults to 230.
- 't x,y [text]': Place text at coordinates.
- 'mt x,y [text]': Place multi-line text.
- 'dim x1,y1 x2,y2': Add a linear dimension.
- 'h [pattern] [pts]': Apply a hatch (e.g., 'h ANSI31 0,0 100,0 100,100 0,100').

### RESPONSE FORMAT
You MUST respond using the following JSON structure:
{
  "explanation": "Brief professional architectural reasoning (1-2 sentences).",
  "commands": ["la A-WALL", "dl 0,0 5000,0 230", "dl 5000,0 5000,5000 230", "dl 5000,5000 0,5000 230", "dl 0,5000 0,0 230"]
}
`;

export interface AiResponse {
  text: string | null;
  commands: string[];
  groundingLinks?: { title: string; uri: string }[];
}

let genAI: GoogleGenAI | null = null;

const getGenAI = () => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
};

export const getCommandFromAI = async (prompt: string, contextSummary: string = "", sketchData?: string | null, history: {role: string, parts: any[]}[] = []): Promise<AiResponse> => {
  try {
    const ai = getGenAI();
    const modelName = 'gemini-1.5-pro'; // Robust architectural reasoning
    
    const contextPart = { text: `[ARCHITECTURAL CONTEXT]\n${contextSummary}\n\n[USER REQUEST]\n${prompt || "Produce architectural drafting."}` };
    
    const contents: any[] = history.slice(-6); // Further reduced history to save tokens
    const userParts: any[] = [contextPart];

    if (sketchData) {
      const base64Data = sketchData.includes(',') ? sketchData.split(',')[1] : sketchData;
      userParts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Data
        }
      });
    }
    
    contents.push({ role: 'user', parts: userParts });

    const response = await (async () => {
      let retries = 0;
      const maxRetries = 5;
      const baseDelay = 2000;
      
      while (true) {
        try {
          return await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              tools: [{ googleSearch: {} }],
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  explanation: {
                    type: Type.STRING,
                    description: "Brief architectural summary."
                  },
                  commands: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "CAD commands."
                  }
                },
                required: ["explanation", "commands"]
              },
              temperature: 0.1
            }
          });
        } catch (err: any) {
          const errMsg = err?.message || "";
          const isRateLimit = err?.status === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
          
          if (isRateLimit && retries < maxRetries) {
            retries++;
            const delay = baseDelay * Math.pow(2, retries) + Math.random() * 1000;
            console.warn(`Gemini Rate Limit (429). Retrying in ${Math.round(delay)}ms... (Attempt ${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw err;
        }
      }
    })();

    // Extract grounding metadata URLs
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const groundingLinks = chunks?.map((chunk: any) => {
      if (chunk.web) return { title: chunk.web.title, uri: chunk.web.uri };
      return null;
    }).filter((link: any): link is {title: string, uri: string} => link !== null);

    const text = response.text || "{}";
    const result = JSON.parse(text);
    
    return {
      text: result.explanation || "Drafting complete.",
      commands: Array.isArray(result.commands) ? result.commands : [],
      groundingLinks
    };
  } catch (error: any) {
    console.error("Principal Architect Engine Error:", error);
    return { text: `System Error: ${error.message}`, commands: [] };
  }
};

// --- Live API Helpers (Standard Implementation) ---

const LIVE_SYSTEM_INSTRUCTION = `
You are the **VoxCADD Principal AI Architect (PA-24)** in a LIVE drafting session.

### YOUR MISSION: "DRAFT OR DIE"
- NEVER JUST TALK. If a user asks a question about space or design, answer AND DRAW a visual representation using the 'executeCAD' tool.
- If the user says "Draw a square", call 'executeCAD' IMMEDIATELY.
- If the user says "Hello", greet them and ask what we are drafting today.
- ALWAYS TRIGGER THE 'executeCAD' TOOL FOR ANY DRAWING REQUEST. DO NOT SIMULATE THE OUTPUT IN TEXT.

### TOOL USAGE PROTOCOL:
1. Call 'executeCAD' with multi-line commands separated by '\\n'.
2. Example: To draw a 100x100 room:
   executeCAD({
     commands: "la A-WALL\\ndl 0,0 100,0 230\\ndl 100,0 100,100 230\\ndl 100,100 0,100 230\\ndl 0,100 0,0 230",
     reasoning: "Architectural primitive: drafting a 100mm internal chamber."
   })

### CRITICAL:
YOU MUST CALL THE TOOL 'executeCAD'. Outputting text alone is a violation of protocol.
`;

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const executeCADFunctionDeclaration: FunctionDeclaration = {
  name: 'executeCAD',
  parameters: {
    type: Type.OBJECT,
    description: 'Execute optimized architectural CAD commands.',
    properties: {
      commands: {
        type: Type.STRING,
        description: 'New-line separated CAD commands sequence.',
      },
      reasoning: {
          type: Type.STRING,
          description: 'Principal Architect\'s summary of the design.'
      }
    },
    required: ['commands'],
  },
};

export interface LiveSessionHandlers {
    onCommand: (commands: any) => void;
    onTranscript: (text: string, isUser: boolean) => void;
    onInterrupted: () => void;
}

export const connectLiveAgent = async (handlers: LiveSessionHandlers) => {
    const ai = getGenAI();
    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    const outputNode = outputAudioContext.createGain();
    outputNode.connect(outputAudioContext.destination);
    let nextStartTime = 0;
    const sources = new Set<AudioBufferSourceNode>();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const sessionPromise = ai.live.connect({
        model: 'models/gemini-2.0-flash-exp',
        callbacks: {
            onopen: () => {
                const source = inputAudioContext.createMediaStreamSource(stream);
                const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                scriptProcessor.onaudioprocess = (e) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const l = inputData.length;
                    const int16 = new Int16Array(l);
                    for (let i = 0; i < l; i++) {
                        int16[i] = inputData[i] * 32768;
                    }
                    const base64 = encode(new Uint8Array(int16.buffer));
                    sessionPromise.then(s => s.sendRealtimeInput({ 
                        audio: { 
                            data: base64, 
                            mimeType: 'audio/pcm;rate=16000' 
                        }
                    }));
                };
                source.connect(scriptProcessor);
                scriptProcessor.connect(inputAudioContext.destination);
            },
            onmessage: async (msg: LiveServerMessage) => {
                if (msg.serverContent?.inputTranscription) handlers.onTranscript(msg.serverContent.inputTranscription.text, true);
                if (msg.serverContent?.outputTranscription) handlers.onTranscript(msg.serverContent.outputTranscription.text, false);
                if (msg.toolCall) {
                    for (const fc of msg.toolCall.functionCalls) {
                        if (fc.name === 'executeCAD') {
                            handlers.onCommand(fc.args.commands as string);
                            sessionPromise.then(s => s.sendToolResponse({
                                functionResponses: [{ id: fc.id, name: fc.name, response: { result: "ok" } }]
                            }));
                        }
                    }
                }
                const base64 = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (base64) {
                    nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                    const buffer = await decodeAudioData(decode(base64), outputAudioContext, 24000, 1);
                    const source = outputAudioContext.createBufferSource();
                    source.buffer = buffer;
                    source.connect(outputNode);
                    source.addEventListener('ended', () => sources.delete(source));
                    source.start(nextStartTime);
                    nextStartTime += buffer.duration;
                    sources.add(source);
                }
                if (msg.serverContent?.interrupted) {
                    sources.forEach(s => s.stop());
                    sources.clear();
                    nextStartTime = 0;
                    handlers.onInterrupted();
                }
            },
            onerror: (e: ErrorEvent) => {
              console.error('Live Agent Error:', e);
            },
            onclose: (e: CloseEvent) => {
              console.debug('Live Agent Session Closed:', e);
            },
        },
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: LIVE_SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: [executeCADFunctionDeclaration] }],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        }
    });

    return sessionPromise;
};
