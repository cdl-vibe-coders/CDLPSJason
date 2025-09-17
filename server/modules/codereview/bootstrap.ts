import { Router } from "express";
import type { ModuleBootstrapResult, ModuleManifest, ModuleLifecycle } from "../../types/module";
import { CodeReviewModuleStorage } from "./storage";
import { createCodeReviewController } from "./controller";
import { requireAuth } from "../../middleware/auth";

// ============= CODE REVIEW MODULE MANIFEST =============

export const codeReviewManifest: ModuleManifest = {
  id: "codereview",
  name: "codereview",
  displayName: "Code Review",
  description: "AI-powered code review and quality analysis",
  version: "1.0.0",
  apiPrefix: "/api/codereview",
  dbNamespace: "codereview_",
  dependencies: [],
  requiredRole: undefined, // Available to all authenticated users
  isCore: false,
  capabilities: [
    {
      id: "code_analysis",
      name: "Code Analysis",
      description: "Analyze code quality, security, and performance",
      endpoints: ["/reviews", "/reviews/:id/perform", "/ai/summary", "/ai/suggestions"]
    },
    {
      id: "project_management",
      name: "Project Management",
      description: "Manage code review projects and repositories",
      endpoints: ["/projects", "/projects/:id"]
    },
    {
      id: "review_templates",
      name: "Review Templates",
      description: "Create and manage review templates",
      endpoints: ["/templates", "/templates/:id"]
    },
    {
      id: "review_metrics",
      name: "Review Metrics",
      description: "Track code quality metrics over time",
      endpoints: ["/stats", "/projects/:id/stats"]
    }
  ]
};

// ============= CODE REVIEW MODULE BOOTSTRAP =============

