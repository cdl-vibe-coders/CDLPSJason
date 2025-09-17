import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../db';
import { 
  codereview_projects,
  codereview_reviews,
  codereview_results,
  codereview_comments,
  codereview_templates,
  codereview_metrics,
  CodereviewProject,
  CodereviewReview,
  CodereviewResult,
  CodereviewComment,
  CodereviewTemplate,
  CodereviewMetric,
  InsertCodereviewProject,
  InsertCodereviewReview,
  InsertCodereviewResult,
  InsertCodereviewComment,
  InsertCodereviewTemplate,
  InsertCodereviewMetric,
} from '../../../shared/schema';
import type { ModuleStorage } from '../../types/module';

export class CodeReviewModuleStorage implements ModuleStorage {
  readonly namespace = 'codereview_';
  readonly moduleId = 'codereview';

  async initialize(): Promise<void> {
    console.log('Initializing code review module storage...');
    try {
      // Check if tables exist by attempting a simple query
      await db.select().from(codereview_projects).limit(0);
      console.log('✅ Code review module storage initialized');
    } catch (error) {
      console.log('📦 Code review tables need to be created - run npm run db:push');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await db.execute(sql`SELECT 1`);
      return true;
    } catch (error) {
      return false;
    }
  }

  async cleanup(): Promise<void> {
    // Cleanup any resources if needed
  }

  // Projects
  async createProject(project: InsertCodereviewProject): Promise<CodereviewProject> {
    const [newProject] = await db
      .insert(codereview_projects)
      .values(project)
      .returning();
    return newProject;
  }

  async getProject(id: string): Promise<CodereviewProject | undefined> {
    const [project] = await db
      .select()
      .from(codereview_projects)
      .where(eq(codereview_projects.id, id));
    return project;
  }

  async getProjectsByUser(userId: string): Promise<CodereviewProject[]> {
    return await db
      .select()
      .from(codereview_projects)
      .where(eq(codereview_projects.userId, userId))
      .orderBy(desc(codereview_projects.createdAt));
  }

