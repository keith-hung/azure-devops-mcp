import { z } from 'zod';
import { defaultProject, defaultOrg } from '../../../utils/environment';

/**
 * Schema for listing pull requests by project (across all repositories)
 */
export const ListPullRequestsByProjectSchema = z.object({
  projectId: z
    .string()
    .optional()
    .describe(`The ID or name of the project (Default: ${defaultProject})`),
  organizationId: z
    .string()
    .optional()
    .describe(`The ID or name of the organization (Default: ${defaultOrg})`),
  status: z
    .enum(['all', 'active', 'completed', 'abandoned'])
    .optional()
    .describe('Filter by pull request status'),
  creatorId: z
    .string()
    .optional()
    .describe('Filter by creator ID (must be a UUID string)'),
  reviewerId: z
    .string()
    .optional()
    .describe('Filter by reviewer ID (must be a UUID string)'),
  sourceRefName: z.string().optional().describe('Filter by source branch name'),
  targetRefName: z.string().optional().describe('Filter by target branch name'),
  top: z
    .number()
    .default(10)
    .describe('Maximum number of pull requests to return (default: 10)'),
  skip: z
    .number()
    .optional()
    .describe('Number of pull requests to skip for pagination'),
});
