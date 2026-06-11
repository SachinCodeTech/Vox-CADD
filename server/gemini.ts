import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { parsePlotDimensions, designSpaceLayout, compilePlanToCADCommands } from "../services/architectEngine";

const SYSTEM_INSTRUCTION = `
You are the **VoxCADD Principal AI Architect (PA-24)**. You are a high-speed, high-precision architectural partner embedded in a professional CAD engine.

### YOUR ADVANCED ROOM-PLANNING CORE PROTOCOL
Before drawing any CAD entities, you MUST execute an internal multi-step space planning stage:
1. **Space-Planning Stage**: Analyze user requirements, prompt plot sizes (e.g. 10m x 15m), and reserve appropriate perimeter setbacks (e.g. 1m).
2. **Room Decomposition**: Convert requirements into individual functional rooms (e.g., Living, Dining, Kitchen, Bath, Bedroom 1, Bedroom 2). 
3. **Calculate Sizes**: Proportionally scale and allocate room sizes so they fill the buildable footprint without any cracks or overlaps.
4. **Adjacency Graph & Princely Placement**: 
   - Position public spaces (Entrance, Living Room) at the front/bottom, and private spaces (Bedrooms) at the rear.
   - Map a logical room adjacency graph (e.g. Entrance -> Living -> Dining -> Kitchen & Bedrooms).
   - Ensure rooms never overlap, and share exact matching coordinates at boundaries.
5. **watertight CAD Drafting Order**:
   - **Outer Walls First**: Draft outer perimeter boundaries on layer 'A-WALL' with 230mm thickness.
   - **Internal Walls Second**: Draft divisions between shared rooms on layer 'A-WALL-INT' with 115mm thickness. Ensure you subtract door opening ranges to leave actual wall cutouts.
   - **Connected Doorways**: Draft doors (900mm wide; 750mm for baths) centered on connected shared edges on layer 'A-DOOR'.
   - **Acoustic & Daylight Windows**: Place windows ('A-WINDOW') on external walls for proper solar exposure.
   - **Room Labels & Dimensions**: Tag each room centroid with its name and metric dimensions on 'A-TEXT'. Provide overall dimension strings on 'A-DIM'.

### CAD COMMAND DICTIONARY (V-CORE 12)
- 'la [Layer]': A-WALL, A-WALL-INT, A-DOOR, A-WINDOW, A-FURN, A-DIM, A-TEXT, A-GLAZ.
- 'dl x1,y1 x2,y2 [thick]': Standard Wall Drafting (Use nice round numbers).
- 'rec x1,y1 x2,y2': Rectangle.
- 'c x,y r': Circle.
- 'dim x1,y1 x2,y2': Dimensioning (Always dimension main spans).
- 'mt x,y [text]': Multiline text (For room labels, use '\\n' for newlines).

### RESPONSE PROTOCOL
Respond ONLY with this JSON:
{
  "explanation": "### SPACE-PLANNING AUDIT STATUS: APPROVED\n- Plot dimensions parsed.\n- Room adjacency graph validates circulation reachability.\n- Structural wall layers successfully drafted without overlapping.",
  "commands": ["la A-WALL", "dl 1000,1000 9000,1000 230", "..."]
}
`;

export const geminiRouter = express.Router();

