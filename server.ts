import express from "express";
import path from "path";
import { geminiRouter } from "./server/gemini";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Log server mode on startup
  console.log(`[INIT] Running server in environment: ${process.env.NODE_ENV || "development (default)"}`);

  app.use(express.json({ limit: '10mb' }));

  // Dynamic headers for COOP/COEP (mandatory for SharedArrayBuffer/WebAssembly in modern browsers)
  app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    // Log incoming routes for debugging asset loading issues
    console.log(`[REQUEST] Path: ${req.path} | OriginalUrl: ${req.originalUrl}`);
    next();
  });

  // API Routes
  app.use("/api/gemini", geminiRouter);

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", architect: "PA-24" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await (eval('import("vite")') as any);
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files from dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VoxCADD AI Architect Server running on port ${PORT}`);
  });
}

startServer();
