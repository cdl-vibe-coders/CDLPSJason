import { CodeReviewModuleStorage } from './storage';
import { AnthropicService, CodeReviewRequest, CodeReviewResponse } from './anthropic-service';
import {
  InsertCodereviewProject,
  InsertCodereviewReview,
  InsertCodereviewResult,
  InsertCodereviewComment,
  InsertCodereviewTemplate,
  CodereviewProject,
  CodereviewReview,
  CodereviewResult,
  CodereviewComment,
  CodereviewTemplate,
} from '../../../shared/schema';

export class CodeReviewService {
  private anthropicService: AnthropicService;

  constructor(private storage: CodeReviewModuleStorage) {
    this.anthropicService = new AnthropicService();
  }

  // Projects
  async createProject(userId: string, project: Omit<InsertCodereviewProject, 'userId'>): Promise<CodereviewProject> {
    return this.storage.createProject({
      ...project,
      userId,
    });
  }

  async getProject(id: string, userId: string): Promise<CodereviewProject | undefined> {
    const project = await this.storage.getProject(id);
    if (project && project.userId === userId) {
      return project;
    }
    return undefined;
  }

  async getUserProjects(userId: string): Promise<CodereviewProject[]> {
    return this.storage.getProjectsByUser(userId);
  }

  async updateProject(
    id: string,
    userId: string,
    updates: Partial<CodereviewProject>
  ): Promise<CodereviewProject | undefined> {
    const project = await this.storage.getProject(id);
    if (project && project.userId === userId) {
      return this.storage.updateProject(id, updates);
    }
    return undefined;
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    const project = await this.storage.getProject(id);
    if (project && project.userId === userId) {
      return this.storage.deleteProject(id);
    }
    return false;
  }

  // Reviews
  async createReview(
    userId: string,
    review: Omit<InsertCodereviewReview, 'userId'>
  ): Promise<{ review: CodereviewReview; result?: CodereviewResult }> {
    // Create the review
    const newReview = await this.storage.createReview({
      ...review,
      userId,
      status: 'pending',
    });

    // If auto-review is enabled, perform the AI review
    if (review.reviewType === 'automated' || review.reviewType === 'scheduled') {
      try {
        await this.storage.updateReview(newReview.id, { status: 'reviewing' });
        
        const reviewResult = await this.performAIReview(newReview);
        
        await this.storage.updateReview(newReview.id, {
          status: 'completed',
          completedAt: new Date(),
        });

        return { review: { ...newReview, status: 'completed' }, result: reviewResult };
      } catch (error) {
        console.error('AI review failed:', error);
        await this.storage.updateReview(newReview.id, { status: 'failed' });
        return { review: { ...newReview, status: 'failed' } };
      }
    }

    return { review: newReview };
  }

  async performReview(reviewId: string, userId: string): Promise<CodereviewResult | undefined> {
    const review = await this.storage.getReview(reviewId);
    if (!review || review.userId !== userId) {
      throw new Error('Review not found or unauthorized');
    }

    if (review.status === 'completed') {
      return this.storage.getResultByReview(reviewId);
    }

    await this.storage.updateReview(reviewId, { status: 'reviewing' });

    try {
      const result = await this.performAIReview(review);
      
      await this.storage.updateReview(reviewId, {
        status: 'completed',
        completedAt: new Date(),
      });

      return result;
    } catch (error) {
      console.error('AI review failed:', error);
      await this.storage.updateReview(reviewId, { status: 'failed' });
      throw error;
    }
  }

  private async performAIReview(review: CodereviewReview): Promise<CodereviewResult> {
    const request: CodeReviewRequest = {
      code: review.codeSnippet,
      language: review.language || undefined,
      title: review.title,
      description: review.description || undefined,
      reviewType: this.mapReviewType(review.reviewType),
    };

    const response = await this.anthropicService.reviewCode(request);

    const result: InsertCodereviewResult = {
      reviewId: review.id,
      overallScore: response.overallScore,
      summary: response.summary,
      issues: response.issues,
      suggestions: response.suggestions,
      securityVulnerabilities: response.securityVulnerabilities,
      performanceIssues: response.performanceIssues,
      bestPractices: response.bestPractices,
      codeComplexity: response.codeComplexity,
      testCoverage: response.testCoverage,
      documentation: response.documentation,
      rawResponse: response.rawResponse,
    };

    return this.storage.createResult(result);
  }

