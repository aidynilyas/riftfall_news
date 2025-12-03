import { Octokit } from '@octokit/rest';
import { getOptionalEnv, requireEnv } from './config.js';
import type { NewsFile } from './types.js';

const octokit = new Octokit({ auth: requireEnv('GITHUB_TOKEN') });

const repoFull = requireEnv('GITHUB_REPO');
const [owner, repo] = repoFull.split('/');
if (!owner || !repo) {
  throw new Error('GITHUB_REPO must be formatted as owner/repo');
}

const branch = getOptionalEnv('GITHUB_BRANCH') ?? 'main';
const newsPath = getOptionalEnv('NEWS_FILE_PATH') ?? 'data/news/news.json';

export interface LoadedNews {
  news: NewsFile;
  sha?: string;
}

export async function loadExistingNewsJson(): Promise<LoadedNews> {
  try {
    const res = await octokit.repos.getContent({ owner, repo, path: newsPath, ref: branch });
    if (!('content' in res.data)) {
      throw new Error('news.json content not found');
    }
    const content = Buffer.from(res.data.content, 'base64').toString('utf-8');
    const parsed = JSON.parse(content) as NewsFile;
    return { news: parsed, sha: res.data.sha };
  } catch (err) {
    console.warn('Failed to load existing news.json, will create new file', err);
    const now = new Date().toISOString();
    const news: NewsFile = { version: 1, generated_at: now, items: [] };
    return { news };
  }
}

export async function saveNewsJson(news: NewsFile, sha?: string): Promise<void> {
  const content = JSON.stringify(news, null, 2);
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: newsPath,
    branch,
    message: 'chore: update riftfall news',
    content: Buffer.from(content).toString('base64'),
    sha,
  });
}
