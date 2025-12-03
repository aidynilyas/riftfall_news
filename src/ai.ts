import { getOptionalEnv, requireEnv } from './config.js';
import type { GameState, NewsItem } from './types.js';
import { nanoid } from 'nanoid';

interface AIResponseItem {
  title: string;
  body: string;
}

function buildStats(state: GameState) {
  const continents = state.continents.map((c) => ({
    code: c.code,
    name: c.name,
    max_health: c.max_health,
    current_health: c.current_health,
    status: c.status,
  }));

  const perRole = state.totalPlayersPerRole.reduce<Record<string, number>>((acc, r) => {
    acc[r.role] = r.total_players;
    return acc;
  }, {});

  const lastDefenses = state.last10Defenses.map((d) => ({
    continent_id: d.continent_id,
    username: d.username,
    role: d.role,
    score: d.score,
    hp_delta: d.hp_delta,
    result: d.result,
    created_at: d.created_at,
  }));

  const topDefenders = state.topDefenders.map((d) => ({
    continent_id: d.continent_id,
    username: d.username,
    role: d.role,
    total_score: d.total_score,
    runs: d.runs,
  }));

  return {
    continents,
    totals: {
      total_players: state.totalPlayers.total_players,
      per_role: perRole,
    },
    last_defenses: lastDefenses,
    top_defenders: topDefenders,
  };
}

async function callCloudflareAI(stats: unknown): Promise<AIResponseItem[]> {
  const accountId = getOptionalEnv('CLOUDFLARE_ACCOUNT_ID');
  const apiToken = getOptionalEnv('CLOUDFLARE_API_TOKEN');
  const model = getOptionalEnv('CLOUDFLARE_AI_MODEL') ?? '@cf/meta/llama-3-8b-instruct';
  if (!accountId || !apiToken) {
    return [];
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const prompt = [
    'You are Riftfall’s in-universe war correspondent.',
    'Summarize the last 6 hours of events in 2-5 short news items.',
    'Use dramatic but concise language.',
    'Mention which continents are in danger, which are stable, notable defender names from top 10, and any continents that fell or were saved at low HP.',
    'Return ONLY JSON array, no markdown, shaped as [{"title":"...","body":"..."}].',
  ].join(' ');

  const body = {
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify(stats) },
    ],
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudflare AI request failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  const raw = json.result?.response ?? json.result?.output ?? json.result ?? json;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {
    // fall through
  }

  return [];
}

function buildFallbackItems(stats: ReturnType<typeof buildStats>): AIResponseItem[] {
  const fallen = stats.continents.filter((c) => c.status === 'fallen' || c.current_health <= 0);
  const weakest = [...stats.continents].sort((a, b) => a.current_health - b.current_health)[0];
  const top = stats.top_defenders.slice(0, 3);

  const title = fallen.length
    ? `Crisis across ${fallen.length} front${fallen.length > 1 ? 's' : ''}`
    : `Lines hold across ${stats.continents.length} continents`;
  const bodyParts = [
    fallen.length
      ? `${fallen.map((c) => c.name).join(', ')} reported fallen. Command readies reset protocols.`
      : `${weakest?.name ?? 'Front lines'} took the heaviest fire but remains standing.`,
    top.length
      ? `Notable defenders: ${top.map((d) => `${d.username ?? 'Unknown'} (${d.total_score} pts)`).join(', ')}.`
      : 'Defender roster data limited this cycle.',
    `Total players involved: ${stats.totals.total_players}.`,
  ];

  return [{ title, body: bodyParts.join(' ') }];
}

export async function generateNewsItemsFromState(
  state: GameState,
  type: NewsItem['type'] = 'summary',
  meta: NewsItem['meta'] = {},
): Promise<NewsItem[]> {
  const stats = buildStats(state);
  let aiItems: AIResponseItem[] = [];
  try {
    aiItems = await callCloudflareAI(stats);
  } catch (err) {
    console.error(err);
  }

  if (!aiItems.length) {
    aiItems = buildFallbackItems(stats);
  }

  const now = new Date().toISOString();
  return aiItems.map((item) => ({
    id: nanoid(),
    type,
    title: item.title,
    body: item.body,
    created_at: now,
    meta,
  }));
}
