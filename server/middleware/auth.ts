import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { createHash, randomBytes } from "crypto";

// Extend Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email?: string;
        role: string;
        isActive: boolean;
      };
      sessionToken?: string;
    }
  }
}

// Extract session token from cookies
function extractSessionToken(req: Request): string | null {
  // First check for session cookie
  if (req.cookies?.session) {
    return req.cookies.session;
  }
  
  // Fallback to Authorization header for API clients
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

// Generate secure session token
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

// Calculate session expiration (30 days from now)
export function getSessionExpiration(): Date {
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + 30);
  return expiration;
}

// Middleware to authenticate user via session token
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionToken = extractSessionToken(req);
    
    if (!sessionToken) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Get session from storage (handles token hashing internally)
    const session = await storage.getSession(sessionToken);
    
    if (!session) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    
    // Check if session has expired
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await storage.deleteSession(sessionToken);
      return res.status(401).json({ error: "Session expired" });
    }
    
    // Get user details
    const user = await storage.getUser(session.userId);
    
    if (!user || !user.isActive) {
      // Clean up session for inactive user
      await storage.deleteSession(sessionToken);
      return res.status(401).json({ error: "User account is inactive" });
    }
    
    // Attach user and session token to request
    req.user = user;
    req.sessionToken = sessionToken;
    
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

// Middleware to require specific role
export function requireRole(requiredRole: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    if (req.user.role !== requiredRole) {
      return res.status(403).json({ 
        error: `Access denied. Required role: ${requiredRole}`,
        userRole: req.user.role
      });
    }
    
    next();
  };
}

// Middleware to require admin role
export const requireAdmin = requireRole('admin');

// Middleware to require any authenticated user
export const requireAuth = authenticateUser;

// Optional middleware for routes that work with or without authentication
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const sessionToken = extractSessionToken(req);
  
  if (!sessionToken) {
    return next(); // Continue without user
  }
  
  try {
    const session = await storage.getSession(sessionToken);
    
    if (session && session.expiresAt >= new Date()) {
      const user = await storage.getUser(session.userId);
      if (user?.isActive) {
        req.user = { ...user, email: user.email || undefined };
        req.sessionToken = sessionToken;
      }
    }
  } catch (error) {
    console.error("Optional auth error:", error);
    // Don't fail the request, just continue without user
  }
  
  next();
}