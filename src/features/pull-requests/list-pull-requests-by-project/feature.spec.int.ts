import { WebApi } from 'azure-devops-node-api';
import { listPullRequestsByProject } from './feature';

import {
  getTestConnection,
  shouldSkipIntegrationTest,
} from '../../../shared/test/test-helpers';

describe('listPullRequestsByProject integration', () => {
  let connection: WebApi | null = null;
  let projectName: string;

  beforeAll(async () => {
    // Get a real connection using environment variables
    connection = await getTestConnection();

    // Set up project name from environment
    projectName = process.env.AZURE_DEVOPS_DEFAULT_PROJECT || 'DefaultProject';
  });

  beforeEach(() => {
    if (shouldSkipIntegrationTest()) {
      return;
    }

    if (!connection) {
      throw new Error('No connection available for integration test');
    }
  });

  test('should list pull requests by project successfully', async () => {
    if (shouldSkipIntegrationTest() || !connection) {
      console.log('Skipping integration test');
      return;
    }

    const result = await listPullRequestsByProject(connection, projectName, {
      projectId: projectName,
      status: 'all',
      top: 5,
    });

    // Verify response structure
    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('value');
    expect(result).toHaveProperty('hasMoreResults');
    expect(typeof result.count).toBe('number');
    expect(Array.isArray(result.value)).toBe(true);
    expect(typeof result.hasMoreResults).toBe('boolean');

    // If there are pull requests, verify structure
    if (result.count > 0) {
      const firstPR = result.value[0];
      expect(firstPR).toHaveProperty('pullRequestId');
      expect(firstPR).toHaveProperty('title');
      expect(firstPR).toHaveProperty('repository'); // Should include repository info
      expect(typeof firstPR.pullRequestId).toBe('number');
      expect(typeof firstPR.title).toBe('string');
    }

    console.log(
      `Found ${result.count} pull requests across all repositories in project ${projectName}`,
    );
  });

  test('should filter pull requests by status', async () => {
    if (shouldSkipIntegrationTest() || !connection) {
      console.log('Skipping integration test');
      return;
    }

    // Test with active status
    const activeResult = await listPullRequestsByProject(
      connection,
      projectName,
      {
        projectId: projectName,
        status: 'active',
        top: 10,
      },
    );

    expect(activeResult).toHaveProperty('count');
    expect(activeResult).toHaveProperty('value');
    expect(Array.isArray(activeResult.value)).toBe(true);

    // If there are active PRs, verify they are active
    if (activeResult.count > 0) {
      activeResult.value.forEach((pr: { status?: number }) => {
        // Active PRs should have status = 1 (Active)
        expect(pr.status).toBe(1);
      });
    }

    console.log(
      `Found ${activeResult.count} active pull requests in project ${projectName}`,
    );
  });

  test('should handle pagination correctly', async () => {
    if (shouldSkipIntegrationTest() || !connection) {
      console.log('Skipping integration test');
      return;
    }

    // Test with small page size to trigger pagination logic
    const result = await listPullRequestsByProject(connection, projectName, {
      projectId: projectName,
      top: 2,
      skip: 0,
    });

    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('hasMoreResults');

    // If we got exactly 2 results, hasMoreResults should be true
    if (result.count === 2) {
      expect(result.hasMoreResults).toBe(true);
      expect(result.warning).toContain('Results limited to 2 items');
    }

    console.log(
      `Pagination test: ${result.count} results, hasMoreResults: ${result.hasMoreResults}`,
    );
  });

  test('should handle empty results gracefully', async () => {
    if (shouldSkipIntegrationTest() || !connection) {
      console.log('Skipping integration test');
      return;
    }

    // Try to find PRs with a very specific filter that likely returns no results
    const result = await listPullRequestsByProject(connection, projectName, {
      projectId: projectName,
      status: 'abandoned',
      sourceRefName: 'refs/heads/very-unlikely-branch-name-' + Date.now(),
      top: 10,
    });

    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('value');
    expect(result.count).toBe(0);
    expect(result.value).toHaveLength(0);
    expect(result.hasMoreResults).toBe(false);

    console.log('Empty results test passed');
  });

  test('should handle invalid project gracefully', async () => {
    if (shouldSkipIntegrationTest() || !connection) {
      console.log('Skipping integration test');
      return;
    }

    const invalidProjectName = 'NonExistentProject-' + Date.now();

    await expect(
      listPullRequestsByProject(connection, invalidProjectName, {
        projectId: invalidProjectName,
        top: 5,
      }),
    ).rejects.toThrow();

    console.log('Invalid project test passed');
  });
});
