import { BaseModuleStorage } from "../../storage/BaseModuleStorage";
import { 
  users, users_sessions, users_preferences, users_activity, users_profiles,
  type User, type InsertUser, type UserWithoutPassword,
  type UserSession, type InsertUserSession,
  type UserPreferences, type InsertUserPreferences,
  type UserActivity, type InsertUserActivity,
  type UserProfile, type InsertUserProfile, type UserWithProfile
} from "./schema";
import { eq, and, desc, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { createHash } from "crypto";

const SALT_ROUNDS = 12;

// ============= USERS MODULE STORAGE =============

export class UsersModuleStorage extends BaseModuleStorage {
  constructor() {
    super("users", "users_");
  }

  // ============= INITIALIZATION =============

  async initialize(): Promise<void> {
    console.log(`Initializing ${this.moduleId} module storage...`);
    
    try {
      // Create module registry table if it doesn't exist (shared infrastructure)
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS module_registry (
          module_id VARCHAR PRIMARY KEY,
          namespace VARCHAR NOT NULL,
          initialized_at TIMESTAMP DEFAULT NOW(),
          version VARCHAR DEFAULT '1.0.0'
        )
      `);

      // Record this module's initialization
      await this.recordModuleInitialization();
      
      console.log(`✅ ${this.moduleId} module storage initialized`);
    } catch (error) {
      console.error(`Failed to initialize ${this.moduleId} module storage:`, error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    console.log(`Cleaning up ${this.moduleId} module storage...`);
    // Clean up expired sessions periodically
    await this.cleanExpiredSessions();
  }

  // ============= PASSWORD SECURITY =============
  
  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, SALT_ROUNDS);
  }
  
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }
  
  private removePasswordField(user: User): UserWithoutPassword {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  
  // ============= SESSION TOKEN SECURITY =============
  
  private hashSessionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // ============= USER MANAGEMENT =============

  async getUser(id: string): Promise<UserWithoutPassword | undefined> {
    const [user] = await this.executeQuery(() =>
      this.db.select().from(users).where(eq(users.id, id))
    );
    return user ? this.removePasswordField(user) : undefined;
  }

  async getUserByUsername(username: string): Promise<UserWithoutPassword | undefined> {
    const [user] = await this.executeQuery(() =>
      this.db.select().from(users).where(eq(users.username, username))
    );
    return user ? this.removePasswordField(user) : undefined;
  }
  
  async getUserForLogin(username: string): Promise<User | undefined> {
    const [user] = await this.executeQuery(() =>
      this.db.select().from(users).where(eq(users.username, username))
    );
    return user || undefined;
  }

  async getUserWithProfile(id: string): Promise<UserWithProfile | undefined> {
    const [result] = await this.executeQuery(() =>
      this.db
        .select()
        .from(users)
        .leftJoin(users_profiles, eq(users.id, users_profiles.userId))
        .leftJoin(users_preferences, eq(users.id, users_preferences.userId))
        .where(eq(users.id, id))
    );

    if (!result) return undefined;

    const user = this.removePasswordField(result.users);
    return {
      ...user,
      profile: result.users_profiles || undefined,
      preferences: result.users_preferences || undefined,
    };
  }

  async createUser(insertUser: InsertUser): Promise<UserWithoutPassword> {
    const hashedPassword = await this.hashPassword(insertUser.password);
    const [user] = await this.executeQuery(() =>
      this.db
        .insert(users)
        .values({
          ...insertUser,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
          role: insertUser.role || "user"
        })
        .returning()
    );
    return this.removePasswordField(user);
  }

  async updateUser(id: string, updates: Partial<Omit<User, 'password'>>): Promise<UserWithoutPassword | undefined> {
    const [user] = await this.executeQuery(() =>
      this.db
        .update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning()
    );
    return user ? this.removePasswordField(user) : undefined;
  }

  async updateUserPassword(id: string, newPassword: string): Promise<boolean> {
    const hashedPassword = await this.hashPassword(newPassword);
    const result = await this.executeQuery(() =>
      this.db
        .update(users)
        .set({ 
          password: hashedPassword, 
          updatedAt: new Date() 
        })
        .where(eq(users.id, id))
    );
    return (result.rowCount || 0) > 0;
  }

  async verifyUserPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserForLogin(username);
    if (!user) return null;

    const isValid = await this.verifyPassword(password, user.password);
    return isValid ? user : null;
  }

  // ============= SESSION MANAGEMENT =============

  async createSession(session: InsertUserSession): Promise<UserSession> {
    const hashedToken = this.hashSessionToken(session.token);
    
    const [newSession] = await this.executeQuery(() =>
      this.db
        .insert(users_sessions)
        .values({
          ...session,
          token: hashedToken,
          createdAt: new Date(),
        })
        .returning()
    );
    
    // Return session with original token for response
    return { ...newSession, token: session.token };
  }

  async getSession(token: string): Promise<UserSession | undefined> {
    const hashedToken = this.hashSessionToken(token);
    
    const [session] = await this.executeQuery(() =>
      this.db
        .select()
        .from(users_sessions)
        .where(eq(users_sessions.token, hashedToken))
    );
    
    if (!session) return undefined;
    
    // Return session with original token format (don't expose hash)
    return { ...session, token };
  }

  async getSessionWithUser(token: string): Promise<{ session: UserSession, user: UserWithoutPassword } | undefined> {
    const session = await this.getSession(token);
    if (!session) return undefined;

    const user = await this.getUser(session.userId);
    if (!user) return undefined;

    return { session, user };
  }

  async deleteSession(token: string): Promise<boolean> {
    const hashedToken = this.hashSessionToken(token);
    
    const result = await this.executeQuery(() =>
      this.db
        .delete(users_sessions)
        .where(eq(users_sessions.token, hashedToken))
    );
    
    return (result.rowCount || 0) > 0;
  }

  async cleanExpiredSessions(): Promise<number> {
    const result = await this.executeQuery(() =>
      this.db
        .delete(users_sessions)
        .where(sql`expires_at < NOW()`)
    );
    
    const count = result.rowCount;
    if (count > 0) {
      console.log(`Cleaned up ${count} expired sessions`);
    }
    
    return count;
  }

  async getUserSessions(userId: string): Promise<UserSession[]> {
    return await this.executeQuery(() =>
      this.db
        .select()
        .from(users_sessions)
        .where(eq(users_sessions.userId, userId))
        .orderBy(desc(users_sessions.createdAt))
    );
  }

  // ============= USER PREFERENCES =============

  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [preferences] = await this.executeQuery(() =>
      this.db
        .select()
        .from(users_preferences)
        .where(eq(users_preferences.userId, userId))
    );
    return preferences || undefined;
  }

  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    const [newPreferences] = await this.executeQuery(() =>
      this.db
        .insert(users_preferences)
        .values({
          ...preferences,
          updatedAt: new Date(),
        })
        .returning()
    );
    return newPreferences;
  }

  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences | undefined> {
    const [preferences] = await this.executeQuery(() =>
      this.db
        .update(users_preferences)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users_preferences.userId, userId))
        .returning()
    );
    return preferences || undefined;
  }

  // ============= USER PROFILES =============

  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await this.executeQuery(() =>
      this.db
        .select()
        .from(users_profiles)
        .where(eq(users_profiles.userId, userId))
    );
    return profile || undefined;
  }

  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const [newProfile] = await this.executeQuery(() =>
      this.db
        .insert(users_profiles)
        .values({
          ...profile,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
    );
    return newProfile;
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | undefined> {
    const [profile] = await this.executeQuery(() =>
      this.db
        .update(users_profiles)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users_profiles.userId, userId))
        .returning()
    );
    return profile || undefined;
  }

  // ============= USER ACTIVITY TRACKING =============

  async logUserActivity(activity: InsertUserActivity): Promise<UserActivity> {
    const [newActivity] = await this.executeQuery(() =>
      this.db
        .insert(users_activity)
        .values({
          ...activity,
          timestamp: new Date(),
        })
        .returning()
    );
    return newActivity;
  }

  async getUserActivity(userId: string, limit: number = 50): Promise<UserActivity[]> {
    return await this.executeQuery(() =>
      this.db
        .select()
        .from(users_activity)
        .where(eq(users_activity.userId, userId))
        .orderBy(desc(users_activity.timestamp))
        .limit(limit)
    );
  }

  async getRecentUserActivity(userId: string, hours: number = 24): Promise<UserActivity[]> {
    return await this.executeQuery(() =>
      this.db
        .select()
        .from(users_activity)
        .where(
          and(
            eq(users_activity.userId, userId),
            sql`timestamp > NOW() - INTERVAL '${sql.raw(hours.toString())} HOURS'`
          )
        )
        .orderBy(desc(users_activity.timestamp))
    );
  }

  // ============= USER STATISTICS =============

  async getUserCount(): Promise<number> {
    const [result] = await this.executeQuery(() =>
      this.db
        .select({ count: sql`count(*)::int` })
        .from(users)
    );
    return result?.count || 0;
  }

  async getActiveUserCount(): Promise<number> {
    const [result] = await this.executeQuery(() =>
      this.db
        .select({ count: sql`count(*)::int` })
        .from(users)
        .where(eq(users.isActive, true))
    );
    return result?.count || 0;
  }

  async getNewUserCount(days: number = 7): Promise<number> {
    const [result] = await this.executeQuery(() =>
      this.db
        .select({ count: sql`count(*)::int` })
        .from(users)
        .where(sql`created_at > NOW() - INTERVAL '${sql.raw(days.toString())} DAYS'`)
    );
    return result?.count || 0;
  }
}