export async function bootstrapCodeReviewModule(): Promise<ModuleBootstrapResult> {
  console.log("🔍 Bootstrapping Code Review Module...");

  // Check for required environment variables
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️ ANTHROPIC_API_KEY not configured - module will run with limited functionality');
  }

  // Create isolated storage (initialization handled in lifecycle)
  const storage = new CodeReviewModuleStorage();

  // Create controller with injected storage
  const controller = createCodeReviewController(storage);

  // Create router with all code review endpoints
  const router = Router();

  // All routes require authentication
  router.use(requireAuth);

  // ============= PROJECT ROUTES =============
  
  router.get("/projects", async (req, res) => {
    try {
      const projects = await controller.getUserProjects(req.user?.id!);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  router.get("/projects/:id", async (req, res) => {
    try {
      const project = await controller.getProject(req.params.id, req.user?.id!);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  router.post("/projects", async (req, res) => {
    try {
      const project = await controller.createProject(req.user?.id!, req.body);
      res.status(201).json(project);
    } catch (error: any) {
      if (error.message?.includes("Invalid")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  router.put("/projects/:id", async (req, res) => {
    try {
      const updated = await controller.updateProject(req.params.id, req.user?.id!, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Project not found or unauthorized" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  router.delete("/projects/:id", async (req, res) => {
    try {
      const deleted = await controller.deleteProject(req.params.id, req.user?.id!);
      if (!deleted) {
        return res.status(404).json({ error: "Project not found or unauthorized" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // ============= REVIEW ROUTES =============

  router.get("/reviews", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      const reviews = projectId 
        ? await controller.getProjectReviews(projectId, req.user?.id!)
        : await controller.getUserReviews(req.user?.id!);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  router.get("/reviews/:id", async (req, res) => {
    try {
      const data = await controller.getReviewWithDetails(req.params.id, req.user?.id!);
      if (!data) {
        return res.status(404).json({ error: "Review not found" });
      }
      res.json(data);
    } catch (error) {
      console.error("Error fetching review:", error);
      res.status(500).json({ error: "Failed to fetch review" });
    }
  });

  router.post("/reviews", async (req, res) => {
    try {
      const result = await controller.createReview(req.user?.id!, req.body);
      res.status(201).json(result);
    } catch (error: any) {
      if (error.message?.includes("Invalid")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating review:", error);
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  router.post("/reviews/:id/perform", async (req, res) => {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({ 
          error: 'AI review service not available', 
          details: 'ANTHROPIC_API_KEY not configured' 
        });
      }

      const result = await controller.performReview(req.params.id, req.user?.id!);
      if (!result) {
        return res.status(404).json({ error: "Review not found or unauthorized" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error performing review:", error);
      res.status(500).json({ error: "Failed to perform review" });
    }
  });

  router.delete("/reviews/:id", async (req, res) => {
    try {
      const deleted = await controller.deleteReview(req.params.id, req.user?.id!);
      if (!deleted) {
        return res.status(404).json({ error: "Review not found or unauthorized" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting review:", error);
      res.status(500).json({ error: "Failed to delete review" });
    }
  });

  // ============= COMMENT ROUTES =============

  router.post("/reviews/:reviewId/comments", async (req, res) => {
    try {
      const { comment } = req.body;
      if (!comment) {
        return res.status(400).json({ error: "Comment is required" });
      }

      const newComment = await controller.addComment(
        req.params.reviewId,
        req.user?.id!,
        comment
      );
      res.status(201).json(newComment);
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({ error: "Failed to add comment" });
    }
  });

  router.put("/comments/:id", async (req, res) => {
    try {
      const updated = await controller.updateComment(req.params.id, req.user?.id!, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Comment not found or unauthorized" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating comment:", error);
      res.status(500).json({ error: "Failed to update comment" });
    }
  });

  router.delete("/comments/:id", async (req, res) => {
    try {
      const deleted = await controller.deleteComment(req.params.id, req.user?.id!);
      if (!deleted) {
        return res.status(404).json({ error: "Comment not found or unauthorized" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // ============= TEMPLATE ROUTES =============

  router.get("/templates", async (req, res) => {
    try {
      const includePublic = req.query.includePublic === 'true';
      const templates = await controller.getTemplates(req.user?.id!, includePublic);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  router.get("/templates/:id", async (req, res) => {
    try {
      const template = await controller.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching template:", error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  router.post("/templates", async (req, res) => {
    try {
      const template = await controller.createTemplate(req.user?.id!, req.body);
      res.status(201).json(template);
    } catch (error: any) {
      if (error.message?.includes("Invalid")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  router.put("/templates/:id", async (req, res) => {
    try {
      const updated = await controller.updateTemplate(req.params.id, req.user?.id!, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Template not found or unauthorized" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating template:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  router.delete("/templates/:id", async (req, res) => {
    try {
      const deleted = await controller.deleteTemplate(req.params.id, req.user?.id!);
      if (!deleted) {
        return res.status(404).json({ error: "Template not found or unauthorized" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // ============= STATISTICS ROUTES =============

  router.get("/projects/:id/stats", async (req, res) => {
    try {
      const stats = await controller.getProjectStats(req.params.id, req.user?.id!);
      if (!stats) {
        return res.status(404).json({ error: "Project not found or unauthorized" });
      }
      res.json(stats);
    } catch (error) {
      console.error("Error fetching project stats:", error);
      res.status(500).json({ error: "Failed to fetch project statistics" });
    }
  });

  router.get("/stats", async (req, res) => {
    try {
      const stats = await controller.getUserStats(req.user?.id!);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Failed to fetch user statistics" });
    }
  });

  // ============= AI HELPER ROUTES =============

  router.post("/ai/summary", async (req, res) => {
    try {
      const { code, language } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Code is required" });
      }

      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({ 
          error: 'AI service not available', 
          details: 'ANTHROPIC_API_KEY not configured' 
        });
      }

      const summary = await controller.generateCodeSummary(code, language);
      res.json({ summary });
    } catch (error) {
      console.error("Error generating summary:", error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  router.post("/ai/suggestions", async (req, res) => {
    try {
      const { code, language } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Code is required" });
      }

      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({ 
          error: 'AI service not available', 
          details: 'ANTHROPIC_API_KEY not configured' 
        });
      }

      const suggestions = await controller.suggestImprovements(code, language);
      res.json({ suggestions });
    } catch (error) {
      console.error("Error generating suggestions:", error);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

  // ============= HEALTH CHECK ROUTE =============

  router.get("/health", async (req, res) => {
    try {
      const health = await storage.healthCheck();
      res.json({ 
        status: health ? 'healthy' : 'unhealthy',
        anthropicApiConfigured: !!process.env.ANTHROPIC_API_KEY,
        databaseConnected: health
      });
    } catch (error) {
      console.error("Error checking health:", error);
      res.status(500).json({ 
        status: 'unhealthy',
        error: 'Failed to check module health' 
      });
    }
  });

  // ============= MODULE LIFECYCLE =============

  const lifecycle: ModuleLifecycle = {
    onInit: async () => {
      console.log("🔍 Code Review module initializing...");
      await storage.initialize();
      console.log("✅ Code Review module initialized");
    },

    onStart: async () => {
      console.log("🟢 Code Review module started");
    },

    onStop: async () => {
      console.log("🔴 Code Review module stopped");
    },

    onHealthCheck: async () => {
      const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
      const dbHealthy = await storage.healthCheck();
      
      return {
        status: dbHealthy ? 'healthy' : 'unhealthy',
        details: {
          anthropicApiConfigured: hasApiKey,
          databaseConnected: dbHealthy
        }
      };
    },

    onDestroy: async () => {
      await storage.cleanup();
      console.log("💀 Code Review module destroyed");
    }
  };

  console.log("✅ Code Review Module bootstrapped successfully");

  return {
    router,
    lifecycle,
    manifest: codeReviewManifest,
    storage
  };
}