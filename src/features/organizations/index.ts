// Re-export schemas and types
export * from './schemas';
export * from './types';

// Re-export features
export * from './list-organizations';

// Export tool definitions
export * from './tool-definitions';

import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { WebApi } from 'azure-devops-node-api';
import {
  RequestIdentifier,
  RequestHandler,
} from '../../shared/types/request-handler';
import { listOrganizations } from './list-organizations';

/**
 * Checks if the request is for the organizations feature
 */
export const isOrganizationsRequest: RequestIdentifier = (
  request: CallToolRequest,
): boolean => {
  const toolName = request.params.name;
  return ['list_organizations'].includes(toolName);
};

/**
 * Handles organizations feature requests
 */
export const handleOrganizationsRequest: RequestHandler = async (
  connection: WebApi,
  request: CallToolRequest,
): Promise<{ content: Array<{ type: string; text: string }> }> => {
  switch (request.params.name) {
    case 'list_organizations': {
      const result = await listOrganizations(connection);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
    default:
      throw new Error(`Unknown organizations tool: ${request.params.name}`);
  }
};
