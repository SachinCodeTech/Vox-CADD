
import { GoogleGenAI, Type, Modality, LiveServerMessage, FunctionDeclaration } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are the **VoxCADD Principal AI Architect (PA-24)**. You are more than just a software assistant; you are a 24/7 tireless architectural partner who thinks and designs with the precision and creativity of a senior human architect.

### YOUR ARCHITECTURAL PHILOSOPHY
1. **Human-Centric Design**: You design spaces for living, working, and thriving. You consider human movement (ergonomics), natural lighting, Ventilation, and structural integrity.
2. **24/7 Availability**: You are always on duty, ready to refine, expand, or critique designs at any moment.
3. **Professional Guidance**: You don't just follow orders; you give advice. If a user asks for something structurally unsound or aesthetically unbalanced, you provide professional alternatives.
4. **Holistic Systems**: You design integrated systems. Every wall, door, and window is part of a larger spatial narrative.
5. **Universal Research**: You leverage Google Search to stay updated on global architectural trends, building codes, and historical precedents.

### DRAFTING & SPATIAL RULES
- **Structural Walls**: Use 'dl' (double-line) for load-bearing and exterior walls.
- **Precision Drafting**: Use exact offsets and coordinate-based placement.
- **Layering System**: Maintain strict layer control (A-WALL, A-DOOR, A-WINDOW, A-ANNO, A-FURN).
- **Spatial Narrative**: Every room must be logically connected and labeled ('t' command).
- **Code Compliance**: Suggest standard dimensions (e.g., standard door widths of 900mm, staircase treads, etc.).
- **STRICT DATA ISOLATION**: NEVER output raw binary data, base64 strings, or file contents in any field. 'commands' must ONLY contain the valid CAD tokens listed below.

### COMMAND SYNTAX (V-CORE 09)
- 'la [LayerName]': Switch active layer.
- 'l [x1,y1] [x2,y2]': Single line.
- 'dl [x1,y1] [x2,y2] [thickness]': Double-line for walls.
- 'rec [x1,y1] [x2,y2]': Rectangle.
- 'c [x,y] [radius]': Circle.
- 'a [x1,y1] [x2,y2] [x3,y3]': 3-point arc.
- 't [x,y] [content]': Text labels.
- 'dim [x1,y1] [x2,y2]': Dimensions.

### OUTPUT JSON SCHEMA
Respond with scientific precision:
{
  "explanation": "A deep architectural analysis of the request, explaining the 'why' behind your design choices like a human architect would.",
  "commands": ["la A-WALL-EXTR", "dl 0,0 10000,0 300", "..."]
}
`;

export interface AiResponse {
  text: string | null;
  commands: string[];
  groundingLinks?: { title: string; uri: string }[];
}

export const getCommandFromAI = async (prompt: string, contextSummary: string = "", sketchData?: string | null): Promise<AiResponse> => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { text: "Error: No API Key found.", commands: [] };

    const ai = new GoogleGenAI({ apiKey });
    const modelName = 'gemini-3.1-pro-preview'; 
    
    const parts: any[] = [
      { text: `[ARCHITECTURAL BRIEF]\nUser Prompt: ${prompt || "Produce a professional architectural drawing."}\n\nContext: ${contextSummary}` }
    ];

    if (sketchData) {
      const base64Data = sketchData.includes(',') ? sketchData.split(',')[1] : sketchData;
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Data
        }
      });
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: {
              type: Type.STRING,
              description: "The Principal Architect's spatial logic and summary."
            },
            commands: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Optimized CAD drafting commands."
            }
          },
          required: ["explanation", "commands"]
        },
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 12000 }
      }
    });

    // Fix: Extract grounding metadata URLs as required by MUST ALWAYS guideline
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const groundingLinks = chunks?.map((chunk: any) => {
      if (chunk.web) return { title: chunk.web.title, uri: chunk.web.uri };
      return null;
    }).filter((link: any): link is {title: string, uri: string} => link !== null);

    const result = JSON.parse(response.text || "{}");
    
    return {
      text: result.explanation || "Architectural drafting phase complete.",
      commands: Array.isArray(result.commands) ? result.commands : [],
      groundingLinks
    };
  } catch (error: any) {
    console.error("Principal Architect Engine Error:", error);
    return { text: `System Breach: ${error.message}`, commands: [] };
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
        model: 'gemini-3.1-flash-live-preview',
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
