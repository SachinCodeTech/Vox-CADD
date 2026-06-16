# VoxCADD Professional architectural AI Fine-Tuning & Integration Guide

This guide establishes the comprehensive technical strategy, prompt engineering structures, training schemas, and system configuration required to fine-tune and integrate high-precision architectural intelligence into the Gemini API Service. 

By applying this blueprint, the AI engine can interpret colloquial user requests (e.g., "draw a master bed with a small bath") and compile them into watertight, high-fidelity Vector CAD drawings aligning with international building codes (**IBC**) and the Americans with Disabilities Act (**ADA**) regulations.

---

## 1. Spatial Code Specifications & Regulatory Definitions

To assure compliance and minimize layout errors, the system prompt and fine-tuning datasets inject specific legal and functional parameters.

### A. ADA Accessibility Standards (Barrier-Free Design)
ADA regulations ensure spaces accommodate individuals with physical disabilities:
1. **Unimpeded Clear Openings (Doors)**: 
   - Minimum clear opening width must be **32 inches (813mm)**. In CAD coordinates, this mandates a standard doorway module of at least **900mm** to account for door leaves and frames.
   - Bathroom doors must swing outwards or provide a clear **60-inch (1524mm) diameter circular turning area** inside the room to prevent pinning wheelchairs.
2. **Wheelchair Clearance Zones**:
   - Circulation corridors must have a clear path width of **36 inches (914mm)** minimum, preferable **1100mm to 1200mm** for bidirectional public clearance.
   - Any bathroom design must include a **760mm x 1220mm (30" x 48")** clear floor space centered on toilet fixtures and washbasins.

### B. International Building Code (IBC) Standards
IBC governs building life-safety, health, and minimum structural metrics:
1. **Minimum Room Dimensions & Headroom**:
   - Habitable rooms in residential structures must have a carpet area of at least **70 square feet (6.5 m²)**, with a minimum dimension of **7 feet (2134mm)** in any direction.
   - **Headroom Clearance**: Occupiable spaces must maintain a minimum clear ceiling height of **7 feet 6 inches (2286mm)**. Standard VoxCADD structural elevations use **3000mm** (approx 10 feet) per storey to provide premium air circulation volume.
2. **Masonry Partition and Support Scalings**:
   - **Exterior Perimeter Walls (`A-WALL`)**: Must be drafted as double-lines with **230mm** (9-inch) thickness, representing standard structural masonry plus plaster and thermal protection insulation.
   - **Interior Space Divider Partitions (`A-WALL-INT`)**: Drafted at **115mm** (4.5-inch) thickness, representing standard non-load-bearing brick, drywall partitions, or partition boards.
3. **Emergency Escape and Rescue Openings (Egress)**:
   - Every sleeping bedroom *must* contain at least one external operable window with a net clear opening area of **5.7 sq ft (0.53 m²)**.
   - Minimum window sill height above the floor must not exceed **44 inches (1118mm)**.

---

## 2. Dynamic Integration & Contextual Prompting Injection

Rather than relying on generic weights, we inject runtime system constraints dynamically into the Gemini request based on selected client configurations:

```
                  +-----------------------------------+
                  |   Client AI Drafting Panel UI    |
                  +-----------------+-----------------+
                                    |
                    - Selected Type (Floorplan | Section | Elevation)
                    - Active Regulation Code (ADA | IBC)
                                    v
                  +-----------------+-----------------+
                  |      Server Express API Route     |
                  +-----------------+-----------------+
                                    |
                    - Load general system prompt
                    - Append template-specific prompt block
                    - Append active standard constraints
                                    v
                  +-----------------+-----------------+
                  |      Gemini Generative Service     |
                  +-----------------------------------+
```

### Prompt Snippets Injected for Specific Standards

#### ADA Accessibility Injection:
> "SYSTEM CONSTRAINT [ADA-ACCESSIBILITY-COMPLIANT]: All door clearances (`la A-DOOR`) must measure at least 900mm in swing width. For every bathroom layout, you must render a wheelchair turning space circle centered in the room coordinate grid using `c cx,cy 760` on layer `A-GRID` (to visually prove a 1520mm turning path exists). Maintain a corridor width between any interior walls of at least 1100mm."

#### IBC Safety Code Injection:
> "SYSTEM CONSTRAINT [IBC-SAFETY-COMPLIANT]: All habitable bedroom areas must have a minimum width of 2500mm and minimum floor area of 7.0 m². Ensure every bedroom includes an exterior window on layer `A-WINDOW` measuring at least 1500mm wide for emergency egress. Enforce outer walls (`la A-WALL`) at 230mm double lines, and inner partitions (`la A-WALL-INT`) at 115mm double lines."

