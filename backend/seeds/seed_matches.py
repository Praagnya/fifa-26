"""Seed the matches table from the FIFA 26 schedule spreadsheet."""

from datetime import timezone

from dotenv import load_dotenv

load_dotenv()

import openpyxl

from backend.app.db.client import get_supabase

# Map cities to host countries
CITY_TO_COUNTRY = {
    "Mexico City": "Mexico",
    "Zapopan": "Mexico",
    "Guadalupe": "Mexico",
    "Toronto": "Canada",
    "Vancouver": "Canada",
}
# Everything else is USA

# Map stage text to clean stage names
def parse_stage(raw: str) -> tuple[str, str | None]:
    """Return (stage, group_name)."""
    if raw.startswith("Group"):
        # e.g. "Group A" -> ("Group Stage", "A")
        return "Group Stage", raw.split()[-1]
    return raw, None


def load_matches() -> list[dict]:
    wb = openpyxl.load_workbook(
        "FIFA Men's World Cup 2026 Sortable Schedule.xlsx"
    )
    ws = wb.active
    matches = []

    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[0] is None:
            break

        raw_stage, kickoff, home, away, match_num, location = row

        stage, group_name = parse_stage(raw_stage)

        # Split "Stadium, City"
        parts = location.rsplit(", ", 1)
        stadium = parts[0]
        city = parts[1] if len(parts) == 2 else location

        host_country = CITY_TO_COUNTRY.get(city, "USA")

        # Convert naive datetime to UTC (spreadsheet is EDT / UTC-4)
        from datetime import timedelta

        kickoff_utc = kickoff.replace(tzinfo=timezone(timedelta(hours=-4)))

        matches.append(
            {
                "match_id": int(match_num),
                "kickoff_utc": kickoff_utc.isoformat(),
                "home_team": home,
                "away_team": away,
                "group_name": group_name,
                "stage": stage,
                "stadium": stadium,
                "city": city,
                "host_country": host_country,
            }
        )

    return matches


def seed():
    matches = load_matches()
    client = get_supabase()
    # Insert in batches of 50
    for i in range(0, len(matches), 50):
        batch = matches[i : i + 50]
        result = client.table("matches").insert(batch).execute()
        print(f"Inserted batch {i // 50 + 1}: {len(result.data)} matches")
    print(f"Done — {len(matches)} total matches seeded")


if __name__ == "__main__":
    seed()
