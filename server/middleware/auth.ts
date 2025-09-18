import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { createHash, randomBytes } from "crypto";
import type { CookieOptions } from "express";

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

// Calculate session expiration (30 days from now, or custom days)
export function getSessionExpiration(days: number = 30): Date {
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + days);
  return expiration;
}

// Hardened HTTPS detection (removed brittle User-Agent heuristics)
export function isSecureRequest(req: Request): boolean {
  // With trust proxy set, req.secure should be reliable
  if (req.secure) return true;
  
  // Check standard X-Forwarded-Proto header (ALB, CloudFront, etc.)
  const forwardedProto = req.get('x-forwarded-proto');
  if (forwardedProto === 'https') return true;
  
  // Check CloudFront-specific header
  if (req.get('cloudfront-forwarded-proto') === 'https') return true;
  
  // Check other forwarded headers that might be used by proxies
  if (req.get('x-forwarded-ssl') === 'on') return true;
  if (req.get('x-forwarded-scheme') === 'https') return true;
  
  // For development environments, allow HTTP
  const host = req.get('host');
  if (host && (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('replit'))) {
    return req.protocol === 'https';
  }
  
  // For production environments, default to secure for known hosting platforms
  if (host && (host.includes('amplifyapp.com') || host.includes('vercel.app') || host.includes('netlify.app'))) {
    return true;
  }
  
  return false;
}

// Public suffixes that should NEVER have domain cookies (security risk)
const PUBLIC_SUFFIXES = [
  'amplifyapp.com',
  'vercel.app',
  'netlify.app',
  'herokuapp.com',
  'replit.dev',
  'repl.co',
  'github.io',
  'githubusercontent.com',
  'firebaseapp.com',
  'web.app',
  'appspot.com'
];

// Check if a host is a public suffix that should not have domain cookies
function isPublicSuffix(host: string): boolean {
  return PUBLIC_SUFFIXES.some(suffix => host.endsWith('.' + suffix) || host === suffix);
}

// Get secure cookie options with proper domain handling
export function getSecureCookieOptions(req: Request, expires?: Date): CookieOptions {
  const isSecure = isSecureRequest(req);
  const host = req.get('host');
  
  const options: CookieOptions = {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/'
  };
  
  // Add expiration if provided
  if (expires) {
    options.expires = expires;
  }
  
  // SECURITY: Only set domain if explicitly configured via environment variable
  // This prevents automatic domain setting for public hosting platforms
  const cookieDomain = process.env.COOKIE_DOMAIN;
  if (cookieDomain && host) {
    // Validate that the configured domain matches the current host
    if (host === cookieDomain || host.endsWith('.' + cookieDomain)) {
      // Additional security check: don't allow domain cookies on public suffixes
      if (!isPublicSuffix(host)) {
        options.domain = '.' + cookieDomain;
      } else {
        console.warn(`SECURITY WARNING: Attempted to set domain cookie on public suffix: ${host}`);
      }
    } else {
      console.warn(`COOKIE_DOMAIN mismatch: configured=${cookieDomain}, host=${host}`);
    }
  }
  
  // Default behavior: host-only cookies (no domain attribute)
  // This is secure by default and prevents cross-subdomain cookie exposure
  
  return options;
}

// Helper function to clear cookies safely (handles both host-only and domain cookies)
export function clearSecureCookie(res: Response, req: Request, cookieName: string): void {
  // Clear host-only cookie (current secure default)
  const hostOnlyOptions = getSecureCookieOptions(req);
  delete hostOnlyOptions.expires;
  delete hostOnlyOptions.domain; // Ensure it's host-only
  res.clearCookie(cookieName, hostOnlyOptions);
  
  // Also clear any legacy domain cookies that might exist
  // This handles migration from the old insecure implementation
  const cookieDomain = process.env.COOKIE_DOMAIN;
  if (cookieDomain) {
    const domainOptions = { ...hostOnlyOptions, domain: '.' + cookieDomain };
    res.clearCookie(cookieName, domainOptions);
  }
  
  // For Amplify environments, also clear any legacy .amplifyapp.com domain cookies
  // that may have been set by the old vulnerable code
  const host = req.get('host');
  if (host && host.includes('amplifyapp.com')) {
    const legacyOptions = { ...hostOnlyOptions, domain: '.amplifyapp.com' };
    res.clearCookie(cookieName, legacyOptions);
  }
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