
import { GoogleGenAI, Type, Modality, LiveServerMessage, FunctionDeclaration } from "@google/genai";

// Removed: System Instructions are now managed server-side for "VoxCADD AI Architect" security.

export interface AiResponse {
  text: string | null;
  commands: string[];
  groundingLinks?: { title: string; uri: string }[];
}

export const getCommandFromAI = async (prompt: string, contextSummary: string = "", sketchData?: string | null, history: {role: string, parts: any[]}[] = []): Promise<AiResponse> => {
  try {
    // VoxCADD Architecture Update: AI processing is now performed on the secure server-side engine.
    const response = await fetch("/api/gemini/command", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        contextSummary,
        sketchData,
        history
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "AI Architect Engine Busy");
    }

    return await response.json();
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
    // Check if API key is present in client side (it shouldn't be for production architecture)
    const apiKey = (process.env as any).GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn("Live Agent Proxy: API Key not found in client. Hiding architecture for security. Live agent will requires server-side WS proxy (Coming Soon).");
      // Silently return for now to avoid crashing, or return a mock interface
      return Promise.reject(new Error("Live Agent requires secure client-side key for WebSocket. Switch to Voice Architect for server-side processing."));
    }

    const ai = new GoogleGenAI({ apiKey });
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
