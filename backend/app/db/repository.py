from backend.app.db.client import get_supabase


def get_all(table: str) -> list[dict]:
    return get_supabase().table(table).select("*").execute().data


def get_by_id(table: str, id: str) -> dict | None:
    rows = get_supabase().table(table).select("*").eq("id", id).execute().data
    return rows[0] if rows else None


def insert(table: str, data: dict) -> dict:
    return get_supabase().table(table).insert(data).execute().data[0]


def update(table: str, id: str, data: dict) -> dict:
    return get_supabase().table(table).update(data).eq("id", id).execute().data[0]


def delete(table: str, id: str) -> None:
    get_supabase().table(table).delete().eq("id", id).execute()
