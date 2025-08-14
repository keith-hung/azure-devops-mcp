import { WebApi } from 'azure-devops-node-api';
import { AzureDevOpsError } from '../../../shared/errors';
import { ListPullRequestsByProjectOptions, PullRequest } from '../types';
import {
  GitPullRequestSearchCriteria,
  PullRequestStatus,
} from 'azure-devops-node-api/interfaces/GitInterfaces';

/**
 * List pull requests by project (across all repositories in the project)
 *
 * @param connection The Azure DevOps WebApi connection
 * @param projectId The ID or name of the project
 * @param options Options for filtering pull requests
 * @returns Object containing pull requests array and pagination metadata
 */
export async function listPullRequestsByProject(
  connection: WebApi,
  projectId: string,
  options: ListPullRequestsByProjectOptions,
): Promise<{
  count: number;
  value: PullRequest[];
  hasMoreResults: boolean;
  warning?: string;
}> {
  try {
    const gitApi = await connection.getGitApi();

    // First get all repositories in the project
    const repositories = await gitApi.getRepositories(projectId);

    if (!repositories || repositories.length === 0) {
      return {
        count: 0,
        value: [],
        hasMoreResults: false,
        warning: 'No repositories found in the project',
      };
    }

    // Create search criteria
    const searchCriteria: GitPullRequestSearchCriteria = {};

    // Add filters if provided
    if (options.status && options.status !== 'all') {
      // Map our status enum to Azure DevOps PullRequestStatus
      switch (options.status) {
        case 'active':
          searchCriteria.status = PullRequestStatus.Active;
          break;
        case 'abandoned':
          searchCriteria.status = PullRequestStatus.Abandoned;
          break;
        case 'completed':
          searchCriteria.status = PullRequestStatus.Completed;
          break;
      }
    }

    if (options.creatorId) {
      searchCriteria.creatorId = options.creatorId;
    }

    if (options.reviewerId) {
      searchCriteria.reviewerId = options.reviewerId;
    }

    if (options.sourceRefName) {
      searchCriteria.sourceRefName = options.sourceRefName;
    }

    if (options.targetRefName) {
      searchCriteria.targetRefName = options.targetRefName;
    }

    // Set pagination parameters
    const top = options.top ?? 10;
    const skip = options.skip ?? 0;

    // Collect PRs from all repositories
    const allPullRequests: PullRequest[] = [];
    let totalSkipped = 0;

    for (const repository of repositories) {
      if (!repository.id) {
        continue;
      }

      try {
        // Calculate how many to skip and take from this repository
        const remainingSkip = Math.max(0, skip - totalSkipped);
        const remainingTop = Math.max(0, top - allPullRequests.length);

        if (remainingTop <= 0) {
          break; // We've collected enough PRs
        }

        // Get PRs from this repository
        const repoPullRequests = await gitApi.getPullRequests(
          repository.id,
          searchCriteria,
          projectId,
          undefined, // maxCommentLength
          remainingSkip,
          remainingTop * 2, // Get more to account for filtering across repos
        );

        if (repoPullRequests && repoPullRequests.length > 0) {
          // Add PRs from this repository
          const prsToAdd = repoPullRequests.slice(0, remainingTop);
          allPullRequests.push(...prsToAdd);
          totalSkipped += Math.min(remainingSkip, repoPullRequests.length);
        }
      } catch (repoError) {
        // Log repository-specific errors but continue with other repositories
        console.warn(
          `Failed to get PRs from repository ${repository.name}: ${repoError}`,
        );
      }
    }

    // Sort by creation date (newest first) to provide consistent ordering across repositories
    allPullRequests.sort((a, b) => {
      const aDate = a.creationDate ? new Date(a.creationDate).getTime() : 0;
      const bDate = b.creationDate ? new Date(b.creationDate).getTime() : 0;
      return bDate - aDate;
    });

    // Trim to requested size
    const results = allPullRequests.slice(0, top);
    const count = results.length;

    // Determine if there are likely more results
    const hasMoreResults = allPullRequests.length > top || count === top;

    // Add a warning message if results were truncated
    let warning: string | undefined;
    if (hasMoreResults) {
      warning = `Results limited to ${top} items. Use 'skip: ${skip + top}' to get the next page.`;
    }

    return {
      count,
      value: results,
      hasMoreResults,
      warning,
    };
  } catch (error) {
    if (error instanceof AzureDevOpsError) {
      throw error;
    }
    throw new Error(
      `Failed to list pull requests by project: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
