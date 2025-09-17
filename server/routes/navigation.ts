import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";

export function registerNavigationRoutes(app: Express) {
  // Get visible modules for current user's navigation
  app.get("/api/navigation/visible-modules", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      // Get user's accessible modules using existing storage method
      const accessibleModules = await storage.getUserAccessibleModules(userId);
      
      // Transform to navigation format with default paths
      const navigationModules = accessibleModules.map(module => ({
        id: module.id,
        name: module.name, // module identifier (like 'admin', 'users')
        displayName: module.displayName,
        defaultPath: `/${module.name}`, // Default route path for the module
        isActive: module.isActive
      }));
      
      // Filter only active modules for navigation
      const activeNavigationModules = navigationModules.filter(module => module.isActive);
      
      res.json(activeNavigationModules);
    } catch (error) {
      console.error("Error fetching visible modules for navigation:", error);
      res.status(500).json({ error: "Failed to fetch visible modules" });
    }
  });
}