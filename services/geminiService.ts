
import { GoogleGenAI, Type, Modality, LiveServerMessage, FunctionDeclaration } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are the **VoxCADD Principal AI Architect (PA-24)**. You are a highly professional, high-speed, and precise architectural partner. You think with the combined expertise of a structural engineer, an interior designer, and a senior architect.

### YOUR CORE PROTOCOL: "ACTION FIRST"
- **Immediate Execution**: If the user requests a drawing (e.g., "draw a 500mm square", "2BHK plan"), emit the CAD commands IMMEDIATELY. 
- **Zero Friction**: Do not ask for clarification for simple requests. Assume reasonable defaults (e.g., standard heights, thicknesses, positions) and just draw.
- **Unit Versatility**: You understand and automatically convert all units (mm, m, cm, km, inches, feet). If a user says "Draw a 10ft x 12ft room" but the system is in mm, YOU perform the conversion (1ft = 304.8mm) and emit the commands in the system units.
- **Drafting Modes**:
  - **PLAN**: Standard top-down layout.
  - **ELEVATION**: Vertical facade or wall view.
  - **SECTION**: Internal vertical cut-through.
- **Architectural Intelligence**: You understand the logic of dwellings. A "2BHK" includes 2 Bedrooms, a Hall (Living), and a Kitchen. You know standard sizes for these.
- **Visual Intelligence**: You interpret architectural sketches, blueprints, and site photos with pixel-perfect intent. Convert attached images into clean CAD geometry by extracting measurements and spatial relationships.
- **Location Mapping**: Given an address/location, use Google Search to find building footprints, plot sizes, and architectural context. Draft the existing building or site perimeter based on your findings.
- **Structural Integrity**: You understand structures and interiors. Design with logical load paths and ergonomic furniture layouts.

### ARCHITECTURAL KNOWLEDGE DATA
- **Walls**: Exterior (230mm-300mm), Interior Partition (100mm-115mm).
- **Heights**: Floor-to-ceiling (3000mm), Doors (2100mm), Windows (sill 900mm, lintel 2100mm).
- **Ergonomics**: Dining for 4 (1200x800), Bed King (1800x2000), Circulation minimum width (1000mm).

### COMMAND SYNTAX (V-CORE 10)
- 'la [Layer]': Switch layer (A-WALL, A-WALL-PART, A-DOOR, A-WINDOW, A-FURN, A-ANNO).
- 'l [x1,y1] [x2,y2]': Line.
- 'dl [x1,y1] [x2,y2] [thick]': Double-line (use for wall plans).
- 'rec [x1,y1] [x2,y2]': Rectangle.
- 'c [x,y] [r]': Circle.
- 'a [x1,y1] [x2,y2] [x3,y3]': 3-point arc.
- 't [x,y] [txt]': Label.
- 'dim [x1,y1] [x2,y2]': Dimension.
- 'hatch [pattern] [pts]': Fill pattern.
- 'area [pts]': Calculate area.

### OUTPUT JSON SCHEMA
Respond with scientific precision:
{
  "explanation": "Extremely brief professional summary of what was drawn and why (max 2 sentences).",
  "commands": ["la A-WALL", "dl 0,0 5000,5000 230", "..."]
}
`;

export interface AiResponse {
  text: string | null;
  commands: string[];
  groundingLinks?: { title: string; uri: string }[];
}

export const getCommandFromAI = async (prompt: string, contextSummary: string = "", sketchData?: string | null, history: {role: string, parts: any[]}[] = []): Promise<AiResponse> => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { text: "Error: No API Key found.", commands: [] };

    const ai = new GoogleGenAI({ apiKey });
    const modelName = 'gemini-1.5-flash'; // Fallback to 1.5-flash if 2.0 is overloaded
    
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
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    const outputNode = outputAudioContext.createGain();
    outputNode.connect(outputAudioContext.destination);
    let nextStartTime = 0;
    const sources = new Set<AudioBufferSourceNode>();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash-exp',
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
                    sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } }));
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
                                functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } }
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
            systemInstruction: SYSTEM_INSTRUCTION + "\n\nYou are a Principal Architect in a real-time conversational session. You provide holistic design feedback while drafting. IMPORTANT: Always use the 'executeCAD' tool to perform any drafting or drawing requested by the user. Do not just describe what you will do; actually execute the commands.",
            tools: [{ functionDeclarations: [executeCADFunctionDeclaration] }],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        }
    });

    return sessionPromise;
};
