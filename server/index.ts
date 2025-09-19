import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Trust proxy for secure cookie detection behind load balancers/proxies
app.set('trust proxy', 1);

// Configure CORS with secure production settings
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // PRODUCTION: Strict security - only allow explicitly configured origins
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
      
      // Only allow origins specifically configured in ALLOWED_ORIGINS environment variable
      // SECURITY: No wildcard patterns or broad domain matching allowed in production
      if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
        console.log(`CORS allowed production origin: ${origin}`);
        return callback(null, true);
      }
      
      // Reject all other origins in production for security
      console.warn(`SECURITY: CORS blocked unauthorized origin in production: ${origin}`);
      console.warn(`SECURITY: Configure this origin in ALLOWED_ORIGINS environment variable if needed`);
      return callback(new Error('Not allowed by CORS'));
    }
    
    // DEVELOPMENT: Allow development platforms and local origins
    const developmentOrigins = [
      'http://localhost:3000',
      'http://localhost:5000', 
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5000',
    ];
    
    // Check for development origins
    if (developmentOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check for Replit domains (development/testing platforms)
    if (origin.includes('.replit.dev') || origin.includes('.repl.co')) {
      return callback(null, true);
    }
    
    // SECURITY: For development, also check ALLOWED_ORIGINS if provided
    // This allows explicit domain configuration even in development
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
    if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
      console.log(`CORS allowed configured origin in development: ${origin}`);
      return callback(null, true);
    }
    
    // In development mode, be more permissive for testing (but not wildcard domains)
    // SECURITY NOTE: Removed broad .amplifyapp.com pattern - use ALLOWED_ORIGINS for specific domains
    if (process.env.NODE_ENV === 'development') {
      console.log(`CORS allowed development origin: ${origin}`);
      return callback(null, true);
    }
    
    // Reject otherwise
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Allow cookies and authentication headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // SECURITY: Do not log response bodies for auth endpoints to prevent session token exposure
      if (capturedJsonResponse && !path.startsWith("/api/auth")) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const { server } = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // SECURITY: Log error with stack trace but do not crash server
    console.error("Server error:", {
      status,
      message,
      stack: err.stack,
      url: _req.url,
      method: _req.method
    });

    // Send error response if not already sent
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    
    // CRITICAL: Do not throw err - this would crash the server process
    // Removed: throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
