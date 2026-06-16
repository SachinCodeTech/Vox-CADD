
import { GoogleGenAI, Type, Modality, LiveServerMessage, FunctionDeclaration } from "@google/genai";
import { parsePlotDimensions, designSpaceLayout, compilePlanToCADCommands } from "./architectEngine";

// Removed: System Instructions are now managed server-side for "VoxCADD AI Architect" security.

export interface AiResponse {
  text: string | null;
  commands: string[];
  groundingLinks?: { title: string; uri: string }[];
}

interface OfflineResult {
  explanation: string;
  commands: string[];
}

export const parsePromptOffline = (prompt: string): OfflineResult => {
  const p = prompt.toLowerCase();
  const numbers = prompt.match(/\d+/g)?.map(Number) || [];
  
  if (p.includes("house") || p.includes("floorplan") || p.includes("home") || p.includes("apartment") || p.includes("layout") || p.includes("office") || p.includes("workspace") || p.includes("cubicle")) {
    const plot = parsePlotDimensions(prompt);
    const plan = designSpaceLayout(prompt, plot.width, plot.height);
    const commands = compilePlanToCADCommands(plan);
    return {
      explanation: plan.validationReport,
      commands: commands
    };
  }

  if (p.includes("bedroom") || p.includes("room")) {
    const w = numbers[0] || 4000;
    const h = numbers[1] || 3500;
    return {
      explanation: `Drafted a custom ${w}x${h}mm Bedroom space with thick exterior bounds, primary door opening space, visual window, full-size bed block, and center room tag.`,
      commands: [
        "la A-WALL",
        `dl 230 0,0 ${w},0`,
        `dl 230 ${w},0 ${w},${h}`,
        `dl 230 ${w},${h} 0,${h}`,
        `dl 230 0,${h} 0,0`,
        "la A-DOOR",
        `rec 200,-50 900,50`,
        "la A-WINDOW",
        `rec ${w - 100},1000 ${w + 100},2000`,
        "la A-FURN",
        `rec 500,500 2300,2500`, // Double Bed
        "la A-TEXT",
        `mt ${Math.round(w / 2)},${Math.round(h / 2)} Master Bedroom`,
        "la A-DIM",
        `dim 0,-300 ${w},-300`
      ]
    };
  }

  if (p.includes("bathroom") || p.includes("toilet") || p.includes("bath") || p.includes("washroom")) {
    const w = numbers[0] || 2400;
    const h = numbers[1] || 1800;
    return {
      explanation: `Drafted a standard ${w}x${h}mm Bathroom layout containing exterior masonry bounds, internal floor sink block, circular wash basin, shower/wet area divider, and text annotations.`,
      commands: [
        "la A-WALL",
        `dl 230 0,0 ${w},0`,
        `dl 230 ${w},0 ${w},${h}`,
        `dl 230 ${w},${h} 0,${h}`,
        `dl 230 0,${h} 0,0`,
        "la A-FURN",
        `rec 100,100 700,700`, // Shower
        `c ${w - 400},400 200`, // Basin
        `rec ${w - 800},${h - 600} ${w - 200},${h - 100}`, // WC
        "la A-TEXT",
        `mt ${Math.round(w / 2)},${Math.round(h / 2)} Bathroom`,
        "la A-DIM",
        `dim 0,-300 ${w},-300`
      ]
    };
  }

  if (p.includes("kitchen")) {
    const w = numbers[0] || 3600;
    const h = numbers[1] || 2700;
    return {
      explanation: `Drafted an offline functional Kitchen layout layout. Included custom perimeter granite counter top bounds, nested sink square, circular burner blocks, wall annotations, and dimensions.`,
      commands: [
        "la A-WALL",
        `dl 230 0,0 ${w},0`,
        `dl 230 ${w},0 ${w},${h}`,
        `dl 230 ${w},${h} 0,${h}`,
        `dl 230 0,${h} 0,0`,
        "la A-FURN",
        `rec 0,0 600,${h}`, // Left counter
        `rec 600,${h - 600} ${w},${h}`, // Top counter
        `rec 100,100 500,600`, // Sink
        `c ${w - 600},${h - 300} 150`, // Burner 1
        `c ${w - 1000},${h - 300} 150`, // Burner 2
        "la A-TEXT",
        `mt ${Math.round(w / 2)},${Math.round(h / 2)} Kitchen`,
        "la A-DIM",
        `dim 0,-300 ${w},-300`
      ]
    };
  }

  if (p.includes("bed") || p.includes("mattress")) {
    return {
      explanation: "Drafted an offline structural Double Bed furniture assembly containing bed frame border, safety spacing, dual pillows block, and title labels.",
      commands: [
        "la A-FURN",
        "rec 0,0 1800,2000",
        "rec 150,1500 750,1850",
        "rec 1050,1500 1650,1850",
        "la A-TEXT",
        "mt 900,1000 Double Bed"
      ]
    };
  }

  if (p.includes("desk") || p.includes("table")) {
    return {
      explanation: "Drafted an offline rectangular Office Desk complete with workspace boundaries, ergonomic office chair block, and labels.",
      commands: [
        "la A-FURN",
        "rec 0,0 1500,800",
        "rec 450,-400 1050,-100", // Chair
        "la A-TEXT",
        "mt 750,400 Work Desk"
      ]
    };
  }

  if (p.includes("chair") || p.includes("seat") || p.includes("sofa")) {
    return {
      explanation: "Drafted an offline detailed Lounge Chair / Single Sofa symbol workspace layout.",
      commands: [
        "la A-FURN",
        "rec 0,0 700,700",
        "l 0,550 700,550", // Backrest
        "l 100,0 100,550", // Armrest left
        "l 600,0 600,550", // Armrest right
        "la A-TEXT",
        "mt 350,250 Seat"
      ]
    };
  }

  if (p.includes("circle") || p.includes("wheel") || p.includes("round") || p.includes("c ")) {
    const r = numbers[0] || 1000;
    return {
      explanation: `Drafted a perfect geographic circular boundary. Radius: ${r}mm centered at coordinate grid 0,0.`,
      commands: [
        "la 0",
        `c 0,0 ${r}`
      ]
    };
  }

  if (p.includes("rect") || p.includes("rectangle") || p.includes("square") || p.includes("box") || p.includes("rec ")) {
    const w = numbers[0] || 2000;
    const h = numbers[1] || w || 2000;
    return {
      explanation: `Drafted a local 2D Rectangular box. Dimensions: ${w}mm x ${h}mm starting at coordinate grid 0,0.`,
      commands: [
        "la 0",
        `rec 0,0 ${w},${h}`
      ]
    };
  }

  if (p.includes("line") || p.includes("wall") || p.includes("dl ") || p.includes("l ")) {
    const length = numbers[0] || 3000;
    return {
      explanation: `Drafted a linear vector segment layer starting at 0,0 with length ${length}mm along the X-axis.`,
      commands: [
        "la 0",
        `dl 230 0,0 ${length},0`
      ]
    };
  }

  // General fallback - create a nice decorative room layout with any numbers found
  const val1 = numbers[0] || 5000;
  const val2 = numbers[1] || val1 || 4000;
  return {
    explanation: `Heuristically constructed custom workspace bounds for "${prompt}". Included primary walls, door, center label annotation, and linear dimension tagging.`,
    commands: [
      "la A-WALL",
      `dl 230 0,0 ${val1},0`,
      `dl 230 ${val1},0 ${val1},${val2}`,
      `dl 230 ${val1},${val2} 0,${val2}`,
      `dl 230 0,${val2} 0,0`,
      "la A-DOOR",
      `rec 300,-50 1000,50`,
      "la A-TEXT",
      `mt ${Math.round(val1 / 2)},${Math.round(val2 / 2)} ${prompt}`,
      "la A-DIM",
      `dim 0,-300 ${val1},-300`,
      `dim -300,0 -300,${val2}`
    ]
  };
};

