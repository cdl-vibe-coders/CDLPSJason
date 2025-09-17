import { CodeReviewModuleStorage } from './storage';
import { CodeReviewService } from './service';
import {
  insertCodereviewProjectSchema,
  insertCodereviewReviewSchema,
  insertCodereviewTemplateSchema,
  CodereviewProject,
  CodereviewReview,
  CodereviewResult,
  CodereviewComment,
  CodereviewTemplate,
} from '../../../shared/schema';
import { z } from 'zod';

export function createCodeReviewController(storage: CodeReviewModuleStorage) {
  const service = new CodeReviewService(storage);

  return {
    // Projects
    async createProject(userId: string, data: any): Promise<CodereviewProject> {
      const validated = insertCodereviewProjectSchema.parse(data);
      return service.createProject(userId, validated);
    },

    async getProject(id: string, userId: string): Promise<CodereviewProject | undefined> {
      return service.getProject(id, userId);
    },

    async getUserProjects(userId: string): Promise<CodereviewProject[]> {
      return service.getUserProjects(userId);
    },

    async updateProject(id: string, userId: string, updates: Partial<CodereviewProject>): Promise<CodereviewProject | undefined> {
      return service.updateProject(id, userId, updates);
    },

    async deleteProject(id: string, userId: string): Promise<boolean> {
      return service.deleteProject(id, userId);
    },

    // Reviews
    async createReview(userId: string, data: any): Promise<{ review: CodereviewReview; result?: CodereviewResult }> {
      const validated = insertCodereviewReviewSchema.parse(data);
      return service.createReview(userId, validated);
    },

    async performReview(reviewId: string, userId: string): Promise<CodereviewResult | undefined> {
      return service.performReview(reviewId, userId);
    },

    async getReview(id: string, userId: string): Promise<CodereviewReview | undefined> {
      return service.getReview(id, userId);
    },

    async getReviewWithDetails(id: string, userId: string): Promise<{ review: CodereviewReview; result?: CodereviewResult; comments: CodereviewComment[] } | undefined> {
      const review = await service.getReview(id, userId);
      if (!review) {
        return undefined;
      }

      const result = await service.getReviewResult(id, userId);
      const comments = await service.getReviewComments(id);

      return { review, result, comments };
    },

    async getProjectReviews(projectId: string, userId: string): Promise<CodereviewReview[]> {
      return service.getProjectReviews(projectId, userId);
    },

    async getUserReviews(userId: string): Promise<CodereviewReview[]> {
      return service.getUserReviews(userId);
    },

    async deleteReview(id: string, userId: string): Promise<boolean> {
      return service.deleteReview(id, userId);
    },

    // Comments
    async addComment(reviewId: string, userId: string, comment: string): Promise<CodereviewComment> {
      return service.addComment(reviewId, userId, comment, false);
    },

    async getReviewComments(reviewId: string): Promise<CodereviewComment[]> {
      return service.getReviewComments(reviewId);
    },

    async updateComment(id: string, userId: string, updates: Partial<CodereviewComment>): Promise<CodereviewComment | undefined> {
      return service.updateComment(id, userId, updates);
    },

    async deleteComment(id: string, userId: string): Promise<boolean> {
      return service.deleteComment(id, userId);
    },

    // Templates
    async createTemplate(userId: string, data: any): Promise<CodereviewTemplate> {
      const validated = insertCodereviewTemplateSchema.parse(data);
      return service.createTemplate(userId, validated);
    },

    async getTemplate(id: string): Promise<CodereviewTemplate | undefined> {
      return service.getTemplate(id);
    },

    async getTemplates(userId: string, includePublic: boolean): Promise<CodereviewTemplate[] | { userTemplates: CodereviewTemplate[]; publicTemplates: CodereviewTemplate[] }> {
      const userTemplates = await service.getUserTemplates(userId);
      
      if (includePublic) {
        const publicTemplates = await service.getPublicTemplates();
        return { userTemplates, publicTemplates };
      }
      
      return userTemplates;
    },

    async updateTemplate(id: string, userId: string, updates: Partial<CodereviewTemplate>): Promise<CodereviewTemplate | undefined> {
      return service.updateTemplate(id, userId, updates);
    },

    async deleteTemplate(id: string, userId: string): Promise<boolean> {
      return service.deleteTemplate(id, userId);
    },

    // Statistics
    async getProjectStats(projectId: string, userId: string): Promise<any> {
      return service.getProjectStats(projectId, userId);
    },

    async getUserStats(userId: string): Promise<any> {
      return service.getUserStats(userId);
    },

    // AI Helpers
    async generateCodeSummary(code: string, language?: string): Promise<string> {
      return service.generateCodeSummary(code, language);
    },

    async suggestImprovements(code: string, language?: string): Promise<string> {
      return service.suggestImprovements(code, language);
    },
  };
}