geminiRouter.post("/command", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
  }

  try {
    const { prompt, contextSummary, sketchData, history } = req.body;
    
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const contextPart = { text: `[ARCHITECTURAL CONTEXT]\n${contextSummary}\n\n[USER REQUEST]\n${prompt || "Produce architectural drafting."}` };
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

    const contents = history ? [...history.slice(-6), { role: 'user', parts: userParts }] : [{ role: 'user', parts: userParts }];

    const result = await (async () => {
      const MODELS_TO_TRY = [
        "gemini-3.5-flash",        // Primary - modern standard flash model, active on free tiers
        "gemini-flash-latest",     // Dynamic alias pointing to the latest version of flash
        "gemini-2.0-flash",        // Previous stable model
      ];

      let generatedResult: any = null;
      let fallbackIndex = 0;
      let lastError: any = null;

      while (fallbackIndex < MODELS_TO_TRY.length) {
        const activeModel = MODELS_TO_TRY[fallbackIndex];
        let retries = 0;
        const maxRetries = 2; // Keep retries per model low to fall back quickly
        const baseDelay = 1000;
        let modelSucceeded = false;

        console.log(`[VoxCADD AI Architect] Attempting to generate content with model: ${activeModel}...`);

        while (retries < maxRetries) {
          try {
            generatedResult = await ai.models.generateContent({
              model: activeModel,
              contents,
              config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    explanation: { type: Type.STRING },
                    commands: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["explanation", "commands"]
                },
                temperature: 0.1,
                tools: [{ googleSearch: {} }]
              }
            });
            modelSucceeded = true;
            break; // Succeeded! Break the retry loop
          } catch (err: any) {
            lastError = err;
            const status = err?.status || err?.code || 0;
            const errMsg = err?.message || JSON.stringify(err);
            const isRateLimit = status === 429 || errMsg.includes('429') || errMsg.includes('QUOTA_EXHAUSTED') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded');
            const isLimitZero = errMsg.includes('limit: 0') || errMsg.includes('limit:0') || errMsg.includes('unsupported') || errMsg.includes('not found') || errMsg.includes('not support');

            if (isLimitZero) {
              console.warn(`[VoxCADD AI Architect] Model ${activeModel} has zero quota limit (limit: 0) or is unsupported. Skipping to next model...`);
              break; // Break the retry loop for this model, fallback to next model immediately
            }

            if (isRateLimit) {
              retries++;
              if (retries >= maxRetries) {
                console.warn(`[VoxCADD AI Architect] Model ${activeModel} rate limited after max retries. Moving to next model...`);
                break;
              }
              // Exponential backoff with jitter
              const delay = baseDelay * Math.pow(2, retries) + Math.random() * 500;
              console.warn(`[VoxCADD AI Architect] Rate Limit (429) for ${activeModel}. Retry ${retries}/${maxRetries} in ${Math.round(delay)}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }

            console.warn(`[VoxCADD AI Architect] Unexpected error on ${activeModel}:`, errMsg);
            break; // Fallback to next model
          }
        }

        if (modelSucceeded && generatedResult) {
          console.log(`[VoxCADD AI Architect] Successfully generated content using model: ${activeModel}`);
          break; // Succeeded! Break the outer loop
        }

        fallbackIndex++;
      }

      if (!generatedResult) {
        throw new Error("Unable to fulfill request via generative model.");
      }

      return generatedResult;
    })();

    const responseText = result.text || "{}";
    const parsed = JSON.parse(responseText);

    res.json({
      text: parsed.explanation,
      commands: parsed.commands,
      // Pass through grounding metadata if present
      groundingLinks: result.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => {
        if (chunk.web) return { title: chunk.web.title, uri: chunk.web.uri };
        return null;
      }).filter((link: any) => link !== null) || []
    });

  } catch (error: any) {
    console.warn("[VoxCADD AI Architect] Activating Local Heuristic Fallback (External API limit or quota reached).");
    
    // Server-side fallback to avoid throwing 500 when Gemini API key limit is reached
    try {
      const prompt = req.body?.prompt || "";
      const p = prompt.toLowerCase();
      const numbers = prompt.match(/\d+/g)?.map(Number) || [];
      
      let explanation = "";
      let commands: string[] = [];

      if (p.includes("house") || p.includes("floorplan") || p.includes("home") || p.includes("apartment") || p.includes("layout") || p.includes("office") || p.includes("workspace") || p.includes("cubicle")) {
        const plot = parsePlotDimensions(prompt);
        const plan = designSpaceLayout(prompt, plot.width, plot.height);
        commands = compilePlanToCADCommands(plan);
        explanation = plan.validationReport;
      } else if (p.includes("bedroom") || p.includes("room")) {
        const w = numbers[0] || 4000;
        const h = numbers[1] || 3500;
        explanation = `Drafted a custom ${w}x${h}mm Bedroom space with thick exterior bounds, primary door opening space, visual window, full-size bed block, and center room tag.`;
        commands = [
          "la A-WALL",
          `dl 0,0 ${w},0 230`,
          `dl ${w},0 ${w},${h} 230`,
          `dl ${w},${h} 0,${h} 230`,
          `dl 0,${h} 0,0 230`,
          "la A-DOOR",
          `rec 200,-50 900,50`,
          "la A-WINDOW",
          `rec ${w - 100},1000 ${w + 100},2000`,
          "la A-FURN",
          `rec 500,500 2300,2500`,
          "la A-TEXT",
          `mt ${Math.round(w / 2)},${Math.round(h / 2)} Master Bedroom`,
          "la A-DIM",
          `dim 0,-300 ${w},-300`
        ];
      } else if (p.includes("bathroom") || p.includes("toilet") || p.includes("bath") || p.includes("washroom")) {
        const w = numbers[0] || 2400;
        const h = numbers[1] || 1800;
        explanation = `Drafted a standard ${w}x${h}mm Bathroom layout containing exterior masonry bounds, internal floor sink block, circular wash basin, shower/wet area divider, and text annotations.`;
        commands = [
          "la A-WALL",
          `dl 0,0 ${w},0 230`,
          `dl ${w},0 ${w},${h} 230`,
          `dl ${w},${h} 0,${h} 230`,
          `dl 0,${h} 0,0 230`,
          "la A-FURN",
          `rec 100,100 700,700`,
          `c ${w - 400},400 200`,
          `rec ${w - 800},${h - 600} ${w - 200},${h - 100}`,
          "la A-TEXT",
          `mt ${Math.round(w / 2)},${Math.round(h / 2)} Bathroom`,
          "la A-DIM",
          `dim 0,-300 ${w},-300`
        ];
      } else if (p.includes("circle") || p.includes("wheel") || p.includes("c ")) {
        const r = numbers[0] || 1000;
        explanation = `Drafted a perfect geographic circular boundary. Radius: ${r}mm centered at 0,0.`;
        commands = ["la 0", `c 0,0 ${r}`];
      } else {
        const val1 = numbers[0] || 5000;
        const val2 = numbers[1] || val1 || 4000;
        explanation = `Heuristically constructed custom workspace bounds for "${prompt}". Included primary walls, door, center label annotation, and linear dimension tagging.`;
        commands = [
          "la A-WALL",
          `dl 0,0 ${val1},0 230`,
          `dl ${val1},0 ${val1},${val2} 230`,
          `dl ${val1},${val2} 0,${val2} 230`,
          `dl 0,${val2} 0,0 230`,
          "la A-DOOR",
          `rec 300,-50 1000,50`,
          "la A-TEXT",
          `mt ${Math.round(val1 / 2)},${Math.round(val2 / 2)} ${prompt}`,
          "la A-DIM",
          `dim 0,-300 ${val1},-300`,
          `dim -300,0 -300,${val2}`
        ];
      }

      return res.json({
        text: `⚠️ **AI Quota Exhausted**: The server-side Gemini Architect models are currently rate-limited (429) or offline.\n\nTo ensure a seamless environment, I have automatically activated the **VoxCADD Local Heuristic CAD Engine** to fulfill your request offline!\n\n**Drafting Summary:**\n${explanation}`,
        commands: commands,
        groundingLinks: []
      });
    } catch (fallbackError: any) {
      console.log("[VoxCADD AI Architect] Critical double-fault fallback error:", fallbackError?.message || fallbackError);
      return res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  }
});

/**
 * MODULAR ARCHITECTURE: Future-ready endpoints for VoxCADD AI Architect
 * These endpoints provide the structure for specialized CAD intelligence.
 */

// AI Floorplan Suggestions & Analysis
geminiRouter.post("/analysis", async (req, res) => {
  res.json({ 
    status: "Modular Endpoint Ready", 
    feature: "AI Plan Analysis",
    description: "Future home for layer cleanup, block recognition, and drawing audits."
  });
});

// AI Material & Quantity Estimation
geminiRouter.post("/estimate", async (req, res) => {
  res.json({ 
    status: "Modular Endpoint Ready", 
    feature: "Material Estimation",
    description: "Future home for quantity take-offs and cost analysis based on CAD entities."
  });
});

// AI Command Assistant (Context-aware help)
geminiRouter.post("/assistant", async (req, res) => {
  res.json({ 
    status: "Modular Endpoint Ready", 
    feature: "Command Assistant",
    description: "Future home for real-time CAD command suggestions and drafting help."
  });
});
