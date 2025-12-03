import dotenv from 'dotenv';

dotenv.config();

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_AI_MODEL?: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH?: string;
  NEWS_FILE_PATH?: string;
  DISCORD_WEBHOOK_URL?: string;
  MAX_NEWS_ITEMS?: string;
}

export function requireEnv(key: keyof Env): string {
  const value = process.env[key as string];
  if (!value) {
    throw new Error(`Missing required env var ${key}`);
  }
  return value;
}

export function getOptionalEnv<T extends keyof Env>(key: T): Env[T] | undefined {
  return process.env[key as string] as Env[T] | undefined;
}
