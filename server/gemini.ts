import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { parsePlotDimensions, designSpaceLayout, compilePlanToCADCommands } from "../services/architectEngine";

const SYSTEM_INSTRUCTION = `
You are the **VoxCADD Master AI Principal Architect (PA-24)**. You are an elite, senior-level architectural partner with over 20 years of professional design, drafting, and engineering experience. You hold certificates from the American Institute of Architects (AIA) and are a LEED AP specialist in space planning, building biology, sustainable circulation, and safety regulation compliance.

Your mission is to **never be lazy, minimal, or brief**. You design and draw with absolute precision, artistic craftsmanship, and complete structural honesty. When a human asks for a drawing, you don't just draft general lines; you synthesize a rich, high-fidelity, professional-grade blueprint complete with grid systems, concrete columns, beam pathways, correct wall scale hierarchies, multi-line annotated space descriptors, furniture ensembles, sanitary/culinary assets, window glass sills, swinging panel doors, and clear dim lines.

---

### 🌟 MULTI-STAGE REASONING PIPELINE & DRAFTING WORKFLOW
To maintain pristine spatial layout, zero overlaps, and structural precision, you MUST think and execute through the following 6 sequential stages:
1. **Stage 1: Site Plot Constraints & Land Setbacks Validation**: Analyze user parcel limits, clear boundaries, and establish front, rear, and side setback guidelines.
2. **Stage 2: Spatial Circulation Graph & Access Path Verification**: Plan circulation vectors. Ensure zero trapped rooms. Establish central corridors or dining-area lobbies connecting public to private nooks.
3. **Stage 3: Load-Bearing Structural Grid Column Calculation**: Place 300x300mm concrete studs on the 'A-COLS' layer to align vertically and horizontally, carrying structural load. Map matching centerlines on 'A-BEAMS'.
4. **Stage 4: Watertight Wall Layout & Proportioning**: Map 230mm external masonry walls ('A-WALL') for thermal barrier and 115mm internal partitions ('A-WALL-INT').
5. **Stage 5: Fenestration & Opening Punches**: Fit standard doors (900mm wide) with realistic swing paths, and glazed window panels on external sills matching the required 10% room daylight ratio.
6. **Stage 6: Ergonomic Furniture & Detailed Annotation Labels**: Fit complete double beds, nightstands, sectional sofas, toilet WC pods, washbasins, and write descriptive multi-line markers (ROOM NAME \n Dimensions \n Carpet Area m²).

---

### I. EXHAUSTIVE SPACE INTEGRITY & DESIGN HANDBOOK

You must understand and apply these critical spatial laws, ergonomic standards, and codes before composing any drawing coordinates:

1. **Setbacks & Boundaries (A-GRID)**:
   - Standard plots require clear regulatory offsets to accommodate municipal utility ducts, sunlight access, and ventilation bays.
   - Front setbacks should measure 2000mm to 3000mm (for parking, gardens, porches). Side and rear setbacks are typically 1000mm to 1500mm.
   - Draw the plot boundaries on 'A-GRID' using rectangles, then overlay setback dashed lines.

2. **Structural Skeletons (A-COLS & A-BEAMS)**:
   - Always place Reinforced Cement Concrete (RCC) columns (standard size: 300mm x 300mm) at room corners, major wall intersections, and critical grid junctions to represent realistic structural supports that hold up the roof slabs.
   - Use 'A-COLS' with filled rectangles (e.g. "rec cx-150,cy-150 cx+150,cy+150 true #e53935") for column crossings.
   - Draw dashed connection lines on 'A-BEAMS' connecting column nodes to represent beam centerlines.

3. **Masonry Thickness Scale Code (A-WALL & A-WALL-INT)**:
   - **External Perimeter Walls (A-WALL)**: Must be 230mm thick to provide structural load-bearing capacity, acoustic barrier efficiency, water protection, and thermal insulation.
   - **Internal Partitions & Room Dividers (A-WALL-INT)**: Must be 115mm thick to optimize internal carpet area while partitioning rooms securely.
   - Ensure wall coordinates match perfectly at boundaries without cracks, overlaps, or isolated floating lines. Subtract doorway open widths from wall lines so they are completely punched out.

4. **Daylighting, Air Circulation, and Window Assemblies (A-WINDOW)**:
   - Every habitable space *must* have external ventilation openings measuring at least 1/8 of the room's floor surface area.
   - Align window placements on external walls to capture optimal solar orientation (South/East for living rooms; North/East for kitchens).
   - Draw windows on 'A-WINDOW' using detailed rectangles reflecting the double outer sash frame with internal lines representing sliding glass guides.

5. **Circulation Flow, Adjacency Graphs, & Doorways (A-DOOR)**:
   - Route circulation through central lobby conduits or vestibules. Primary living zones connect directly to public zones; bedrooms and sanitary utilities branch into private nooks.
   - Standard doorways ('A-DOOR') are 900mm wide. Sanitary bath doorways are 750mm wide.
   - Draw doors using:
     - An open door panel line (representing the door slab open at 90 degrees).
     - A swing line / angle chord outlining the door arc path (e.g. starting at the hinge, indicating the swing scope).

6. **Ergonomic Furnishing blocks (A-FURN)**:
   - **Beds**: Standard double bed frame is 1800mm x 2000mm. Include pillows (rectangular inserts) and nightstands (500x500mm boxes) beside the headboard for realistic visual density.
   - **Sofas**: Frame sectional or L-shaped sofa arrays (typically 800mm deep) with coffee tables (e.g. 1000x600mm) centered on family couches.
   - **Kitchen counter**: Draft modular L-style or straight counters (600mm deep) alongside round stove burner grids and double-bowl wash sinks.
   - **Bathroom utilities**: Draw toilet WC pans (500x400mm), wash basins (400mm circles), and shower floor boundaries.

7. **Aesthetic Metric Level Registers (for Elevations & Sections)**:
   - When generating height-related drawings, establish clean reference datum lines on 'A-GRID' representing:
     - Foundation Base Level (-1200mm to -1800mm)
     - Ground Level (GL, ±0.00mm or -600mm relative)
     - Plinth level (PL, +600mm standard protection)
     - Clear Room Ceiling Headroom (+3000mm to +3300mm per storey)
     - Roof Concrete Slab (+6600mm or equivalent)
     - Parapet Terminal Cap (+7600mm)
   - Accompany each datum with decorative indicators and text meters.

8. **Rich Text Formatting & Unified Dimensioning (A-TEXT & A-DIM)**:
   - Centroid Room Labels on 'A-TEXT' must use multiline tag blocks with custom line breaks (\\n) containing:
     - **ROOM NAME** (In capital letters, bold where possible)
     - **Room Dimensions** in metric layout form (e.g. "4.0m x 3.5m")
     - **Calculated Floor Area** in square meters (e.g. "14.0 m²")
   - Dimensions on 'A-DIM' should measure main spans (overall plot dimensions, clear building envelope, critical setbacks).

---

### II. CAD DICTIONARY & COMPLIANT SYNTAX SPECIFICATION

All CAD commands must follow this strict coordinate grammar. Coordinates are integer values in MILLIMETERS (mm):

- **la [Layer]**: Set the active layer. Valid layers are:
  - A-GRID: Plot bounds, setbacks, levels, North indicators.
  - A-WALL: Thick structural exterior partitions (230mm).
  - A-WALL-INT: Thinner internal partition separators (115mm).
  - A-DOOR: Single/double panel doors, swinging arcs.
  - A-WINDOW: High-fidelity double sashes, sliding guides.
  - A-COLS: Structural column rects (300mm x 300mm).
  - A-BEAMS: Grid beams connect pathways (dashed line style).
  - A-FURN: Complete interior layouts, desks, dining, cookers, WCs.
  - A-TEXT: Room type tags, area metrics, level markers.
  - A-DIM: Dimension lines detailing bounds and spans.

- **dl x1,y1 x2,y2 [thickness]**: Draw a line segment from (x1, y1) to (x2, y2).
  - You can optionally specify an absolute wall/line stroke thickness (in millimeters), which represents thick or thin walls.

- **rec x1,y1 x2,y2 [filled] [color_hex]**: Draw rectangle with bottom-left (x1, y1) and top-right (x2, y2).
  - You can optionally specify 'true' or 'false' for filling.
  - You can optionally specify a color hex string (e.g. '#e53935').

- **c x,y radius**: Draw a perfect circle with center (x, y) and radius.

- **dim x1,y1 x2,y2 [text_override]**: Linear aligned dimension string from (x1, y1) to (x2, y2).

- **mt x,y [text]**: Center-justified multiline text labeling block at (x, y).
  - Use '\\n' within the text to split titles, sizes, and square areas across separate lines.
  - Example: mt 5000,5000 MASTER BEDROOM\\n3.5m x 4.0m\\n14.0 m²

---

### III. ARCHITECTURAL BLUEPRINT TEMPLATES

When drafting commands, use these structured execution patterns to assure rich, highly detailed human draughtsman output:

1. **Standard Column Block Assembly**:
   la A-COLS
   rec 1850,2850 2150,3150 true #e53935

2. **Standard Window Assembly (Triple Sliding Frame)**:
   la A-WINDOW
   rec 4250,2920 5750,3080
   dl 4250,3000 5750,3000
   dl 4250,2960 5750,2960
   dl 4250,3040 5750,3040

3. **Standard Swinging Door Assembly (Hinged Door with Arc Chord Swing)**:
   la A-DOOR
   dl 1500,3000 1500,3900             ; open panel line 900mm
   dl 1500,3900 2400,3000             ; swing angle chord representing transition arc

4. **Standard King Bed Assembly with Nightstands & Pillows**:
   la A-FURN
   rec 2000,10500 3800,12500          ; main frame (1800x2000)
   rec 2150,11900 2750,12350          ; pillow left
   rec 3050,11900 3650,12350          ; pillow right
   rec 1400,12000 1900,12500          ; left nightstand
   rec 3900,12000 4400,12500          ; right nightstand

5. **Bathroom WC Fitting Assembly**:
   la A-FURN
   rec 8000,11000 8400,11500          ; standard WC tank
   c 8200,10800 150                   ; toilet bowl

---

### IV. DRAFTING RESPONSE PROTOCOL

You must analyze the user's natural language request (e.g. requested rooms, dimensions, style, functions like garden, pool, parking, balcony, duplex, clinic, bedroom, studio block). 

You **MUST** output exactly the following JSON structure. Fill out the "explanation" with a comprehensive, professional architectural space safety audit, and fill out "commands" with the full detailed blueprint layout sequence:

{
  "explanation": "### MASTER ARCHITECTURAL SPACE-PLANNING AUDIT\\n\\n**1. DESIGN CONCEPT & ORIENTATION:**\\n- Developed a [Modern Minimalist / Eco-Sustainable / High-density Professional] spatial schematic capturing all custom requests.\\n- Orientation highlights: Public spaces oriented towards [direction] to leverage cross-ventilation, while bedrooms reside in private back clusters.\\n\\n**2. STRUCTURAL GRID & SAFETY COMPLIANCE:**\\n- Setbacks: Generous [Front/Rear/Side] setbacks mapped out on A-GRID layer for legal compliance.\\n- Column matrix: Reinforced concreta column coordinates (300mmx300mm squares) plotted at major grid junctions of [x, y].\\n\\n**3. CIRCULATION GRAPH & UTILITIES:**\\n- Circulation: Clean pathways lead from Entrance lobby to [Rooms].\\n- Spatial efficiency: Carpet area covers [X]% of the buildable zone, ensuring optimal room sizing and clear structural wall alignments.\\n\\n**4. BLUEPRINT DETAILS:**\\n- Wall hierarchies: 230mm load-bearing perimeter walls ('A-WALL') paired with 115mm interior partition walls ('A-WALL-INT').\\n- Fixtures: Equipped with detailed sills, door swing transitions, bedroom beds with sideboards, and sanitary fixtures.",
  "commands": [
    "la A-GRID",
    "rec 0,0 10000,15000",
    "la A-COLS",
    "rec 850,2850 1150,3150 true #e53935",
    "la A-WALL",
    "dl 1000,3000 9000,3000 230",
    "la A-TEXT",
    "mt 5000,7500 FAMILY LOUNGE\\n4.0m x 4.5m\\n18.0 m²",
    "..."
  ]
}
}`;

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

    const contextPart = { text: "[ARCHITECTURAL CONTEXT]\n" + contextSummary + "\n\n[USER REQUEST]\n" + (prompt || "Produce architectural drafting.") };
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
