import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { generateSessionToken, getSessionExpiration } from "../middleware/auth";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

// Login schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

// Registration schema (extends insertUserSchema)
const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(1, "Password confirmation is required")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export function registerAuthRoutes(app: Express) {
  // ============= LOGIN =============
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const validation = loginSchema.safeParse(req.body);
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const { username, password } = validation.data;
      
      // Verify user credentials
      const user = await storage.verifyUserPassword(username, password);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      if (!user.isActive) {
        return res.status(401).json({ error: "Account is deactivated" });
      }
      
      // Generate session token
      const sessionToken = generateSessionToken();
      const expiresAt = getSessionExpiration();
      
      // Create session in database
      await storage.createSession({
        userId: user.id,
        token: sessionToken,
        expiresAt
      });
      
      // Set secure session cookie
      res.cookie('session', sessionToken, {
        httpOnly: true,
        secure: req.protocol === 'https' || req.get('x-forwarded-proto') === 'https',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/'
      });
      
      // Remove password from response
      const { password: _, ...userResponse } = user;
      
      res.json({
        success: true,
        user: userResponse,
        sessionToken // For API clients that can't use cookies
      });
      
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // ============= LOGOUT =============
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      // Get session token from cookie or header
      const sessionToken = req.cookies?.session || 
        (req.headers.authorization?.startsWith('Bearer ') ? 
         req.headers.authorization.substring(7) : null);
      
      if (sessionToken) {
        // Delete session from database
        await storage.deleteSession(sessionToken);
      }
      
      // Clear session cookie
      res.clearCookie('session', {
        httpOnly: true,
        secure: req.protocol === 'https' || req.get('x-forwarded-proto') === 'https',
        sameSite: 'lax',
        path: '/'
      });
      
      res.json({ success: true, message: "Logged out successfully" });
      
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // ============= REGISTER =============
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const validation = registerSchema.safeParse(req.body);
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const { username, email, password, role } = validation.data;
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: "This username is already taken. Please choose a different one." });
      }
      
      if (email) {
        const existingEmail = await storage.getUserByEmail(email);
        if (existingEmail) {
          return res.status(409).json({ error: "This email is already registered. Please use a different email or try signing in." });
        }
      }
      
      // Create new user (password hashing handled in storage layer)
      const user = await storage.createUser({
        username,
        email: email || null,
        password,
        role: role || 'user' // Default to 'user' role
      });
      
      // Generate session token for immediate login
      const sessionToken = generateSessionToken();
      const expiresAt = getSessionExpiration();
      
      // Create session
      await storage.createSession({
        userId: user.id,
        token: sessionToken,
        expiresAt
      });
      
      // Set secure session cookie
      res.cookie('session', sessionToken, {
        httpOnly: true,
        secure: req.protocol === 'https' || req.get('x-forwarded-proto') === 'https',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/'
      });
      
      res.status(201).json({
        success: true,
        user,
        sessionToken // For API clients
      });
      
    } catch (error) {
      console.error("Registration error:", error);
      
      // Specific database errors
      if (error instanceof Error && error.message.includes('unique constraint')) {
        if (error.message.includes('username')) {
          return res.status(409).json({ error: "This username is already taken. Please choose a different one." });
        }
        if (error.message.includes('email')) {
          return res.status(409).json({ error: "This email is already registered. Please use a different email or try signing in." });
        }
        return res.status(409).json({ error: "Username or email already exists. Please try different values." });
      }
      
      // Database connection errors
      if (error instanceof Error && (error.message.includes('connection') || error.message.includes('timeout'))) {
        return res.status(503).json({ error: "Unable to connect to our servers right now. Please try again in a moment." });
      }
      
      // Generic server error with more helpful message
      res.status(500).json({ error: "Something went wrong while creating your account. Please try again or contact support if the problem continues." });
    }
  });

  // ============= GET CURRENT USER =============
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      // Get session token from cookie or header
      const sessionToken = req.cookies?.session || 
        (req.headers.authorization?.startsWith('Bearer ') ? 
         req.headers.authorization.substring(7) : null);
      
      if (!sessionToken) {
        return res.status(401).json({ error: "No session found" });
      }
      
      // Get session
      const session = await storage.getSession(sessionToken);
      
      if (!session || session.expiresAt < new Date()) {
        if (session) {
          await storage.deleteSession(sessionToken);
        }
        res.clearCookie('session', {
          httpOnly: true,
          secure: req.protocol === 'https' || req.get('x-forwarded-proto') === 'https',
          sameSite: 'lax',
          path: '/'
        });
        return res.status(401).json({ error: "Session expired" });
      }
      
      // Get user
      const user = await storage.getUser(session.userId);
      
      if (!user || !user.isActive) {
        await storage.deleteSession(sessionToken);
        res.clearCookie('session', {
          httpOnly: true,
          secure: req.protocol === 'https' || req.get('x-forwarded-proto') === 'https',
          sameSite: 'lax',
          path: '/'
        });
        return res.status(401).json({ error: "User account inactive" });
      }
      
      res.json({ user });
      
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ error: "Failed to get user information" });
    }
  });

  // ============= GET USER'S ACCESSIBLE MODULES =============
  app.get("/api/me/modules", async (req: Request, res: Response) => {
    try {
      // Get session token from cookie or header
      const sessionToken = req.cookies?.session || 
        (req.headers.authorization?.startsWith('Bearer ') ? 
         req.headers.authorization.substring(7) : null);
      
      if (!sessionToken) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Get session
      const session = await storage.getSession(sessionToken);
      
      if (!session || session.expiresAt < new Date()) {
        if (session) {
          await storage.deleteSession(sessionToken);
        }
        res.clearCookie('session', {
          httpOnly: true,
          secure: req.protocol === 'https' || req.get('x-forwarded-proto') === 'https',
          sameSite: 'lax',
          path: '/'
        });
        return res.status(401).json({ error: "Session expired" });
      }
      
      // Get user
      const user = await storage.getUser(session.userId);
      
      if (!user || !user.isActive) {
        await storage.deleteSession(sessionToken);
        res.clearCookie('session', {
          httpOnly: true,
          secure: req.protocol === 'https' || req.get('x-forwarded-proto') === 'https',
          sameSite: 'lax',
          path: '/'
        });
        return res.status(401).json({ error: "User account inactive" });
      }
      
      // Get user's accessible modules using the storage method
      const accessibleModules = await storage.getUserAccessibleModules(user.id);
      
      res.json({
        modules: accessibleModules,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
      
    } catch (error) {
      console.error("Get user modules error:", error);
      res.status(500).json({ error: "Failed to get accessible modules" });
    }
  });

  // ============= REFRESH SESSION =============
  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session || 
        (req.headers.authorization?.startsWith('Bearer ') ? 
         req.headers.authorization.substring(7) : null);
      
      if (!sessionToken) {
        return res.status(401).json({ error: "No session to refresh" });
      }
      
      const session = await storage.getSession(sessionToken);
      
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      
      // Check if session is still valid
      if (session.expiresAt < new Date()) {
        await storage.deleteSession(sessionToken);
        res.clearCookie('session', {
          httpOnly: true,
          secure: req.protocol === 'https' || req.get('x-forwarded-proto') === 'https',
          sameSite: 'lax',
          path: '/'
        });
        return res.status(401).json({ error: "Session expired" });
      }
      
      // Generate new session token
      const newSessionToken = generateSessionToken();
      const newExpiresAt = getSessionExpiration();
      
      // Delete old session
      await storage.deleteSession(sessionToken);
      
      // Create new session
      await storage.createSession({
        userId: session.userId,
        token: newSessionToken,
        expiresAt: newExpiresAt
      });
      
      // Set new cookie
      res.cookie('session', newSessionToken, {
        httpOnly: true,
        secure: req.protocol === 'https' || req.get('x-forwarded-proto') === 'https',
        sameSite: 'lax',
        expires: newExpiresAt,
        path: '/'
      });
      
      res.json({ 
        success: true, 
        sessionToken: newSessionToken 
      });
      
    } catch (error) {
      console.error("Session refresh error:", error);
      res.status(500).json({ error: "Failed to refresh session" });
    }
  });
}