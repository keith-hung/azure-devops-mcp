import { describe, it, expect, beforeEach } from '@jest/globals';
import { UsernamePasswordAuthHandler } from './username-password-auth-handler';

describe('UsernamePasswordAuthHandler', () => {
  let authHandler: UsernamePasswordAuthHandler;
  const testUsername = 'DOMAIN\\testuser';
  const testPassword = 'testpassword';

  beforeEach(() => {
    authHandler = new UsernamePasswordAuthHandler(testUsername, testPassword);
  });

  describe('constructor', () => {
    it('should create instance with username and password', () => {
      expect(authHandler).toBeInstanceOf(UsernamePasswordAuthHandler);
    });

    it('should inherit from BasicCredentialHandler correctly', () => {
      // Check that it extends BasicCredentialHandler
      expect(authHandler).toBeInstanceOf(UsernamePasswordAuthHandler);
      expect(
        Object.getPrototypeOf(Object.getPrototypeOf(authHandler)).constructor
          .name,
      ).toBe('BasicCredentialHandler');
    });

    it('should create instance with allowCrossOriginAuthentication option', () => {
      const handlerWithCrossOrigin = new UsernamePasswordAuthHandler(
        testUsername,
        testPassword,
        true,
      );
      expect(handlerWithCrossOrigin).toBeInstanceOf(
        UsernamePasswordAuthHandler,
      );
    });
  });

  describe('handleAuthentication', () => {
    it('should handle authentication without throwing', async () => {
      const mockHttpClient = {} as any;
      const mockRequestInfo = {} as any;
      const mockObjs = {} as any;

      // Mock the parent's handleAuthentication method
      const mockParentHandleAuth = jest.fn().mockResolvedValue({});
      (authHandler as any).__proto__.__proto__.handleAuthentication =
        mockParentHandleAuth;

      await expect(
        authHandler.handleAuthentication(
          mockHttpClient,
          mockRequestInfo,
          mockObjs,
        ),
      ).resolves.not.toThrow();

      expect(mockParentHandleAuth).toHaveBeenCalledWith(
        mockHttpClient,
        mockRequestInfo,
        mockObjs,
      );
    });
  });

  describe('inheritance', () => {
    it('should extend BasicCredentialHandler', () => {
      // Check that it has the expected methods from BasicCredentialHandler
      expect(typeof authHandler.prepareRequest).toBe('function');
      expect(typeof authHandler.canHandleAuthentication).toBe('function');
    });
  });
});
