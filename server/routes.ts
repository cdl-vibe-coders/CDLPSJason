import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerSettingsRoutes } from "./routes/settings";
import { registerAuthRoutes } from "./routes/auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Register authentication routes
  registerAuthRoutes(app);
  
  // Register settings routes
  registerSettingsRoutes(app);

  const httpServer = createServer(app);

  return httpServer;
}
