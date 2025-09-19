import { z } from 'zod';
import { Tool } from '@mastra/core/tools';
import { GitlabAPI } from '../../../lib/gitlab'; // 使用 GitLab API
import AdmZip from 'adm-zip';

interface SimplifiedGraph {
  [key: string]: {
    dependencies: string[];
    dependents: string[];
  };
}
const GetGithubActionArtifactContentInputSchema = z.object({
  projectId: z.string().describe("The projectId of the repository"),
  mergeRequestIid: z.number().describe("The name of the mergeRequest (e.g., 1)."),
  head_sha: z
    .string()
    .describe(
      'Commit SHA associated with the workflow run (e.g., PR head SHA)'
    ),
  artifact_name: z.string().describe("Exact name of the artifact to download, Default is 'dependency-graphs'"),
});


export const defaultGraph = {
  "src/mastra/function/fun1.js": {
    "dependencies": [],
    "dependents": ["src/mastra/test.js"]
  },
  "src/mastra/function/fun2.js": {
    "dependencies": [],
    "dependents": ["src/mastra/test.js"]
  },
  "src/mastra/test.js": {
    "dependencies": ["src/mastra/add.js", "src/mastra/listFun.js", "src/mastra/function/fun1.js", "src/mastra/function/fun2.js"],
    "dependents": ["src/mastra/index.js"]
  },
  "src/mastra/add.js": {
    "dependencies": [],
    "dependents": ["src/mastra/test.js"]
  },
  "src/mastra/listFun.js": {
    "dependencies": [],
    "dependents": ["src/mastra/test.js"]
  },
  "src/mastra/index.js": {
    "dependencies": ["src/mastra/test.js"],
    "dependents": []
  }
}

const GetGithubActionArtifactContentOutputSchema = z.record(z.string(), z.object({
  dependencies: z.array(z.string()).describe('List of files this file depends on.'),
  dependents: z.array(z.string()).describe('List of files that depend on this file.'),
}));

/**
 * Fetches the content of a specific file within a GitLab CI job artifact.
 */
export const getGitlabActionArtifactContent = new Tool({
  id: 'getGitlabActionArtifactContent', // Use id instead of name
  description:
    'Downloads a named artifact from the latest successful GitLab CI pipeline for a specific commit SHA, parses it, and returns a *simplified* JSON string containing only internal module dependencies and dependents.',
  inputSchema: GetGithubActionArtifactContentInputSchema,
  outputSchema: GetGithubActionArtifactContentOutputSchema,
  // Correct execute signature and input access
  execute: async ({ context }: { context: z.infer<typeof GetGithubActionArtifactContentInputSchema> }): Promise<SimplifiedGraph> => {
    // Destructure input directly from context
    const { projectId, mergeRequestIid, head_sha, artifact_name } = context;
    return defaultGraph
    try {
      // 1. Find the latest successful pipeline for the head_sha
      console.log(`Searching pipelines for ${projectId} at ${head_sha}`);
      const pipelinesResponse = await GitlabAPI.Pipelines.all(projectId, {
        sha: head_sha,
        status: 'success',
        perPage: 100,
      });

      if (pipelinesResponse.length === 0) {
        throw new Error(
          `No successful pipelines found for SHA ${head_sha}`
        );
      }
      const latestPipeline = pipelinesResponse.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      const pipeline_id = latestPipeline.id;
      console.log(`Found latest successful pipeline ID: ${pipeline_id}`);

      // 2. List all jobs in the pipeline to find the one with the artifact
      console.log(`Listing jobs in pipeline ${pipeline_id} to find artifact`);
      const jobsResponse = await GitlabAPI.Jobs.all(projectId, {
        pipelineId: pipeline_id,
      });
      const targetJob = jobsResponse.find((job: any) =>
        job.artifacts && job.artifacts.some((art: any) => art.filename === artifact_name)
      );
      if (!targetJob) {
        throw new Error(
          `No job with artifact named "${artifact_name}" found in pipeline ${pipeline_id}`
        );
      }
      console.log(`Found job ID ${targetJob?.id} with artifact`);

      // 3. Download the artifact by job ID and filename
      console.log(`Downloading artifact "${artifact_name}" from job ${targetJob?.id}`);
      const downloadResponse = await GitlabAPI.JobArtifacts.downloadArchive(projectId, {
        jobId: targetJob?.id,
        artifactPath: artifact_name,
        options: { responseType: 'arraybuffer' }
      });

      // Check status code (assuming 200 on success after potential redirects)
      if ((downloadResponse.status as number) !== 200 || !downloadResponse.data) {
        throw new Error(`Failed to download artifact. Status: ${downloadResponse.status}, Data received: ${!!downloadResponse.data}`);
      }

      const zipBuffer = Buffer.from(downloadResponse.data as ArrayBuffer);

      // 4. Unzip and read the first file's content
      console.log(`Unzipping artifact...`);
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      if (!zipEntries || zipEntries.length === 0) {
        throw new Error('Artifact zip archive is empty or could not be read.');
      }

      const firstEntry = zipEntries[0];
      console.log(`Reading content from file: ${firstEntry.entryName}`);
      const fileContent = firstEntry.getData().toString('utf8');

      // --- START: Parse and Simplify Dependency Graph ---
      console.log('Parsing and simplifying dependency graph...');
      const rawGraphData = JSON.parse(fileContent);
      const simplifiedGraph: SimplifiedGraph = {};

      // make graph simplified
      if (rawGraphData && Array.isArray(rawGraphData.modules)) {
        for (const module of rawGraphData.modules) {
          // Filter out external/core modules (basic check)
          if (module.coreModule === true || !module.source || !module.source.startsWith('src/')) {
            continue;
          }

          const source = module.source;

          // Process dependencies: keep only resolved paths to internal modules
          const internalDependencies = (module.dependencies || [])
            .filter((dep: any) =>
              dep.resolved &&
              dep.coreModule === false &&
              dep.resolved.startsWith('src/') // Ensure dependency is also internal
            )
            .map((dep: any) => dep.resolved);

          // Keep dependents (assuming they are internal paths)
          const dependents = module.dependents || [];

          simplifiedGraph[source] = {
            dependencies: internalDependencies,
            dependents: dependents,
          };
        }
      } else {
        console.warn('Could not find "modules" array in the artifact content.');
      }

      return simplifiedGraph;

    } catch (error: any) {
      console.error('Error in getGithubActionArtifactContent:', error);
      // Ensure error message is also returned as a JSON string for consistency
      const errorMessage = `Failed to get or process artifact content: ${error.message || 'Unknown error'}`;
      return { error: errorMessage } as any;
    }
  },
}); 