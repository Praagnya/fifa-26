from backend.app.db.repository import (
    get_matches_by_team,
    get_matches_by_city,
    get_matches_by_stage,
    get_all_matches,
)


def search_matches(query: str, entities: dict | None = None) -> list[dict]:
    """
    Search for FIFA 2026 matches using extracted entities.
    Falls back to broad search if no entities match.

    Args:
        query: The raw user query string
        entities: Dict with optional keys: team, city, stage, date
    """
    entities = entities or {}
    results: list[dict] = []

    team = entities.get("team")
    city = entities.get("city")
    stage = entities.get("stage")

    if team:
        matches = get_matches_by_team(team)
        results.extend([m.model_dump(mode="json") for m in matches])

    if city and not results:
        matches = get_matches_by_city(city)
        results.extend([m.model_dump(mode="json") for m in matches])

    if stage and not results:
        matches = get_matches_by_stage(stage)
        results.extend([m.model_dump(mode="json") for m in matches])

    # If nothing matched, return all matches (agent will filter in its prompt)
    if not results:
        all_matches = get_all_matches()
        results = [m.model_dump(mode="json") for m in all_matches[:20]]

    return results


def search_match_by_teams(team1: str, team2: str) -> dict | None:
    """Find a specific match between two teams."""
    matches = get_matches_by_team(team1)
    for m in matches:
        if team2.lower() in m.home_team.lower() or team2.lower() in m.away_team.lower():
            return m.model_dump(mode="json")
    return None