  private mapReviewType(type: string): 'comprehensive' | 'security' | 'performance' | 'best-practices' {
    switch (type) {
      case 'security':
        return 'security';
      case 'performance':
        return 'performance';
      case 'best-practices':
        return 'best-practices';
      default:
        return 'comprehensive';
    }
  }

  async getReview(id: string, userId: string): Promise<CodereviewReview | undefined> {
    const review = await this.storage.getReview(id);
    if (review && review.userId === userId) {
      return review;
    }
    return undefined;
  }

  async getReviewResult(reviewId: string, userId: string): Promise<CodereviewResult | undefined> {
    const review = await this.storage.getReview(reviewId);
    if (review && review.userId === userId) {
      return this.storage.getResultByReview(reviewId);
    }
    return undefined;
  }

  async getProjectReviews(projectId: string, userId: string): Promise<CodereviewReview[]> {
    const project = await this.storage.getProject(projectId);
    if (project && project.userId === userId) {
      return this.storage.getReviewsByProject(projectId);
    }
    return [];
  }

  async getUserReviews(userId: string): Promise<CodereviewReview[]> {
    return this.storage.getReviewsByUser(userId);
  }

  async deleteReview(id: string, userId: string): Promise<boolean> {
    const review = await this.storage.getReview(id);
    if (review && review.userId === userId) {
      return this.storage.deleteReview(id);
    }
    return false;
  }

  // Comments
  async addComment(
    reviewId: string,
    userId: string,
    comment: string,
    isAiGenerated: boolean = false
  ): Promise<CodereviewComment> {
    const review = await this.storage.getReview(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    return this.storage.createComment({
      reviewId,
      userId,
      comment,
      isAiGenerated,
      resolved: false,
    });
  }

  async getReviewComments(reviewId: string): Promise<CodereviewComment[]> {
    return this.storage.getCommentsByReview(reviewId);
  }

  async updateComment(
    id: string,
    userId: string,
    updates: Partial<CodereviewComment>
  ): Promise<CodereviewComment | undefined> {
    // Get the comment first to verify ownership
    const comments = await this.storage.getCommentsByReview(updates.reviewId || '');
    const comment = comments.find(c => c.id === id);
    
    if (comment && comment.userId === userId) {
      return this.storage.updateComment(id, updates);
    }
    return undefined;
  }

  async deleteComment(id: string, userId: string): Promise<boolean> {
    // Note: In a real implementation, you'd verify ownership first
    return this.storage.deleteComment(id);
  }

  // Templates
  async createTemplate(
    userId: string,
    template: Omit<InsertCodereviewTemplate, 'userId'>
  ): Promise<CodereviewTemplate> {
    return this.storage.createTemplate({
      ...template,
      userId,
    });
  }

  async getTemplate(id: string): Promise<CodereviewTemplate | undefined> {
    return this.storage.getTemplate(id);
  }

  async getUserTemplates(userId: string): Promise<CodereviewTemplate[]> {
    return this.storage.getTemplatesByUser(userId);
  }

  async getPublicTemplates(): Promise<CodereviewTemplate[]> {
    return this.storage.getPublicTemplates();
  }

  async updateTemplate(
    id: string,
    userId: string,
    updates: Partial<CodereviewTemplate>
  ): Promise<CodereviewTemplate | undefined> {
    const template = await this.storage.getTemplate(id);
    if (template && template.userId === userId) {
      return this.storage.updateTemplate(id, updates);
    }
    return undefined;
  }

  async deleteTemplate(id: string, userId: string): Promise<boolean> {
    const template = await this.storage.getTemplate(id);
    if (template && template.userId === userId) {
      return this.storage.deleteTemplate(id);
    }
    return false;
  }

  // Statistics
  async getProjectStats(projectId: string, userId: string): Promise<any> {
    const project = await this.storage.getProject(projectId);
    if (project && project.userId === userId) {
      const stats = await this.storage.getReviewStatsByProject(projectId);
      const latestMetric = await this.storage.getLatestMetric(projectId);
      return {
        ...stats,
        latestMetric,
      };
    }
    return null;
  }

  async getUserStats(userId: string): Promise<any> {
    return this.storage.getReviewStatsByUser(userId);
  }

  // AI Helper Methods
  async generateCodeSummary(code: string, language?: string): Promise<string> {
    return this.anthropicService.generateCodeSummary(code, language);
  }

  async suggestImprovements(code: string, language?: string): Promise<string> {
    return this.anthropicService.suggestImprovements(code, language);
  }
}