// Re-export the Pipeline interface from the Azure DevOps API
import { Pipeline } from 'azure-devops-node-api/interfaces/PipelinesInterfaces';

/**
 * Options for listing pipelines
 */
export interface ListPipelinesOptions {
  projectId: string;
  orderBy?: string;
  top?: number;
  continuationToken?: string;
}

/**
 * Options for getting a pipeline
 */
export interface GetPipelineOptions {
  projectId: string;
  pipelineId: number;
  pipelineVersion?: number;
}

export { Pipeline };
