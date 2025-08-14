import { BasicCredentialHandler } from 'azure-devops-node-api/handlers/basiccreds';
import {
  IRequestHandler,
  IHttpClient,
  IRequestInfo,
  IHttpClientResponse,
} from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces';

/**
 * Authentication handler for username/password basic authentication
 * This is designed for TFS/Azure DevOps Server on-premises environments
 * where Personal Access Tokens may not be available or properly configured
 */
export class UsernamePasswordAuthHandler
  extends BasicCredentialHandler
  implements IRequestHandler
{
  /**
   * Creates a new username/password authentication handler
   *
   * @param username The username (may include domain, e.g., DOMAIN\username)
   * @param password The password for the user
   * @param allowCrossOriginAuthentication Whether to allow cross-origin authentication
   */
  constructor(
    username: string,
    password: string,
    allowCrossOriginAuthentication?: boolean,
  ) {
    super(username, password, allowCrossOriginAuthentication);
  }

  /**
   * Handles authentication for HTTP requests
   * This method is inherited from BasicCredentialHandler and delegates to the parent implementation
   *
   * @param httpClient The HTTP client
   * @param requestInfo The request information
   * @param objs Additional objects
   * @returns Promise resolving to HTTP client response
   */
  public async handleAuthentication(
    httpClient: IHttpClient,
    requestInfo: IRequestInfo,
    objs: Record<string, unknown>,
  ): Promise<IHttpClientResponse> {
    // Delegate to the parent BasicCredentialHandler implementation
    return super.handleAuthentication(httpClient, requestInfo, objs);
  }
}
