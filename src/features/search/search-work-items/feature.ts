import { WebApi } from 'azure-devops-node-api';
import axios from 'axios';
import {
  AzureDevOpsError,
  AzureDevOpsResourceNotFoundError,
  AzureDevOpsValidationError,
  AzureDevOpsPermissionError,
  AzureDevOpsAuthenticationError,
} from '../../../shared/errors';
import {
  SearchWorkItemsOptions,
  WorkItemSearchRequest,
  WorkItemSearchResponse,
} from '../types';

/**
 * Search for work items in Azure DevOps projects
 *
 * @param connection The Azure DevOps WebApi connection
 * @param options Parameters for searching work items
 * @returns Search results with work item details and highlights
 */
export async function searchWorkItems(
  connection: WebApi,
  options: SearchWorkItemsOptions,
): Promise<WorkItemSearchResponse> {
  try {
    // Prepare the search request
    const searchRequest: WorkItemSearchRequest = {
      searchText: options.searchText,
      $skip: options.skip,
      $top: options.top,
      filters: {
        ...(options.projectId
          ? { 'System.TeamProject': [options.projectId] }
          : {}),
        ...options.filters,
      },
      includeFacets: options.includeFacets,
      $orderBy: options.orderBy,
    };

    // Get the authorization header from the connection
    const authHeader = await getAuthHeaderFromConnection(connection);

    // Extract organization and project from the connection URL
    const { organization, project } = extractOrgAndProject(
      connection,
      options.projectId,
    );

    // Make the search API request
    // If projectId is provided, include it in the URL, otherwise perform organization-wide search
    const searchUrl = options.projectId
      ? `https://almsearch.dev.azure.com/${organization}/${project}/_apis/search/workitemsearchresults?api-version=7.1`
      : `https://almsearch.dev.azure.com/${organization}/_apis/search/workitemsearchresults?api-version=7.1`;

    const searchResponse = await axios.post<WorkItemSearchResponse>(
      searchUrl,
      searchRequest,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      },
    );

    return searchResponse.data;
  } catch (error) {
    // If it's already an AzureDevOpsError, rethrow it
    if (error instanceof AzureDevOpsError) {
      throw error;
    }

    // Handle axios errors
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (status === 404) {
        throw new AzureDevOpsResourceNotFoundError(
          `Resource not found: ${message}`,
        );
      } else if (status === 400) {
        throw new AzureDevOpsValidationError(
          `Invalid request: ${message}`,
          error.response?.data,
        );
      } else if (status === 401 || status === 403) {
        throw new AzureDevOpsPermissionError(`Permission denied: ${message}`);
      } else {
        // For other axios errors, wrap in a generic AzureDevOpsError
        throw new AzureDevOpsError(`Azure DevOps API error: ${message}`);
      }
      // This code is unreachable but TypeScript doesn't know that
    }

    // Otherwise, wrap it in a generic error
    throw new AzureDevOpsError(
      `Failed to search work items: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Extract organization and project from the connection URL
 *
 * @param connection The Azure DevOps WebApi connection
 * @param projectId The project ID or name (optional)
 * @returns The organization and project
 */
function extractOrgAndProject(
  connection: WebApi,
  projectId?: string,
): { organization: string; project: string } {
  // Extract organization from the connection URL
  const url = connection.serverUrl;
  const match = url.match(/https?:\/\/dev\.azure\.com\/([^/]+)/);
  const organization = match ? match[1] : '';

  if (!organization) {
    throw new AzureDevOpsValidationError(
      'Could not extract organization from connection URL',
    );
  }

  return {
    organization,
    project: projectId || '',
  };
}

/**
 * Extracts authorization header from WebApi connection
 * This is a workaround since search APIs require direct HTTP calls
 *
 * @param connection The WebApi connection
 * @returns Authorization header value
 */
async function getAuthHeaderFromConnection(
  connection: WebApi,
): Promise<string> {
  try {
    // Access the internal authentication handler from the connection
    const authHandler = (connection as any).authHandler;

    if (!authHandler) {
      throw new AzureDevOpsAuthenticationError(
        'Unable to extract authentication information from connection',
      );
    }

    // For PAT authentication, create Basic Auth header
    if (authHandler.token) {
      const base64Token = Buffer.from(`:${authHandler.token}`).toString(
        'base64',
      );
      return `Basic ${base64Token}`;
    }

    // For bearer token authentication
    if (authHandler.accessToken) {
      return `Bearer ${authHandler.accessToken}`;
    }

    // For username/password authentication, create Basic Auth header
    if (authHandler.username && authHandler.password) {
      const credentials = Buffer.from(
        `${authHandler.username}:${authHandler.password}`,
      ).toString('base64');
      return `Basic ${credentials}`;
    }

    throw new AzureDevOpsAuthenticationError(
      'Unable to determine authentication method from connection',
    );
  } catch (error) {
    if (error instanceof AzureDevOpsAuthenticationError) {
      throw error;
    }
    throw new AzureDevOpsAuthenticationError(
      `Failed to extract authentication from connection: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