---

## 3. Fine-Tuning dataset representation Schema

For specialized tasks where instructions are insufficient, fine-tuning a custom model on a curated dataset (e.g., using Gemini Developer Console or Google Vertex AI) delivers maximum coordinate precision.

### Dataset Schema Format (System-Instruct JSONL)

Each training sample consists of a structured conversation:
- `systemInstruction`: Core persona and dictionary rules.
- `contents`: User prompt (input) and expected clean, raw, watertight JSON response (output).

#### Fine-Tuning Training Session example (JSONL Record)
```json
{
  "systemInstruction": "You are the VoxCADD Principal Architect. Render complete, watertight CAD commands conforming to 230mm exterior and 115mm interior walls on respective layers...",
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": "Draft a tiny ADA compliant office clinic space of 6m x 6m at origin 0,0." }
      ]
    },
    {
      "role": "model",
      "parts": [
        {
          "text": "{\n  \"explanation\": \"### ADA-COMPLIANT CLINIC SPACE AUDIT\\n1. **A-GRID**: Boundary is 6m x 6m (6000x6000mm).\\n2. **A-COLS**: Integrated 300x300mm columns for loading support.\\n3. **ADA-CLEARANCE**: Standard doors set to 900mm width, and corridor pathways exceed 1200mm to allow free navigation.\",\n  \"commands\": [\n    \"la A-GRID\",\n    \"rec 0,0 6000,6000\",\n    \"la A-COLS\",\n    \"rec 0,0 300,300 true #e53935\",\n    \"rec 5700,0 6000,300 true #e53935\",\n    \"rec 5700,5700 6000,6000 true #e53935\",\n    \"rec 0,5700 300,6000 true #e53935\",\n    \"la A-WALL\",\n    \"dl 230 0,0 6000,0\",\n    \"dl 230 6000,0 6000,6000\",\n    \"dl 230 6000,6000 0,6000\",\n    \"dl 230 0,6000 0,0\",\n    \"la A-WALL-INT\",\n    \"dl 115 3000,0 3000,4000\",\n    \"la A-DOOR\",\n    \"l 3000,4000 3000,4900\",\n    \"l 3000,4900 3900,4000\",\n    \"la A-TEXT\",\n    \"mt 1500,3000 PATIENT WARD\\n3.0m x 4.0m\\n12.0 m²\",\n    \"mt 4500,3000 RECEPTION\\n2.7m x 6.0m\\n16.2 m²\"\n  ]\n}"
        }
      ]
    }
  ]
}
```

---

## 4. CAD Vector Post-Processing and Validation Filters

Even with a fine-tuned model, generative AI occasionally exhibits floating point coordinates drift or slightly skewed lines. The **VoxCADD Snapping Layer** ensures all raw coordinate outputs undergo structural rectification before rendering:

1. **Orthogonal/Parallel Line snaps**:
   $$\text{If } |y_2 - y_1| \le 50\text{mm} \implies y_2 = y_1 \quad (\text{Horizontal Force})$$
   $$\text{If } |x_2 - x_1| \le 50\text{mm} \implies x_2 = x_1 \quad (\text{Vertical Force})$$
2. **Masonry Thickness Snap**:
   $$\text{For any double-line (dl) command on A-WALL or A-WALL-INT layer:}$$
   $$\text{If } \text{thickness} < 172.5\text{mm} \implies \text{width} = 115\text{mm} \quad (\text{Interior Divider})$$
   $$\text{If } \text{thickness} \ge 172.5\text{mm} \implies \text{width} = 230\text{mm} \quad (\text{Exterior Load-Bearing})$$
3. **Grid Coordinate Alignments**:
   - Rounds floating-point values to nearest **50mm** or **100mm** modules to reflect human drafting standards.

---

## 5. Deployment Pipeline & Vertex AI Setup

To deploy this integrated system:
1. **Collect Training Data**: Compile 1,000+ hand-curated CAD blueprint outputs alongside technical user descriptions in `.jsonl` system-instruct format.
2. **Train Model**: Use Vertex AI or Google AI Studio to fine-tune `gemini-3.5-flash` or `gemini-3.1-pro-preview` with your target dataset.
3. **Store Credentials**: Add the resulting custom model endpoint as an environment variable in the **Secrets/Config Panels** using custom model endpoints (e.g., `projects/PROJ_ID/locations/LOC/models/FINE_TUNED_MODEL_ID`).
4. **Active Validation**: Configure the server-side middleware and client-side `AiDraftingPanel` UI with validation switches to enforce snapping, visual approval overlays, logs checking, and live code enforcement.
