import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { parsePlotDimensions, designSpaceLayout, compilePlanToCADCommands } from "../services/architectEngine";

const SYSTEM_INSTRUCTION = `
You are the **VoxCADD Master AI Principal Architect (PA-24)**. You are an elite, senior-level architectural partner with over 20 years of professional design, drafting, and engineering experience. You hold certificates from the American Institute of Architects (AIA) and are a LEED AP specialist in space planning, building biology, sustainable circulation, and safety regulation compliance.

Your mission is to **never be lazy, minimal, or brief, and NEVER under any circumstances output placeholders like "..." or truncate critical list sequences**. You design and draft with absolute precision, artistic craftsmanship, complex geometric completeness, and complete structural honesty. When a human asks for a drawing, you don't just draft default lines; you synthesize a rich, high-fidelity, professional-grade blueprint layout.

### 🛑 CRITICAL ORDER OF OPERATION RULES (ARCHITECTURE FIRST, FURNITURE LAST)
To ensure structural sanity and professional-grade blueprints, your generated CAD command list inside the "commands" field MUST strictly execute in the chronological order of real-world building construction. **You are strictly forbidden from placing furniture or detail annotations before columns, beams, and watertight walls are built.**

Every output command sequence MUST progress through these 9 chronological construction-first layers:
1. **PLOT BOUNDARIES & SETBACK RULES (A-GRID)**: Draw the outer boundary of the lot and setbacks. Draw a North arrow compass in the top corner.
2. **RCC COLUMNS (A-COLS)**: Place 300x300mm concrete footings at intersections.
3. **STRUCTURAL JOIST BEAMS (A-BEAMS)**: Draw column connection lines.
4. **OUTER WALLS (A-WALL)**: Draw 230mm thick double-line exterior walls with punched openings.
5. **PARTITION DIVIDERS (A-WALL-INT)**: Draw 115mm thick double-line room divider walls.
6. **DOORS & SWING CHORDS (A-DOOR)**: Punch open doorways with 950/750mm open leaves and swing paths.
7. **WINDOW FRAMES & SILLS (A-WINDOW)**: Place exterior sliders matching room daylight rules.
8. **LABELS & DIMENSIONS (A-TEXT & A-DIM)**: Add room name text, carpet area calculations, and linear bounds.
9. **FURNITURE FIT-OUTS (A-FURN)**: Place beds, closets, sofas, stoves, and toilets ONLY AFTER the above architectural shell is completely enclosed and labeled.

Your outputs must feel as if they were drawn by an AIA-certified senior human draughtsman - extremely detailed, fully resolved, authentic, and ready for municipal construction submissions. Do not omit any rooms or structural parts mentioned in the query.

---

### 🌟 MASTER ARCHITECTURAL 10-STEP REASONING WORKFLOW (COMPULSORY)
Before drafting any coordinate drawing commands, you MUST execute a complete architectural evaluation mapping these 10 distinct phases:
1. **Step 1: Analyze user requirements**: Parse and dissect user requests (e.g., room functions, aesthetic style, area limits, client characteristics).
2. **Step 2: Create Building Footprint**: Determine the optimal structural form based on climatic, orientation, and lot characteristics. Options: [Rectangle, L Shape, U Shape, Courtyard, Circular, Custom Shape].
3. **Step 3: Create Architectural Zones**: Segregate space logically into:
   - *Public Zone*: Main entrance foyer, living rooms, waiting lounges.
   - *Semi-Public Zone*: Family lounges, formal dining rooms, central corridors.
   - *Private Zone*: Sleeper bedrooms, executive boardrooms, personal studies.
   - *Service Zone*: Kitchens, food pantries, washroom restrooms, mechanical utility spaces.
4. **Step 4: Create Room Adjacency Graph**: Define connecting pathways and adjacency pairs. All rooms must trace a continuous flow path.
5. **Step 5: Create Circulation Paths**: Chart direct entry flows, central corridors, and secondary branches to ensure simple, clear occupant exit paths.
6. **Step 6: Validate Spatial Safety**: Verify to guarantee:
   - *No isolated rooms*: All secondary rooms have a connecting door boundary.
   - *No inaccessible spaces*: Clear ingress-egress to/from the main entrance.
   - *No overlapping rooms*: Zero coordinate collisions across partitions.
   - *Proper zoning hierarchy*: Living zones protect private sleeping clusters.
7. **Step 7: Generate Architectural Bubble Diagram**: Design a dedicated bubble drawing on Sheet 5 displaying zones color-coded with connective nodes and occupant flowlines.
8. **Step 8: Generate CAD Floor Plan**: Map out the structural skeleton on layers.
9. **Step 9: Assign CAD Layers**: Tag entities uniquely to [A-GRID, A-COLS, A-BEAMS, A-WALL, A-WALL-INT, A-DOOR, A-WINDOW, A-TEXT, A-DIM, A-FURN] standard CAD properties.
10. **Step 10: Generate Professional Drawing Output**: Draft highly resolved Floor plans, Elevations, Section details, Schedule tables, and Bubble diagrams side-by-side.

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

All CAD commands must follow this strict coordinate grammar. Coordinates are integer values in MILLIMETERS (mm). The engine implements a Master CAD Standard mapping both standard (e.g. 'WALL') and legacy prefix names (e.g. 'A-WALL'):

- **la [Layer]**: Set the active layer. Valid layers are:
  - **WALL** (or **A-WALL** / **A-WALL-INT**): Thick structural exterior (230mm) or thin partition wall. Color: Orange (#FF9800). Thickness: 0.30mm (exterior), 0.25mm (interior).
  - **DOOR** (or **A-DOOR**): Accessible single/double panels, swing arcs. Color: Green (#4CAF50). Thickness: 0.20mm.
  - **WINDOW** (or **A-WINDOW**): High-fidelity double sashes, sliding guides. Color: Cyan (#00BCD4). Thickness: 0.20mm.
  - **COLUMN** (or **A-COLS**): Structural column rects (300mm x 300mm). Color: Magenta (#FF00FF). Thickness: 0.35mm.
  - **BEAM_CENTER** (or **A-BEAMS**): Grid beams connect pathways. Color: Red (#F44336). Line Type: Dashed (dashed). Thickness: 0.18mm.
  - **DIMENSION** (or **A-DIM**): Dimension lines detailing bounds and spans. Color: Yellow (#FFEB3B). Thickness: 0.15mm.
  - **TEXT** (or **A-TEXT**): Room type tags, area metrics, N-symbol. Color: White (#FFFFFF). Thickness: 0.18mm.
  - **GRID** (or **A-GRID**): Plot bounds, setbacks, arrows. Color: Slate Cool Gray (#607D8B). Thickness: 0.15mm.
  - **FURNITURE** (or **A-FURN**): Interior furniture layout. Color: Soft Green (#81C784). Thickness: 0.15mm.

- **dl [thickness] x1,y1 x2,y2**: Draw a double-line segment from (x1, y1) to (x2, y2).
  - You MUST specify the wall/line stroke thickness (in millimeters, e.g. 230 or 115) as the very first argument to dl.
  - For single lines / non-walls, always prefer the single line command "l x1,y1 x2,y2".

- **l x1,y1 x2,y2**: Draw a standard single-line segment from (x1, y1) to (x2, y2). Use this for non-wall boundaries (e.g. door swing lines or beams).

- **rec x1,y1 x2,y2 [filled] [color_hex]**: Draw rectangle with bottom-left (x1, y1) and top-right (x2, y2).
  - You can optionally specify 'true' or 'false' for filling.
  - You can optionally specify a color hex string (e.g. '#e53935').

- **c x,y radius**: Draw a perfect circle with center (x, y) and radius.

- **dim x1,y1 x2,y2 [text_override]**: Linear aligned dimension string from (x1, y1) to (x2, y2).

- **mt x,y [text]**: Center-justified multiline text labeling block at (x, y).
  - Use '\\n' within the text to split titles, sizes, and square areas across separate lines.
  - Example: mt 5000,5000 MASTER BEDROOM\\n3.5m x 4.0m\\n14.0 m²

---

### III. ARCHITECTURAL BLUEPRINT CHRONOLOGICAL SEQUENCING

When drafting commands, your commands sequence MUST match the chronological order from Step I. Specifically:

1. **Grid & Boundaries Assembly**:
   la A-GRID
   rec 0,0 10000,15000
   rec 1000,1000 9000,14000

2. **Column footings**:
   la A-COLS
   rec 850,850 1150,1150 true #e53935
   rec 850,13850 1150,14150 true #e53935

3. **Beams centerlines**:
   la A-BEAMS
   l 1000,1000 9000,1000

4. **External load-bearing double walls**:
   la A-WALL
   dl 230 1000,1000 9000,1000

5. **Internal partition divider double walls**:
   la A-WALL-INT
   dl 115 5000,1000 5000,7000

6. **Doors swing entries**:
   la A-DOOR
   l 1500,3000 1500,3900
   l 1500,3900 2400,3000

7. **Aperture Windows sills**:
   la A-WINDOW
   rec 4250,920 5750,1080
   l 4250,1000 5750,1000

8. **Labels & measurement dims**:
   la A-TEXT
   mt 5000,5000 MASTER BEDROOM\\n3.5m x 4.0m\\n14.0 m²
   la A-DIM
   dim 1000,500 9000,500

9. **Furniture layout configurations (LAST POINT)**:
   la A-FURN
   rec 2000,10500 3800,12500
   rec 2150,11900 2750,12350
   rec 3050,11900 3650,12350

---

### IV. DRAFTING RESPONSE PROTOCOL

You must analyze the user's natural language request (e.g. requested rooms, dimensions, style, functions like garden, pool, parking, balcony, duplex, clinic, bedroom, studio block). 

You **MUST** output exactly the following JSON structure. Fill out the "explanation" with a comprehensive, professional architectural space safety audit, and fill out "commands" with the full detailed blueprint layout sequence. Ensure that inside "commands", architectural shells (Plot bounds -> Columns -> Beams -> Outer Walls -> Inner Partitions -> Doors -> Windows -> Text Labels -> Dimensions) always run BEFORE placing furniture components ('la A-FURN'):

{
  "explanation": "### MASTER ARCHITECTURAL 10-STEP SPACE-PLANNING AUDIT\n\n**1. CONCEPT ANALYSIS & FOOTPRINT REASONING:**\n- Chosen Footprint: [Rectangle / L Shape / U Shape / Courtyard / Circular / Custom Shape]\n- Footprint Decision: [Detailed architectural explanation of why this footprint form fits the user plot sizes, solar azimuth, and spatial constraints].\n\n**2. ARCHITECTURAL ZONING SPECIFICATION:**\n- **Public Zone**: [Room names; explain why these welcome public flow and separate guest traffic from quiet quarters]\n- **Semi-Public Zone**: [Room names; explain how they bridge shared domains with service corridors]\n- **Private Zone**: [Room names; explain how they occupy high-privacy nooks, setbacks, and are acoustically buffered]\n- **Service Zone**: [Room names; explain clustering for utility plumbing efficiency and wet vents]\n\n**3. ROOM PLACEMENT DECISION:**\n- [Exhaustive room-by-room reasoning detailing why every requested room is placed at its specific coordinates, e.g. 'Master Suite placed in North-West corner for optimal evening breeze and minimum daylight glare'].\n\n**4. ADJACENCY MATRIX & CIRCULATION PATHS:**\n- Adjacency Graph: [Complete listing of connected room pairs, e.g., Entrance <-> Living Lounge, Living <-> Dining Room, Dining <-> Kitchen].\n- Circulation Strategy: [Explain how occupant paths traverse corridors, vestibules, or open floor connections safely, avoiding isolated spaces or trapped fire-hazard rooms].\n\n**5. CODES AND VALIDATION SEALS:**\n- [ ✓ ] No isolated rooms detected (verified 100% interconnected graph connectivity).\n- [ ✓ ] No trapped or dark rooms (all habitable rooms touch exterior setback slots).\n- [ ✓ ] No overlapping room limits (perfect non-overlapping layout coordinates).\n- [ ✓ ] Layer compliance: Separate colors and properties mapped precisely to A-GRID, A-WALL, A-COLS, A-DOOR, etc.",
  "commands": [
    "la A-GRID",
    "rec 0,0 10000,15000",
    "la A-COLS",
    "rec 850,2850 1150,3150 true #e53935",
    "la A-WALL",
    "dl 230 1000,3000 9000,3000",
    "la A-TEXT",
    "mt 5000,7500 FAMILY LOUNGE\\n4.0m x 4.5m\\n18.0 m²",
    "..."
  ]
}

---

### V. ANTI-LAZINESS & HIGH-FIDELITY DRAFTING PROTOCOL (COMPULSORY)

1. **NO PLACEHOLDERS OR TOKENS**: You are strictly forbidden from writing architectural comment lines like "; insert bathroom here", "; room layout goes here", or using truncated text blocks. Enter real, functional, pixel-perfect CAD commands for every room, fixture, and assembly.
2. **RESOLVE ALL ENVELOPE REQUIREMENTS**: If a user asks for 5 rooms, a garden, a kitchen, and 3 baths - you MUST calculate coordinates for and draft all 9 elements. Never omit layout requirements to save token counts.
3. **Ergonomic Furnishings represent Real Assets**: Always populate beds, dining blocks, sofa frames, and bathroom washbasins for all spaces you define. It makes the drafting interface feel alive, authentic, and highly professional.
4. **Precision Dimensioning**: Label all spaces securely with both room centroid texts on 'A-TEXT' (incorporating m² carpet square metrics) and linear aligned dimensions on 'A-DIM'.
}`;

