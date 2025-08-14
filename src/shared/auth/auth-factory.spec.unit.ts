import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  createAuthClient,
  AuthenticationMethod,
  AuthConfig,
} from './auth-factory';
import { AzureDevOpsAuthenticationError } from '../errors';

// Mock the external dependencies
jest.mock('azure-devops-node-api');
jest.mock('azure-devops-node-api/handlers/bearertoken');
jest.mock('@azure/identity');
jest.mock('./username-password-auth-handler');

const mockWebApi = {
  getLocationsApi: jest.fn(),
} as any;

const mockLocationsApi = {
  getResourceAreas: jest.fn(),
} as any;

// Mock the azure-devops-node-api module
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAzureDevOpsApi = require('azure-devops-node-api');
const mockWebApiConstructor =
  mockAzureDevOpsApi.WebApi as jest.MockedClass<any>;
const mockGetPersonalAccessTokenHandler =
  mockAzureDevOpsApi.getPersonalAccessTokenHandler as jest.MockedFunction<any>;

describe('AuthFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockWebApiConstructor.mockImplementation(() => mockWebApi);
    mockWebApi.getLocationsApi.mockResolvedValue(mockLocationsApi);
    mockLocationsApi.getResourceAreas.mockResolvedValue([]);
    mockGetPersonalAccessTokenHandler.mockReturnValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createAuthClient', () => {
    it('should throw error if organization URL is missing', async () => {
      const config: AuthConfig = {
        method: AuthenticationMethod.PersonalAccessToken,
        organizationUrl: '',
      };

      await expect(createAuthClient(config)).rejects.toThrow(
        AzureDevOpsAuthenticationError,
      );
      await expect(createAuthClient(config)).rejects.toThrow(
        'Organization URL is required',
      );
    });

    it('should create PAT client successfully', async () => {
      const config: AuthConfig = {
        method: AuthenticationMethod.PersonalAccessToken,
        organizationUrl: 'https://dev.azure.com/test',
        personalAccessToken: 'test-pat-token',
      };

      const result = await createAuthClient(config);

      expect(result).toBe(mockWebApi);
      expect(mockGetPersonalAccessTokenHandler).toHaveBeenCalledWith(
        'test-pat-token',
      );
      expect(mockWebApiConstructor).toHaveBeenCalledWith(
        'https://dev.azure.com/test',
        expect.any(Object),
      );
    });

    it('should create username/password client successfully', async () => {
      const {
        UsernamePasswordAuthHandler,
        // eslint-disable-next-line @typescript-eslint/no-require-imports
      } = require('./username-password-auth-handler');
      const mockUsernamePasswordAuthHandler =
        UsernamePasswordAuthHandler as jest.MockedClass<any>;

      const config: AuthConfig = {
        method: AuthenticationMethod.UsernamePassword,
        organizationUrl: 'https://tfs.company.com/tfs/DefaultCollection',
        username: 'DOMAIN\\testuser',
        password: 'testpassword',
      };

      const result = await createAuthClient(config);

      expect(result).toBe(mockWebApi);
      expect(mockUsernamePasswordAuthHandler).toHaveBeenCalledWith(
        'DOMAIN\\testuser',
        'testpassword',
      );
      expect(mockWebApiConstructor).toHaveBeenCalledWith(
        'https://tfs.company.com/tfs/DefaultCollection',
        expect.any(Object),
      );
    });

    it('should throw error for username/password auth without username', async () => {
      const config: AuthConfig = {
        method: AuthenticationMethod.UsernamePassword,
        organizationUrl: 'https://tfs.company.com/tfs/DefaultCollection',
        password: 'testpassword',
      };

      await expect(createAuthClient(config)).rejects.toThrow(
        AzureDevOpsAuthenticationError,
      );
      await expect(createAuthClient(config)).rejects.toThrow(
        'Username and password are required for username-password authentication',
      );
    });

    it('should throw error for username/password auth without password', async () => {
      const config: AuthConfig = {
        method: AuthenticationMethod.UsernamePassword,
        organizationUrl: 'https://tfs.company.com/tfs/DefaultCollection',
        username: 'DOMAIN\\testuser',
      };

      await expect(createAuthClient(config)).rejects.toThrow(
        AzureDevOpsAuthenticationError,
      );
      await expect(createAuthClient(config)).rejects.toThrow(
        'Username and password are required for username-password authentication',
      );
    });

    it('should throw error for PAT auth without token', async () => {
      const config: AuthConfig = {
        method: AuthenticationMethod.PersonalAccessToken,
        organizationUrl: 'https://dev.azure.com/test',
      };

      await expect(createAuthClient(config)).rejects.toThrow(
        AzureDevOpsAuthenticationError,
      );
      await expect(createAuthClient(config)).rejects.toThrow(
        'Personal Access Token is required',
      );
    });

    it('should throw error for unsupported authentication method', async () => {
      const config: AuthConfig = {
        method: 'unsupported-method' as AuthenticationMethod,
        organizationUrl: 'https://dev.azure.com/test',
      };

      await expect(createAuthClient(config)).rejects.toThrow(
        AzureDevOpsAuthenticationError,
      );
      await expect(createAuthClient(config)).rejects.toThrow(
        'Unsupported authentication method',
      );
    });

    it('should test connection by calling getResourceAreas', async () => {
      const config: AuthConfig = {
        method: AuthenticationMethod.PersonalAccessToken,
        organizationUrl: 'https://dev.azure.com/test',
        personalAccessToken: 'test-pat-token',
      };

      await createAuthClient(config);

      expect(mockWebApi.getLocationsApi).toHaveBeenCalled();
      expect(mockLocationsApi.getResourceAreas).toHaveBeenCalled();
    });

    it('should wrap non-AzureDevOpsAuthenticationError in AzureDevOpsAuthenticationError', async () => {
      const config: AuthConfig = {
        method: AuthenticationMethod.PersonalAccessToken,
        organizationUrl: 'https://dev.azure.com/test',
        personalAccessToken: 'test-pat-token',
      };

      mockLocationsApi.getResourceAreas.mockRejectedValue(
        new Error('Network error'),
      );

      await expect(createAuthClient(config)).rejects.toThrow(
        AzureDevOpsAuthenticationError,
      );
      await expect(createAuthClient(config)).rejects.toThrow(
        'Failed to authenticate with Azure DevOps: Network error',
      );
    });
  });
});
