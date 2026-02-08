from backend.app.db.client import get_supabase
from backend.app.db.schemas import Match

TABLE = "matches"


def get_all_matches() -> list[Match]:
    rows = get_supabase().table(TABLE).select("*").execute().data
    return [Match(**r) for r in rows]


def get_match_by_id(match_id: int) -> Match | None:
    rows = (
        get_supabase()
        .table(TABLE)
        .select("*")
        .eq("match_id", match_id)
        .execute()
        .data
    )
    return Match(**rows[0]) if rows else None


def get_matches_by_team(team: str) -> list[Match]:
    db = get_supabase()
    rows = (
        db.table(TABLE)
        .select("*")
        .or_(f"home_team.ilike.%{team}%,away_team.ilike.%{team}%")
        .execute()
        .data
    )
    return [Match(**r) for r in rows]


def get_matches_by_city(city: str) -> list[Match]:
    rows = (
        get_supabase()
        .table(TABLE)
        .select("*")
        .ilike("city", f"%{city}%")
        .execute()
        .data
    )
    return [Match(**r) for r in rows]


def get_matches_by_stage(stage: str) -> list[Match]:
    rows = (
        get_supabase()
        .table(TABLE)
        .select("*")
        .ilike("stage", f"%{stage}%")
        .execute()
        .data
    )
    return [Match(**r) for r in rows]


def insert_match(match: Match) -> Match:
    row = (
        get_supabase()
        .table(TABLE)
        .insert(match.model_dump(mode="json"))
        .execute()
        .data[0]
    )
    return Match(**row)


def update_match(match_id: int, data: dict) -> Match:
    row = (
        get_supabase()
        .table(TABLE)
        .update(data)
        .eq("match_id", match_id)
        .execute()
        .data[0]
    )
    return Match(**row)


def delete_match(match_id: int) -> None:
    get_supabase().table(TABLE).delete().eq("match_id", match_id).execute()