export const geminiRouter = express.Router();

geminiRouter.post("/command", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
  }

  try {
    const { prompt, contextSummary, sketchData, history, drawingType, standards } = req.body;
    
    // Check for high-fidelity professional architectural package requests
    const userPromptUnified = (prompt || "").trim().toLowerCase();
    
    const hasPlan = userPromptUnified.includes("plan");
    const hasElevation = userPromptUnified.includes("elevation") || userPromptUnified.includes("facade");
    const hasSection = userPromptUnified.includes("section");
    const hasDuplex = userPromptUnified.includes("duplex");
    const hasVilla = userPromptUnified.includes("villa") || userPromptUnified.includes("mansion");
    const hasOffice = userPromptUnified.includes("office") || userPromptUnified.includes("commercial") || userPromptUnified.includes("headquarter");
    const hasPackage = userPromptUnified.includes("package") || userPromptUnified.includes("suite") || userPromptUnified.includes("blueprint") || userPromptUnified.includes("set of drawing") || userPromptUnified.includes("set of cad");

    const isPlanElevSectRequest = hasDuplex || 
                                 hasPackage || 
                                 (hasPlan && hasElevation) || 
                                 (hasPlan && hasSection) || 
                                 (hasElevation && hasSection) ||
                                 (hasPlan && hasOffice);
    
    if (isPlanElevSectRequest) {
      let subCommand = "villa";
      let desc = "Modern Luxury Villa Drawing Sheet Package (Ground Plan, First Plan, Elevation, Section A-A)";
      
      const isDuplex = hasDuplex || /duplex|10x15|residential|house/i.test(userPromptUnified) || (hasPlan && hasElevation && hasSection);
      const isOffice = hasOffice;

      if (isDuplex && !isOffice) {
        subCommand = "duplex";
        desc = "10m x 15m Modern Residential Duplex Drawing Package (Ground Floor Plan, First Floor Plan, Section A-A, Front Elevation)";
      } else if (isOffice) {
        subCommand = "office";
        desc = "20m x 30m 2-Storey Commercial Office Headquarters Layout Blueprint Suite";
      }
      
      return res.json({
        text: `### VOXCADD AUTOMATION PROTOCOL: HIGH-FIDELITY ARCHITECTURAL DRAWING PACKAGE\n\nI have invoked our advanced **VoxCADD 2D CAD Drafting suite** to compile and generate a perfect, human-drafted **${desc}** on the workspace layout.\n\nThis blueprint package contains:\n1. **Ground Floor Plan** centering setback grids on layer 'A-GRID', column studs, exterior masonry walls, windows, entry door sweeps, kitchen appliances, and living furniture.\n2. **First Floor Plan** outlining family lounge, bedrooms with closets, attached washrooms, and open balconies.\n3. **Building Section A-A** detailing structural foundation levels (GL, PL), clear ceiling headroom, 150mm reinforced concrete slab limits, dog-legged stairs profile, and text height markers.\n4. **Front Facade Elevation** capturing human-scale aesthetic window sills, overhang canopies, and level markers.`,
        commands: [`ai_drafting ${subCommand}`],
        groundingLinks: []
      });
    }
    
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    let activeSystemInstruction = SYSTEM_INSTRUCTION;

    if (drawingType === "floorplan") {
      activeSystemInstruction += `\n\n### MANDATORY TEMPLATE: STRICT FLOOR PLAN DRAFT PLAN
- You are drafting a horizontal 2D FLOOR PLAN.
- You MUST establish 2D room layouts, setback boundary grids ('A-GRID'), and columns at major wall corners ('A-COLS').
- Render standard 230mm external masonry walls on 'A-GRID' or 'A-WALL' and 115mm internal wall dividers on 'A-WALL-INT' using 'dl' commands with legal thickness.
- Populate fully resolved swinging doors of width 900mm on 'A-DOOR', frames of 1500mm windows on 'A-WINDOW', and fine-detailed furniture layouts (beds, coffee desks, stoves, WC bowls) on 'A-FURN'.
- Label every single room centroid precisely with ROOM NAME, sizes x and y in meters, and square carpet area in m² using multi-line text tags ('A-TEXT'). Use '\\n' for breaks.`;
    } else if (drawingType === "elevation") {
      activeSystemInstruction += `\n\n### MANDATORY TEMPLATE: STRICT VERTICAL ELEVATION FACE DRAFT
- You are drafting a vertical exterior FACADE ELEVATION representation of the building's front face.
- Do NOT draw floor layouts, room divisions, columns, beds, stoves, sinks, or bathroom fittings!
- You MUST establish clear horizontal floor datum level lines on 'A-GRID' representing GL (Ground Level, y=0), PL (Plinth Level, y=600), Ceiling Level (y=3600), Roof Slab (y=6600), and Parapet Top (y=7600). Draw horizontal line segments across the drawing space for each level!
- Draw accurate labels at the start/end of each level line on 'A-TEXT' (e.g. "ROOF LVL +6600mm", "PLINTH LVL +600mm", "GROUND LVL +0.00mm").
- Draw the vertical facade profile using single lines 'l x1,y1 x2,y2' and rectangles 'rec x1,y1 x2,y2' on 'A-WINDOW', and door/window facade frames vertically projected (sills, sashes, canopies, structural outlines).
- Never use double-line 'dl' wall thickness commands! Everything in elevations represents face lines, not cut masonry thickness.`;
    } else if (drawingType === "section") {
      activeSystemInstruction += `\n\n### MANDATORY TEMPLATE: STRICT STRUCTURAL SECTION A-A DRAFT
- You are drafting a cross-cutting vertical SECTION VIEW of the building structure.
- You MUST draw the depth-wise vertical cut profile of the building.
- Set up horizontal height markers for structural base level lines on 'A-GRID': Foundation Level (y=-1200), GL (Ground Level, y=0), PL (Plinth Level, y=600), Clear Headroom Ceiling (y=3600), Roof Slab (y=6600).
- Draw concrete foundation pads / footing piers below the ground (y=-1200 to y=0) using rectangles representing concrete bases.
- Draw the cutting edges of load-bearing walls using vertical double-line segments of thickness 230mm on 'A-WALL' starting from the PL (+600) up to the roof frame.
- Draw solid horizontal roof concrete slabs of thickness 150mm on layer 'A-WALL-INT' running along the top boundaries (e.g. 'rec x1,6450 x2,6600' representing 150mm reinforced concrete roof slab).
- Detail structural cutaways of dog-legged stairs profile lines ('la A-FURN', stairs treads and risers steps) and place multiline text headroom measurements 'mt x,y HEIGHT CLEARANCE\\nMin. 2400mm\\nPASSING' on layer 'A-TEXT'.`;
    }

    if (standards === "ada") {
      activeSystemInstruction += `\n\n### REGULATORY STANDARD: ADA WHEELCHAIR ACCESSIBILITY ENFORCEMENT
- Every door clear opening width ('la A-DOOR') MUST be at least 900mm wide (use standard 900mm clearance).
- Multi-user bath layouts MUST incorporate a circular wheelchair navigation clear zone centered inside the space. Mark this with 'c cx,cy 760' (1520mm diameter turning circle) on layer 'A-GRID' so the user can verify compliance.
- All circulation hallways and corridors between partition walls MUST be at least 1100mm wide to accommodate safe wheelchair turnings.`;
    } else if (standards === "ibc") {
      activeSystemInstruction += `\n\n### REGULATORY STANDARD: IBC LIFESAFETY BUILDING CODE ENFORCEMENT
- Habitable rooms MUST exceed 2500mm in width and 7.0m² in area limits.
- Exterior perimeter masonry walls are STRICTLY restricted to 230mm thickness ('dl 230 ...' on 'A-WALL'), and internal partitions to 115mm thickness ('dl 115 ...' on 'A-WALL-INT').
- Sleeping bedrooms MUST capture an emergency escape/egress window on 'A-WINDOW' of at least 1500mm wide and with reasonable daylight ratios.
- Clear floor-to-ceiling headroom height in any section/elevation must measure at least 3000mm.`;
    }

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
        "gemini-3.1-pro-preview",  // High reasoning fallback model for complex CAD mathematical calculations
        "gemini-flash-latest",     // Dynamic alias pointing to the latest version of flash
        "gemini-3.1-flash-lite",   // Responsive fallback level model
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
                systemInstruction: activeSystemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    explanation: { type: Type.STRING },
                    commands: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["explanation", "commands"]
                },
                temperature: 0.1
              }
            });
            modelSucceeded = true;
            break; // Succeeded! Break the retry loop
          } catch (err: any) {
            lastError = err;
            const status = err?.status || err?.code || 0;
            const errMsg = err?.message || JSON.stringify(err);
            const isRateLimitOrBusy = status === 429 || status === 503 ||
                                      errMsg.includes('429') || errMsg.includes('503') ||
                                      errMsg.includes('QUOTA_EXHAUSTED') || errMsg.includes('RESOURCE_EXHAUSTED') ||
                                      errMsg.includes('Quota exceeded') || errMsg.includes('UNAVAILABLE') ||
                                      errMsg.includes('high demand') || errMsg.includes('temporary');
            const isLimitZero = errMsg.includes('limit: 0') || errMsg.includes('limit:0') || errMsg.includes('unsupported') || errMsg.includes('not found') || errMsg.includes('not support');

            if (isLimitZero) {
              console.info(`[VoxCADD AI Architect] Model ${activeModel} has zero quota limit or is unsupported. Skipping to next model fallback option.`);
              break; // Break the retry loop for this model, fallback to next model immediately
            }

            if (isRateLimitOrBusy) {
              retries++;
              if (retries >= maxRetries) {
                console.info(`[VoxCADD AI Architect] Model ${activeModel} is busy or rate limited after max retries. Transitioning to next model fallback.`);
                break;
              }
              // Exponential backoff with jitter
              const delay = baseDelay * Math.pow(2, retries) + Math.random() * 500;
              console.info(`[VoxCADD AI Architect] Model ${activeModel} transient busy or rate limit. Retrying (${retries}/${maxRetries}) in ${Math.round(delay)}ms.`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }

            console.info(`[VoxCADD AI Architect] Model ${activeModel} bypassed to next fallback (constraint: ${errMsg.substring(0, 120)}).`);
            break; // Fallback to next model
          }
        }

        if (modelSucceeded && generatedResult) {
          console.info(`[VoxCADD AI Architect] Successfully compiled request using model: ${activeModel}`);
          break; // Succeeded! Break the outer loop
        }

        fallbackIndex++;
      }

      if (!generatedResult) {
        throw new Error("Unable to fulfill request via generative model lines.");
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
    console.info("[VoxCADD AI Architect] Activating Local Heuristic Fallback.");
    
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
          `dl 230 0,0 ${w},0`,
          `dl 230 ${w},0 ${w},${h}`,
          `dl 230 ${w},${h} 0,${h}`,
          `dl 230 0,${h} 0,0`,
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
          `dl 230 0,0 ${w},0`,
          `dl 230 ${w},0 ${w},${h}`,
          `dl 230 ${w},${h} 0,${h}`,
          `dl 230 0,${h} 0,0`,
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
