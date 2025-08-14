import axios from 'axios';
import { WebApi } from 'azure-devops-node-api';
import {
  AzureDevOpsAuthenticationError,
  AzureDevOpsError,
} from '../../../shared/errors';
import { Organization } from '../types';

/**
 * Lists all Azure DevOps organizations accessible to the authenticated user
 *
 * Note: This function uses Axios directly rather than the Azure DevOps Node API
 * because the WebApi client doesn't support the organizations endpoint.
 * It extracts authentication information from the existing WebApi connection.
 *
 * @param connection The Azure DevOps WebApi connection
 * @returns Array of organizations
 * @throws {AzureDevOpsAuthenticationError} If authentication fails
 */
export async function listOrganizations(
  connection: WebApi,
): Promise<Organization[]> {
  try {
    // Extract authorization header from the WebApi connection
    // This function uses the internal connection details to get the auth header
    const authHeader = await getAuthHeaderFromConnection(connection);

    // Step 1: Get the user profile to get the publicAlias
    const profileResponse = await axios.get(
      'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=6.0',
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      },
    );

    // Extract the publicAlias
    const publicAlias = profileResponse.data.publicAlias;
    if (!publicAlias) {
      throw new AzureDevOpsAuthenticationError(
        'Unable to get user publicAlias from profile',
      );
    }

    // Step 2: Get organizations using the publicAlias
    const orgsResponse = await axios.get(
      `https://app.vssps.visualstudio.com/_apis/accounts?memberId=${publicAlias}&api-version=6.0`,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      },
    );

    // Define the shape of the API response
    interface AzureDevOpsOrganization {
      accountId: string;
      accountName: string;
      accountUri: string;
    }

    // Transform the response
    return orgsResponse.data.value.map((org: AzureDevOpsOrganization) => ({
      id: org.accountId,
      name: org.accountName,
      url: org.accountUri,
    }));
  } catch (error) {
    // Handle profile API errors as authentication errors
    if (axios.isAxiosError(error) && error.config?.url?.includes('profile')) {
      throw new AzureDevOpsAuthenticationError(
        `Authentication failed: ${error.toJSON()}`,
      );
    } else if (
      error instanceof Error &&
      (error.message.includes('profile') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Authentication'))
    ) {
      throw new AzureDevOpsAuthenticationError(
        `Authentication failed: ${error.message}`,
      );
    }

    if (error instanceof AzureDevOpsError) {
      throw error;
    }

    throw new AzureDevOpsAuthenticationError(
      `Failed to list organizations: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Extracts authorization header from WebApi connection
 * This is a workaround since the organizations endpoint is not available in the Azure DevOps Node API
 *
 * @param connection The WebApi connection
 * @returns Authorization header value
 */
async function getAuthHeaderFromConnection(
  connection: WebApi,
): Promise<string> {
  try {
    // Access the internal authentication handler from the connection
    // This is a workaround to get the auth header for direct API calls
    const authHandler = (connection as any).authHandler;

    if (!authHandler) {
      throw new AzureDevOpsAuthenticationError(
        'Unable to extract authentication information from connection',
      );
    }

    // Get the organization URL from the connection
    const serverUrl =
      (connection as any).serverUrl || (connection as any).baseUrl;

    if (!serverUrl) {
      throw new AzureDevOpsAuthenticationError(
        'Unable to determine server URL from connection',
      );
    }

    // For PAT authentication, create Basic Auth header
    if (authHandler.token) {
      return createBasicAuthHeader(authHandler.token);
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
 * Creates a Basic Auth header for the Azure DevOps API
 *
 * @param pat Personal Access Token
 * @returns Basic Auth header value
 */
function createBasicAuthHeader(pat: string): string {
  const token = Buffer.from(`:${pat}`).toString('base64');
  return `Basic ${token}`;
}
