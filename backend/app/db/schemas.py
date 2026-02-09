from datetime import datetime

from pydantic import BaseModel


class Team(BaseModel):
    team_id: int
    name: str
    country_code: str
    group_name: str | None = None
    confederation: str | None = None
    fifa_ranking: int | None = None
    is_host: bool = False
    coach_name: str | None = None
    nickname: str | None = None


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
