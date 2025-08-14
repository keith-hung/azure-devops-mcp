import { listPullRequestsByProject } from './feature';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('listPullRequestsByProject', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.resetAllMocks();

    // Set default environment variables
    process.env.AZURE_DEVOPS_API_VERSION = '3.2';
    process.env.AZURE_DEVOPS_ORG_URL = 'https://tfs.cybersoft.tw:8081/tfs/SDD';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should return pull requests successfully with pagination metadata', async () => {
    // Mock data
    const mockPullRequests = [
      {
        pullRequestId: 1,
        title: 'Test PR 1',
        description: 'Test PR description 1',
        repository: {
          id: 'repo1',
          name: 'TestRepo1',
        },
      },
      {
        pullRequestId: 2,
        title: 'Test PR 2',
        description: 'Test PR description 2',
        repository: {
          id: 'repo2',
          name: 'TestRepo2',
        },
      },
    ];

    // Mock axios response
    mockedAxios.get.mockResolvedValue({
      data: { value: mockPullRequests },
    });

    // Setup mock connection with auth handler
    const mockConnection: any = {
      serverUrl: 'https://tfs.cybersoft.tw:8081/tfs/SDD',
      authHandler: {
        prepareRequest: jest.fn().mockImplementation((_options, request) => {
          request.headers.Authorization = 'Basic dGVzdDp0ZXN0';
        }),
      },
    };

    // Execute function
    const result = await listPullRequestsByProject(
      mockConnection,
      'test-project',
      {
        projectId: 'test-project',
        status: 'active',
        top: 10,
        skip: 0,
      },
    );

    // Verify results
    expect(result).toEqual({
      count: 2,
      value: mockPullRequests,
      hasMoreResults: false,
    });

    // Verify axios was called correctly
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://tfs.cybersoft.tw:8081/tfs/SDD/test-project/_apis/git/pullRequests',
      {
        params: {
          'api-version': '3.2',
          'searchCriteria.status': '1',
          $top: '10',
        },
        headers: {
          Authorization: 'Basic dGVzdDp0ZXN0',
          'Content-Type': 'application/json',
        },
      },
    );
  });

  test('should handle reviewer filter correctly', async () => {
    // Mock axios response
    mockedAxios.get.mockResolvedValue({
      data: { value: [] },
    });

    const mockConnection: any = {
      serverUrl: 'https://tfs.cybersoft.tw:8081/tfs/SDD',
      authHandler: {
        prepareRequest: jest.fn().mockImplementation((_options, request) => {
          request.headers.Authorization = 'Basic dGVzdDp0ZXN0';
        }),
      },
    };

    await listPullRequestsByProject(mockConnection, 'test-project', {
      projectId: 'test-project',
      reviewerId: 'test-reviewer-id',
      top: 5,
    });

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://tfs.cybersoft.tw:8081/tfs/SDD/test-project/_apis/git/pullRequests',
      {
        params: {
          'api-version': '3.2',
          'searchCriteria.reviewerId': 'test-reviewer-id',
          $top: '5',
        },
        headers: {
          Authorization: 'Basic dGVzdDp0ZXN0',
          'Content-Type': 'application/json',
        },
      },
    );
  });

  test('should handle pagination correctly when results equal requested amount', async () => {
    const mockPullRequests = Array(10)
      .fill(null)
      .map((_, i) => ({
        pullRequestId: i + 1,
        title: `Test PR ${i + 1}`,
      }));

    // Mock axios response
    mockedAxios.get.mockResolvedValue({
      data: { value: mockPullRequests },
    });

    const mockConnection: any = {
      serverUrl: 'https://tfs.cybersoft.tw:8081/tfs/SDD',
      authHandler: {
        prepareRequest: jest.fn().mockImplementation((_options, request) => {
          request.headers.Authorization = 'Basic dGVzdDp0ZXN0';
        }),
      },
    };

    const result = await listPullRequestsByProject(
      mockConnection,
      'test-project',
      {
        projectId: 'test-project',
        top: 10,
      },
    );

    expect(result).toEqual({
      count: 10,
      value: mockPullRequests,
      hasMoreResults: true,
      warning:
        "Results limited to 10 items. Use 'skip: 10' to get the next page.",
    });
  });

  test('should handle errors and rethrow them', async () => {
    // Mock axios to reject
    mockedAxios.get.mockRejectedValue(new Error('API Error'));

    const mockConnection: any = {
      serverUrl: 'https://tfs.cybersoft.tw:8081/tfs/SDD',
      authHandler: {
        prepareRequest: jest.fn().mockImplementation((_options, request) => {
          request.headers.Authorization = 'Basic dGVzdDp0ZXN0';
        }),
      },
    };

    await expect(
      listPullRequestsByProject(mockConnection, 'test-project', {
        projectId: 'test-project',
      }),
    ).rejects.toThrow('Failed to list pull requests by project: API Error');
  });

  test('should handle all status types correctly', async () => {
    const testCases = [
      { status: 'active' as const, expectedParam: '1' },
      { status: 'completed' as const, expectedParam: '3' },
      { status: 'abandoned' as const, expectedParam: '2' },
    ];

    for (const testCase of testCases) {
      // Mock axios response
      mockedAxios.get.mockResolvedValue({
        data: { value: [] },
      });

      const mockConnection: any = {
        serverUrl: 'https://tfs.cybersoft.tw:8081/tfs/SDD',
        authHandler: {
          prepareRequest: jest.fn().mockImplementation((_options, request) => {
            request.headers.Authorization = 'Basic dGVzdDp0ZXN0';
          }),
        },
      };

      await listPullRequestsByProject(mockConnection, 'test-project', {
        projectId: 'test-project',
        status: testCase.status,
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://tfs.cybersoft.tw:8081/tfs/SDD/test-project/_apis/git/pullRequests',
        {
          params: {
            'api-version': '3.2',
            'searchCriteria.status': testCase.expectedParam,
            $top: '10',
          },
          headers: {
            Authorization: 'Basic dGVzdDp0ZXN0',
            'Content-Type': 'application/json',
          },
        },
      );

      // Reset mock for next iteration
      jest.resetAllMocks();
    }
  });

  test('should not set status filter when status is "all"', async () => {
    // Mock axios response
    mockedAxios.get.mockResolvedValue({
      data: { value: [] },
    });

    const mockConnection: any = {
      serverUrl: 'https://tfs.cybersoft.tw:8081/tfs/SDD',
      authHandler: {
        prepareRequest: jest.fn().mockImplementation((_options, request) => {
          request.headers.Authorization = 'Basic dGVzdDp0ZXN0';
        }),
      },
    };

    await listPullRequestsByProject(mockConnection, 'test-project', {
      projectId: 'test-project',
      status: 'all',
    });

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://tfs.cybersoft.tw:8081/tfs/SDD/test-project/_apis/git/pullRequests',
      {
        params: {
          'api-version': '3.2',
          $top: '10',
        }, // No status filter when 'all' is specified
        headers: {
          Authorization: 'Basic dGVzdDp0ZXN0',
          'Content-Type': 'application/json',
        },
      },
    );
  });
});
