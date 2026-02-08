from backend.app.db.client import get_supabase


def similarity_search(
    table: str,
    query_embedding: list[float],
    match_column: str = "embedding",
    limit: int = 5,
) -> list[dict]:
    """Call a Supabase RPC that wraps pgvector cosine similarity search."""
    return get_supabase().rpc(
        "match_documents",
        {
            "query_embedding": query_embedding,
            "match_table": table,
            "match_column": match_column,
            "match_count": limit,
        },
    ).execute().data
