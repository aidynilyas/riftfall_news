import { fileURLToPath } from 'url';
import { generateNewsItemsFromState } from './ai.js';
import { getOptionalEnv } from './config.js';
import { loadExistingNewsJson, saveNewsJson } from './github.js';
import { sendDiscordNotification } from './notifications.js';
import { fetchGameState, resetWorld } from './supabase.js';
import type { Continent, GameState, NewsFile, NewsItem } from './types.js';
import { nanoid } from 'nanoid';

function fallenContinents(continents: Continent[]): Continent[] {
  return continents.filter((c) => c.status === 'fallen' || c.current_health <= 0);
}

function allContinentsFallen(continents: Continent[]): boolean {
  return continents.length > 0 && fallenContinents(continents).length === continents.length;
}

function computeCycleNumber(news: NewsFile): number {
  const resets = news.items.filter((i) => i.type === 'cycle_reset').length;
  return resets + 1;
}

function topDefendersMeta(state: GameState) {
  const codeMap = new Map(state.continents.map((c) => [c.id, c.code]));
  return state.topDefenders.slice(0, 5).map((d) => ({
    username: d.username,
    role: d.role,
    continent_code: codeMap.get(d.continent_id) ?? '',
    total_score: d.total_score,
  }));
}

function buildCycleEndItem(state: GameState, cycleNumber: number): NewsItem {
  const fallen = fallenContinents(state.continents);
  const now = new Date().toISOString();
  const body = fallen.length
    ? `${fallen.map((c) => c.name).join(', ')} have fallen. Command declares the cycle lost. Reset incoming.`
    : 'All fronts reported lost. Reset incoming.';
  return {
    id: nanoid(),
    type: 'cycle_end',
    title: `Cycle ${cycleNumber} collapse`,
    body,
    created_at: now,
    meta: {
      fallen_continents: fallen.map((c) => c.code),
      cycle_number: cycleNumber,
    },
  };
}

function buildCycleResetItem(cycleNumber: number): NewsItem {
  const now = new Date().toISOString();
  return {
    id: nanoid(),
    type: 'cycle_reset',
    title: `Cycle ${cycleNumber} begins`,
    body: 'World data reset: continents restored to full health, defenses cleared.',
    created_at: now,
    meta: {
      cycle_number: cycleNumber,
    },
  };
}

function applyHistoryTrim(news: NewsFile): void {
  const maxItems = parseInt(getOptionalEnv('MAX_NEWS_ITEMS') ?? '200', 10);
  if (news.items.length > maxItems) {
    news.items = news.items.slice(-maxItems);
  }
}

async function runDaemon(): Promise<void> {
  const [{ news, sha }, state] = await Promise.all([loadExistingNewsJson(), fetchGameState()]);
  const cycleNumber = computeCycleNumber(news);
  const fallen = fallenContinents(state.continents);
  const topDefenders = topDefendersMeta(state);

  const summaryMeta: NewsItem['meta'] = {
    fallen_continents: fallen.map((c) => c.code),
    top_defenders: topDefenders,
  };

  const newItems: NewsItem[] = [];
  newItems.push(...(await generateNewsItemsFromState(state, 'summary', summaryMeta)));

  if (allContinentsFallen(state.continents)) {
    newItems.push(buildCycleEndItem(state, cycleNumber));
    await sendDiscordNotification(`Riftfall cycle ${cycleNumber} ended. All continents have fallen.`);
    await resetWorld(state.continents);
    newItems.push(buildCycleResetItem(cycleNumber + 1));
    await sendDiscordNotification(`Riftfall cycle ${cycleNumber + 1} has begun after reset.`);
  }

  news.items = [...news.items, ...newItems];
  applyHistoryTrim(news);
  news.generated_at = new Date().toISOString();

  await saveNewsJson(news, sha);

  console.log(`Appended ${newItems.length} news items. Total now: ${news.items.length}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDaemon().catch((err) => {
    console.error('Daemon run failed', err);
    process.exitCode = 1;
  });
}
