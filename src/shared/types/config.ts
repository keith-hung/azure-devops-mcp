import { AuthenticationMethod } from '../auth/auth-factory';

/**
 * Azure DevOps configuration type definition
 */
export interface AzureDevOpsConfig {
  /**
   * The Azure DevOps organization URL (e.g., https://dev.azure.com/organization)
   */
  organizationUrl: string;

  /**
   * Authentication method to use (pat, username-password, azure-identity, azure-cli)
   * @default 'azure-identity'
   */
  authMethod?: AuthenticationMethod;

  /**
   * Personal Access Token for authentication (required for PAT authentication)
   */
  personalAccessToken?: string;

  /**
   * Username for basic authentication (required for username-password authentication)
   * For TFS/Azure DevOps Server on-premises, this may include domain (e.g., DOMAIN\username)
   */
  username?: string;

  /**
   * Password for basic authentication (required for username-password authentication)
   */
  password?: string;

  /**
   * Optional default project to use when not specified
   */
  defaultProject?: string;

  /**
   * Optional API version to use (defaults to latest)
   */
  apiVersion?: string;
}
