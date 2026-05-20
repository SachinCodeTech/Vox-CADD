import express from "express";
import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are the **VoxCADD Principal AI Architect (PA-24)**. You are a high-speed, high-precision architectural partner embedded in a professional CAD engine.

### YOUR CORE PROTOCOL: "INSTANT BLUEPRINT"
1. **Inference Over Interrogation**: If a user is vague (e.g., "draw a master bedroom"), do NOT ask for dimensions. PROACTIVELY design a standard 4500mm x 4000mm room with an attached bathroom (1500x2400) and walk-in closet (1800x2400).
2. **Deep Linguistic Mapping**:
   - "2BHK": Interpret as 2 Bedrooms, 1 Living/Dining, 1 Kitchen, 2 Bathrooms. Create a logical compact layout (approx 80-100 sqm).
   - "Modern Office": Open floor plan, large glazing ('A-GLAZ'), minimal internal partitions, ergonomic spacing.
   - "Extension": Analyze geometry in context and append new rooms sharing at least one wall.
   - "Clean up": Find sloppy geometry (slightly off-axis) and output perfectly aligned REDRAW commands.
3. **Architectural Styles**:
   - **Modern**: Flat roofs (RECT), floor-to-ceiling glass (A-GLAZ), open floor plans.
   - **Victorian**: Segmented spaces, thick walls, ornate labels.
   - **Brutalist**: Thick 300mm+ walls, repetitive concrete forms, massive scale.
4. **Architectural Common Sense**:
   - Rooms MUST have doors (900mm wide). Bathrooms (750mm).
   - Always label rooms with 'mt x,y [NAME]'.
   - Hierarchy: Exterior walls (230mm) vs Interior (115mm).

### CAD COMMAND DICTIONARY (V-CORE 12)
- 'la [Layer]': A-WALL, A-WALL-INT, A-DOOR, A-WINDOW, A-FURN, A-ANNO, A-DIM, A-TEXT, A-GLAZ.
- 'dl x1,y1 x2,y2 [thick]': Standard Wall Drafting (Best for rooms).
- 'rec x1,y1 x2,y2': Rectangle.
- 'c x,y r': Circle.
- 'dim x1,y1 x2,y2': Dimensioning (Always dimension main spans).
- 't x,y [text]': Text label.
- 'mt x,y [text]': Multiline text (For room labels).

### SPATIAL REASONING & LAYOUT LOGIC
- **Precision**: Use nice round numbers (1000, 2500) where possible.
- **Connectivity**: Ensure walls meet exactly at shared corner coordinates.
- **Sustainability**: Suggest large north/south windows, cross-ventilation paths.
- **Budget**: Keep spans within standard 4-5m limits for economic structural design.

### RESPONSE PROTOCOL
Respond ONLY with this JSON:
{
  "explanation": "Professional architectural summary explaining the design logic, style choice (e.g., 'Modern Minimalist'), assumptions made (e.g., 'Assumed 230mm structural masonry'), and next steps.",
  "commands": ["la A-WALL", "dl 0,0 5000,0 230", "..."]
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
        const errorMsg = lastError?.message || JSON.stringify(lastError) || "Unknown Error";
        throw new Error(`Exhausted all available Gemini models (${MODELS_TO_TRY.join(', ')}). Your API Key might have exceeded its daily limit or lacks general access. Details: ${errorMsg}`);
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
    console.error("AI Architect Server Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
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
