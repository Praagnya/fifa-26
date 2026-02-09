from backend.app.db.client import get_supabase
from backend.app.db.schemas import Match, Team

MATCHES = "matches"
TEAMS = "teams"


def get_all_matches() -> list[Match]:
    rows = get_supabase().table(MATCHES).select("*").order("kickoff_utc").execute().data
    return [Match(**r) for r in rows]


def get_match_by_id(match_id: int) -> Match | None:
    rows = (
        get_supabase()
        .table(MATCHES)
        .select("*")
        .eq("match_id", match_id)
        .execute()
        .data
    )
    return Match(**rows[0]) if rows else None


def get_matches_by_team(team: str) -> list[Match]:
    db = get_supabase()
    rows = (
        db.table(MATCHES)
        .select("*")
        .or_(f"home_team.ilike.%{team}%,away_team.ilike.%{team}%")
        .order("kickoff_utc")
        .execute()
        .data
    )
    return [Match(**r) for r in rows]


def get_matches_by_city(city: str) -> list[Match]:
    rows = (
        get_supabase()
        .table(MATCHES)
        .select("*")
        .ilike("city", f"%{city}%")
        .order("kickoff_utc")
        .execute()
        .data
    )
    return [Match(**r) for r in rows]


def get_matches_by_stage(stage: str) -> list[Match]:
    rows = (
        get_supabase()
        .table(MATCHES)
        .select("*")
        .ilike("stage", f"%{stage}%")
        .order("kickoff_utc")
        .execute()
        .data
    )
    return [Match(**r) for r in rows]


def insert_match(match: Match) -> Match:
    row = (
        get_supabase()
        .table(MATCHES)
        .insert(match.model_dump(mode="json"))
        .execute()
        .data[0]
    )
    return Match(**row)


def update_match(match_id: int, data: dict) -> Match:
    row = (
        get_supabase()
        .table(MATCHES)
        .update(data)
        .eq("match_id", match_id)
        .execute()
        .data[0]
    )
    return Match(**row)


def delete_match(match_id: int) -> None:
    get_supabase().table(MATCHES).delete().eq("match_id", match_id).execute()


# ── Teams ──────────────────────────────────────────────────────────────


def get_all_teams() -> list[Team]:
    rows = get_supabase().table(TEAMS).select("*").execute().data
    return [Team(**r) for r in rows]


def get_team_by_id(team_id: int) -> Team | None:
    rows = (
        get_supabase()
        .table(TEAMS)
        .select("*")
        .eq("team_id", team_id)
        .execute()
        .data
    )
    return Team(**rows[0]) if rows else None


def get_team_by_code(country_code: str) -> Team | None:
    rows = (
        get_supabase()
        .table(TEAMS)
        .select("*")
        .eq("country_code", country_code.upper())
        .execute()
        .data
    )
    return Team(**rows[0]) if rows else None


def get_teams_by_group(group_name: str) -> list[Team]:
    rows = (
        get_supabase()
        .table(TEAMS)
        .select("*")
        .eq("group_name", group_name.upper())
        .execute()
        .data
    )
    return [Team(**r) for r in rows]


def get_host_teams() -> list[Team]:
    rows = (
        get_supabase()
        .table(TEAMS)
        .select("*")
        .eq("is_host", True)
        .execute()
        .data
    )
    return [Team(**r) for r in rows]
