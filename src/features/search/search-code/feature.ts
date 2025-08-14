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
  SearchCodeOptions,
  CodeSearchRequest,
  CodeSearchResponse,
  CodeSearchResult,
} from '../types';
import { GitVersionType } from 'azure-devops-node-api/interfaces/GitInterfaces';

/**
 * Search for code in Azure DevOps repositories
 *
 * @param connection The Azure DevOps WebApi connection
 * @param options Parameters for searching code
 * @returns Search results with optional file content
 */
export async function searchCode(
  connection: WebApi,
  options: SearchCodeOptions,
): Promise<CodeSearchResponse> {
  try {
    // When includeContent is true, limit results to prevent timeouts
    const top = options.includeContent
      ? Math.min(options.top || 10, 10)
      : options.top;

    // Get the project ID (either provided or default)
    const projectId =
      options.projectId || process.env.AZURE_DEVOPS_DEFAULT_PROJECT;

    if (!projectId) {
      throw new AzureDevOpsValidationError(
        'Project ID is required. Either provide a projectId or set the AZURE_DEVOPS_DEFAULT_PROJECT environment variable.',
      );
    }

    // Prepare the search request
    const searchRequest: CodeSearchRequest = {
      searchText: options.searchText,
      $skip: options.skip,
      $top: top, // Use limited top value when includeContent is true
      filters: {
        Project: [projectId],
        ...(options.filters || {}),
      },
      includeFacets: true,
      includeSnippet: options.includeSnippet,
    };

    // Get the authorization header from the connection
    const authHeader = await getAuthHeaderFromConnection(connection);

    // Extract organization from the connection URL
    const { organization } = extractOrgFromUrl(connection);

    // Make the search API request with the project ID
    const searchUrl = `https://almsearch.dev.azure.com/${organization}/${projectId}/_apis/search/codesearchresults?api-version=7.1`;

    const searchResponse = await axios.post<CodeSearchResponse>(
      searchUrl,
      searchRequest,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      },
    );

    const results = searchResponse.data;

    // If includeContent is true, fetch the content for each result
    if (options.includeContent && results.results.length > 0) {
      await enrichResultsWithContent(connection, results.results);
    }

    return results;
  } catch (error) {
    if (error instanceof AzureDevOpsError) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 404) {
        throw new AzureDevOpsResourceNotFoundError(
          'Repository or project not found',
          { cause: error },
        );
      }
      if (status === 400) {
        throw new AzureDevOpsValidationError(
          'Invalid search parameters',
          error.response?.data,
          { cause: error },
        );
      }
      if (status === 401) {
        throw new AzureDevOpsAuthenticationError('Authentication failed', {
          cause: error,
        });
      }
      if (status === 403) {
        throw new AzureDevOpsPermissionError(
          'Permission denied to access repository',
          { cause: error },
        );
      }
    }

    throw new AzureDevOpsError('Failed to search code', { cause: error });
  }
}

/**
 * Extract organization from the connection URL
 *
 * @param connection The Azure DevOps WebApi connection
 * @returns The organization
 */
function extractOrgFromUrl(connection: WebApi): { organization: string } {
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

/**
 * Enrich search results with file content
 *
 * @param connection The Azure DevOps WebApi connection
 * @param results The search results to enrich
 */
async function enrichResultsWithContent(
  connection: WebApi,
  results: CodeSearchResult[],
): Promise<void> {
  try {
    const gitApi = await connection.getGitApi();

    // Process each result in parallel
    await Promise.all(
      results.map(async (result) => {
        try {
          // Get the file content using the Git API
          // Pass only the required parameters to avoid the "path" and "scopePath" conflict
          const contentStream = await gitApi.getItemContent(
            result.repository.id,
            result.path,
            result.project.name,
            undefined, // No version descriptor object
            undefined, // No recursion level
            undefined, // Don't include content metadata
            undefined, // No latest processed change
            false, // Don't download
            {
              version: result.versions[0]?.changeId,
              versionType: GitVersionType.Commit,
            }, // Version descriptor
            true, // Include content
          );

          // Convert the stream to a string and store it in the result
          if (contentStream) {
            // Since getItemContent always returns NodeJS.ReadableStream, we need to read the stream
            const chunks: Buffer[] = [];

            // Listen for data events to collect chunks
            contentStream.on('data', (chunk) => {
              chunks.push(Buffer.from(chunk));
            });

            // Use a promise to wait for the stream to finish
            result.content = await new Promise<string>((resolve, reject) => {
              contentStream.on('end', () => {
                // Concatenate all chunks and convert to string
                const buffer = Buffer.concat(chunks);
                resolve(buffer.toString('utf8'));
              });

              contentStream.on('error', (err) => {
                reject(err);
              });
            });
          }
        } catch (error) {
          // Log the error but don't fail the entire operation
          console.error(
            `Failed to fetch content for ${result.path}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    );
  } catch (error) {
    // Log the error but don't fail the entire operation
    console.error(
      `Failed to enrich results with content: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
