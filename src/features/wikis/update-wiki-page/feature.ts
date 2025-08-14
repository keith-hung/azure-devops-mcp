import { WebApi } from 'azure-devops-node-api';
import * as azureDevOpsClient from '../../../clients/azure-devops';
import { UpdateWikiPageSchema } from './schema';
import { z } from 'zod';
import { defaultOrg, defaultProject } from '../../../utils/environment';

/**
 * Options for updating a wiki page
 */
export type UpdateWikiPageOptions = z.infer<typeof UpdateWikiPageSchema>;

/**
 * Updates a wiki page in Azure DevOps
 * @param connection - The Azure DevOps WebApi connection
 * @param options - The options for updating the wiki page
 * @returns The updated wiki page
 */
export async function updateWikiPage(
  _connection: WebApi, // TODO: Use this connection for REST API calls
  options: UpdateWikiPageOptions,
) {
  const validatedOptions = UpdateWikiPageSchema.parse(options);

  const { organizationId, projectId, wikiId, pagePath, content, comment } =
    validatedOptions;

  // TODO: Use connection.rest API calls instead of legacy client
  // For now, use the legacy client implementation
  const client = await azureDevOpsClient.getWikiClient({
    organizationId: organizationId ?? defaultOrg,
  });

  // Prepare the wiki page content
  const wikiPageContent = {
    content,
  };

  // Update the wiki page
  const updatedPage = await client.updatePage(
    wikiPageContent,
    projectId ?? defaultProject,
    wikiId,
    pagePath,
    {
      comment: comment ?? undefined,
    },
  );

  return updatedPage;
}
