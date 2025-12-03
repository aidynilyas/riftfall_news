export type ContinentStatus = 'ok' | 'fallen';

export interface Continent {
  id: number;
  code: string;
  name: string;
  max_health: number;
  current_health: number;
  passive_damage_per_minute: number;
  status: ContinentStatus;
  created_at: string;
  last_health_update: string | null;
  metadata: Record<string, unknown> | null;
}

export type RoleType = 'attack' | 'defend' | 'gamble' | 'science' | 'gather';

export type BattleResult = 'success' | 'fail';

export interface TotalPlayers {
  total_players: number;
}

export interface TotalPlayersPerRole {
  role: RoleType;
  total_players: number;
}

export interface DefenseEventView {
  continent_id: number;
  device_hash: string;
  username: string | null;
  role: RoleType;
  difficulty_level: number;
  score: number;
  hp_delta: number;
  result: BattleResult;
  created_at: string;
}

export interface TopDefenderView {
  continent_id: number;
  device_hash: string;
  username: string | null;
  role: RoleType;
  total_score: number;
  runs: number;
}

export interface GameState {
  continents: Continent[];
  totalPlayers: TotalPlayers;
  totalPlayersPerRole: TotalPlayersPerRole[];
  last10Defenses: DefenseEventView[];
  topDefenders: TopDefenderView[];
}

export type NewsItemType = 'summary' | 'cycle_end' | 'cycle_reset';

export interface NewsDefenderMeta {
  username: string | null;
  role: RoleType;
  continent_code: string;
  total_score: number;
}

export interface NewsItem {
  id: string;
  type: NewsItemType;
  title: string;
  body: string;
  created_at: string;
  meta: {
    continent_code?: string | null;
    fallen_continents?: string[];
    top_defenders?: NewsDefenderMeta[];
    cycle_number?: number;
  };
}

export interface NewsFile {
  version: 1;
  generated_at: string;
  items: NewsItem[];
}

export interface ResetResult {
  performed: boolean;
  cycleNumber?: number;
}
