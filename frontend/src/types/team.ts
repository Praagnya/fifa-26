export interface Team {
  team_id: number;
  name: string;
  country_code: string;
  group_name: string | null;
  confederation: string | null;
  fifa_ranking: number | null;
  is_host: boolean;
  coach_name: string | null;
  nickname: string | null;
}
