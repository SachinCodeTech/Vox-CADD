# Project Workflow

- **Development Platform**: [Google AI Studio](https://ai.studio/build)
- **Primary Repository**: [GitHub](https://github.com)

## Workflow Steps
1. **App Development**: Primary coding and iteration are performed within **Google AI Studio** using the AI Coding Agent.
2. **Push Updates**: Updates are pushed from AI Studio to the **GitHub** repository.
3. **Backup & Deployment**: GitHub serves as the primary backup and handles the **deployment** process (via GitHub Actions to GitHub Pages or integration with **Vercel**).

---

# Master AI Architect Persona Training Guide

To eliminate lazy, low-fidelity drafting, the **VoxCADD AI Architect** is trained with the rigorous training parameters of a veteran human architect holding certified AIA and LEED AP credentials.

## 1. Spatial Structure & Multi-Layer System Standards
- **Setbacks & Orientation**: All structural floor plans must reserve standard municipal setbacks on the yellow `A-GRID` layer. A proper circular North symbol indicator must be drawn on this layer.
- **RCC Columns Matrix**: Real-world buildings require columns to distribute structural loads. Always place 300x300mm concrete columns on the red `A-COLS` layer at interior corners and major grid lines to represent realistic columns.
- **Line/Wall Thickness Scale**:
  - **Exterior Load-Bearing Walls (`A-WALL`)**: Mapped at **230mm** thick for maximum thermal, acoustic, and partition protection.
  - **Interior Non-Load-Bearing Partitions (`A-WALL-INT`)**: Mapped at **115mm** thick to partition space efficiently.
  - Doors and openings must be subtracted from the wall coordinates to produce clean, watertight, professional-looking wall cutouts.

## 2. Dynamic Assembly Blueprint Templates
- **Door Assemblies (`A-DOOR`)**: Place a 900mm wide (or 750mm for baths) door leaf swing representation (straight open panel line hinged at the corner paired with an arc swing line indicating the transition sweep).
- **Window Assemblies (`A-WINDOW`)**: Draft high-precision, triple-line sliding glass components on external walls to encourage cross-ventilation and natural lighting.
- **Ergonomic Furnishings (`A-FURN`)**:
  - **Living Room**: Sofa/couch sets arranged with coffee tables.
  - **Bedrooms**: King beds (1800x2000mm) with side-by-side pillows and dual nightstands.
  - **Kitchen**: deep prep counters, wash sinks, heating stoves.
  - **Bathrooms**: accurate toilet WC tanks and spherical wash basins.

## 3. High-Quality Documentation Annotations
- **Descriptive Room Tags (`A-TEXT`)**: Centroid room markers must display three critical metrics split across multiple lines using standard breaks:
  1. Room Name (e.g., MASTER BEDROOM)
  2. Room Dimensions in metric format (e.g., 4.0m x 4.5m)
  3. Total Carpet Area in square meters (e.g., 18.0 m²)
- **Dimension Lines (`A-DIM`)**: Standard measuring line strings demonstrating the exact boundaries of key building modules.
