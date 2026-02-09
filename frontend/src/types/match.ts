export interface Match {
  match_id: number;
  kickoff_utc: string;
  home_team: string;
  away_team: string;
  group_name: string | null;
  stage: string;
  stadium: string;
  city: string;
  host_country: string;
  metadata: Record<string, unknown> | null;
}
