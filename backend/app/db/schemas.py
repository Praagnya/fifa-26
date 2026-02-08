from datetime import datetime

from pydantic import BaseModel


class Match(BaseModel):
    match_id: int
    kickoff_utc: datetime
    home_team: str
    away_team: str
    group_name: str | None = None
    stage: str
    stadium: str
    city: str
    host_country: str
    metadata: dict | None = None