  async updateProject(id: string, updates: Partial<CodereviewProject>): Promise<CodereviewProject | undefined> {
    const [updated] = await db
      .update(codereview_projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(codereview_projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db
      .delete(codereview_projects)
      .where(eq(codereview_projects.id, id))
      .returning();
    return result.length > 0;
  }

  // Reviews
  async createReview(review: InsertCodereviewReview): Promise<CodereviewReview> {
    const [newReview] = await db
      .insert(codereview_reviews)
      .values(review)
      .returning();
    return newReview;
  }

  async getReview(id: string): Promise<CodereviewReview | undefined> {
    const [review] = await db
      .select()
      .from(codereview_reviews)
      .where(eq(codereview_reviews.id, id));
    return review;
  }

  async getReviewsByProject(projectId: string): Promise<CodereviewReview[]> {
    return await db
      .select()
      .from(codereview_reviews)
      .where(eq(codereview_reviews.projectId, projectId))
      .orderBy(desc(codereview_reviews.createdAt));
  }

  async getReviewsByUser(userId: string): Promise<CodereviewReview[]> {
    return await db
      .select()
      .from(codereview_reviews)
      .where(eq(codereview_reviews.userId, userId))
      .orderBy(desc(codereview_reviews.createdAt));
  }

  async updateReview(id: string, updates: Partial<CodereviewReview>): Promise<CodereviewReview | undefined> {
    const [updated] = await db
      .update(codereview_reviews)
      .set(updates)
      .where(eq(codereview_reviews.id, id))
      .returning();
    return updated;
  }

  async deleteReview(id: string): Promise<boolean> {
    const result = await db
      .delete(codereview_reviews)
      .where(eq(codereview_reviews.id, id))
      .returning();
    return result.length > 0;
  }

  // Results
  async createResult(result: InsertCodereviewResult): Promise<CodereviewResult> {
    const [newResult] = await db
      .insert(codereview_results)
      .values(result)
      .returning();
    return newResult;
  }

  async getResultByReview(reviewId: string): Promise<CodereviewResult | undefined> {
    const [result] = await db
      .select()
      .from(codereview_results)
      .where(eq(codereview_results.reviewId, reviewId));
    return result;
  }

  async updateResult(reviewId: string, updates: Partial<CodereviewResult>): Promise<CodereviewResult | undefined> {
    const [updated] = await db
      .update(codereview_results)
      .set(updates)
      .where(eq(codereview_results.reviewId, reviewId))
      .returning();
    return updated;
  }

  // Comments
  async createComment(comment: InsertCodereviewComment): Promise<CodereviewComment> {
    const [newComment] = await db
      .insert(codereview_comments)
      .values(comment)
      .returning();
    return newComment;
  }

  async getCommentsByReview(reviewId: string): Promise<CodereviewComment[]> {
    return await db
      .select()
      .from(codereview_comments)
      .where(eq(codereview_comments.reviewId, reviewId))
      .orderBy(desc(codereview_comments.createdAt));
  }

  async updateComment(id: string, updates: Partial<CodereviewComment>): Promise<CodereviewComment | undefined> {
    const [updated] = await db
      .update(codereview_comments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(codereview_comments.id, id))
      .returning();
    return updated;
  }

  async deleteComment(id: string): Promise<boolean> {
    const result = await db
      .delete(codereview_comments)
      .where(eq(codereview_comments.id, id))
      .returning();
    return result.length > 0;
  }

  // Templates
  async createTemplate(template: InsertCodereviewTemplate): Promise<CodereviewTemplate> {
    const [newTemplate] = await db
      .insert(codereview_templates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async getTemplate(id: string): Promise<CodereviewTemplate | undefined> {
    const [template] = await db
      .select()
      .from(codereview_templates)
      .where(eq(codereview_templates.id, id));
    return template;
  }

  async getTemplatesByUser(userId: string): Promise<CodereviewTemplate[]> {
    return await db
      .select()
      .from(codereview_templates)
      .where(eq(codereview_templates.userId, userId))
      .orderBy(desc(codereview_templates.createdAt));
  }

  async getPublicTemplates(): Promise<CodereviewTemplate[]> {
    return await db
      .select()
      .from(codereview_templates)
      .where(eq(codereview_templates.isPublic, true))
      .orderBy(desc(codereview_templates.createdAt));
  }

  async updateTemplate(id: string, updates: Partial<CodereviewTemplate>): Promise<CodereviewTemplate | undefined> {
    const [updated] = await db
      .update(codereview_templates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(codereview_templates.id, id))
      .returning();
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const result = await db
      .delete(codereview_templates)
      .where(eq(codereview_templates.id, id))
      .returning();
    return result.length > 0;
  }

  // Metrics
  async createMetric(metric: InsertCodereviewMetric): Promise<CodereviewMetric> {
    const [newMetric] = await db
      .insert(codereview_metrics)
      .values(metric)
      .returning();
    return newMetric;
  }

  async getMetricsByProject(projectId: string): Promise<CodereviewMetric[]> {
    return await db
      .select()
      .from(codereview_metrics)
      .where(eq(codereview_metrics.projectId, projectId))
      .orderBy(desc(codereview_metrics.date));
  }

  async getLatestMetric(projectId: string): Promise<CodereviewMetric | undefined> {
    const [metric] = await db
      .select()
      .from(codereview_metrics)
      .where(eq(codereview_metrics.projectId, projectId))
      .orderBy(desc(codereview_metrics.date))
      .limit(1);
    return metric;
  }

  // Statistics
  async getReviewStatsByProject(projectId: string): Promise<any> {
    const result = await db
      .select({
        totalReviews: sql<number>`count(*)`,
        completedReviews: sql<number>`count(case when status = 'completed' then 1 end)`,
        failedReviews: sql<number>`count(case when status = 'failed' then 1 end)`,
      })
      .from(codereview_reviews)
      .where(eq(codereview_reviews.projectId, projectId));
    return result[0];
  }

  async getReviewStatsByUser(userId: string): Promise<any> {
    const result = await db
      .select({
        totalReviews: sql<number>`count(*)`,
        totalProjects: sql<number>`count(distinct project_id)`,
        averageReviewsPerDay: sql<number>`count(*) / greatest(1, extract(day from now() - min(created_at)) + 1)`,
      })
      .from(codereview_reviews)
      .where(eq(codereview_reviews.userId, userId));
    return result[0];
  }
}