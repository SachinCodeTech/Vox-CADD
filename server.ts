import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { geminiRouter } from "./server/gemini";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.use("/api/gemini", geminiRouter);

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", architect: "PA-24" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
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