export const getCommandFromAI = async (
  prompt: string, 
  contextSummary: string = "", 
  sketchData?: string | null, 
  history: {role: string, parts: any[]}[] = [],
  drawingType?: string,
  standards?: string
): Promise<AiResponse> => {
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
        history,
        drawingType,
        standards
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "AI Architect Engine Busy");
    }

    return await response.json();
  } catch (error: any) {
    console.warn("VoxCADD: Using local heuristic CAD engine fallback.");
    
    // Fallback to local high-fidelity procedurial drafting simulator when quota is exhausted
    const offlineResult = parsePromptOffline(prompt);
    return {
      text: `⚠️ **AI Quota Exhausted**: The server-side Gemini Architect models are currently rate-limited (429) or offline.\n\nTo ensure a seamless environment, I have automatically activated the **VoxCADD Local Heuristic CAD Engine** to fulfill your request offline!\n\n**Drafting Summary:**\n${offlineResult.explanation}`,
      commands: offlineResult.commands,
      groundingLinks: []
    };
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
     commands: "la A-WALL\\ndl 230 0,0 100,0\\ndl 230 100,0 100,100\\ndl 230 100,100 0,100\\ndl 230 0,100 0,0",
     reasoning: "Architectural primitive: drafting a 100mm internal chamber with 230mm walls."
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
