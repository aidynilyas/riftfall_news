import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from './config.js';
import type {
  Continent,
  DefenseEventView,
  GameState,
  TopDefenderView,
  TotalPlayers,
  TotalPlayersPerRole,
} from './types.js';

function getClient(): SupabaseClient {
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_KEY');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const supabase = getClient();

async function fetchTable<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(`Supabase fetch failed for ${table}: ${error.message}`);
  return data as T[];
}

export async function getContinents(): Promise<Continent[]> {
  return fetchTable<Continent>('continents');
}

export async function getTotalPlayers(): Promise<TotalPlayers> {
  const rows = await fetchTable<TotalPlayers>('v_total_players');
  return rows[0] ?? { total_players: 0 };
}

export async function getTotalPlayersPerRole(): Promise<TotalPlayersPerRole[]> {
  return fetchTable<TotalPlayersPerRole>('v_total_players_per_role');
}

export async function getLast10DefensesPerContinent(): Promise<DefenseEventView[]> {
  return fetchTable<DefenseEventView>('v_last_10_defenses_per_continent');
}

export async function getTop10DefendersPerContinent(): Promise<TopDefenderView[]> {
  return fetchTable<TopDefenderView>('v_top_10_defenders_per_continent');
}

export async function fetchGameState(): Promise<GameState> {
  const [continents, totalPlayers, totalPlayersPerRole, last10Defenses, topDefenders] =
    await Promise.all([
      getContinents(),
      getTotalPlayers(),
      getTotalPlayersPerRole(),
      getLast10DefensesPerContinent(),
      getTop10DefendersPerContinent(),
    ]);

  return { continents, totalPlayers, totalPlayersPerRole, last10Defenses, topDefenders };
}

export async function resetWorld(continents?: Continent[]): Promise<void> {
  const toReset = continents ?? (await getContinents());
  const now = new Date().toISOString();
  if (toReset && toReset.length) {
    await Promise.all(
      toReset.map(async (continent) => {
        const { error } = await supabase
          .from('continents')
          .update({
            current_health: continent.max_health,
            status: 'ok',
            last_health_update: now,
          })
          .eq('id', continent.id);
        if (error) throw new Error(`Failed to reset continent ${continent.code}: ${error.message}`);
      }),
    );
  } else {
    const { error } = await supabase.from('continents').update({ status: 'ok', last_health_update: now });
    if (error) throw new Error(`Failed to reset continents when list empty: ${error.message}`);
  }

  const { error: truncateError } = await supabase.from('defense_events').delete().neq('id', -1);
  if (truncateError) throw new Error(`Failed to clear defense_events: ${truncateError.message}`);
}
