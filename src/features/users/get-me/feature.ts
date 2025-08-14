import { WebApi } from 'azure-devops-node-api';
import axios from 'axios';
import {
  AzureDevOpsError,
  AzureDevOpsAuthenticationError,
  AzureDevOpsValidationError,
} from '../../../shared/errors';
import { UserProfile } from '../types';

/**
 * Get details of the currently authenticated user
 *
 * This function returns basic profile information about the authenticated user.
 *
 * @param connection The Azure DevOps WebApi connection
 * @returns User profile information including id, displayName, and email
 * @throws {AzureDevOpsError} If retrieval of user information fails
 */
export async function getMe(connection: WebApi): Promise<UserProfile> {
  try {
    // Extract organization from the connection URL
    const { organization } = extractOrgFromUrl(connection.serverUrl);

    // Get the authorization header
    const authHeader = await getAuthHeaderFromConnection(connection);

    // Make direct call to the Profile API endpoint
    // Note: This API is in the vssps.dev.azure.com domain, not dev.azure.com
    const response = await axios.get(
      `https://vssps.dev.azure.com/${organization}/_apis/profile/profiles/me?api-version=7.1`,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      },
    );

    const profile = response.data;

    // Return the user profile with required fields
    return {
      id: profile.id,
      displayName: profile.displayName || '',
      email: profile.emailAddress || '',
    };
  } catch (error) {
    // Handle authentication errors
    if (
      axios.isAxiosError(error) &&
      (error.response?.status === 401 || error.response?.status === 403)
    ) {
      throw new AzureDevOpsAuthenticationError(
        `Authentication failed: ${error.message}`,
      );
    }

    // If it's already an AzureDevOpsError, rethrow it
    if (error instanceof AzureDevOpsError) {
      throw error;
    }

    // Otherwise, wrap it in a generic error
    throw new AzureDevOpsError(
      `Failed to get user information: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Extract organization from the Azure DevOps URL
 *
 * @param url The Azure DevOps URL
 * @returns The organization
 */
function extractOrgFromUrl(url: string): { organization: string } {
  // First try modern dev.azure.com format
  let match = url.match(/https?:\/\/dev\.azure\.com\/([^/]+)/);

  // If not found, try legacy visualstudio.com format
  if (!match) {
    match = url.match(/https?:\/\/([^.]+)\.visualstudio\.com/);
  }

  // Fallback: capture the first path segment for any URL
  if (!match) {
    match = url.match(/https?:\/\/[^/]+\/([^/]+)/);
  }

  const organization = match ? match[1] : '';

  if (!organization) {
    throw new AzureDevOpsValidationError(
      'Could not extract organization from URL',
    );
  }

  return {
    organization,
  };
}

/**
 * Extracts authorization header from WebApi connection
 * This is a workaround since user profile API requires direct HTTP calls
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
