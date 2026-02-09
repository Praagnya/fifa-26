
import csv
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Add the project root to python path to allow imports
sys.path.append(os.path.join(os.path.dirname(__file__), "../../.."))

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))

from backend.app.db.client import get_supabase

CSV_PATH = "temp_worldcup_data/data-csv/matches.csv"

def parse_int(val):
    try:
        if not val or val.strip() == "":
            return None
        return int(float(val))
    except (ValueError, TypeError):
        return None

def ingest_data():
    if not os.path.exists(CSV_PATH):
        print(f"Error: CSV file not found at {CSV_PATH}")
        return

    print("Reading CSV data...")
    records = []
    
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Filter out Women's World Cup
            if "Women" in row.get('tournament_name', ''):
                continue

            # Extract year from match_date or tournament_id if date is missing
            # match_date is YYYY-MM-DD
            try:
                match_date = row['match_date']
                year = int(match_date.split('-')[0])
            except:
                # Fallback to tournament id "WC-1930"
                year = int(row['tournament_id'].split('-')[-1])
                match_date = None

            record = {
                "year": year,
                "match_date": match_date,
                "stage": row['stage_name'],
                "home_team": row['home_team_name'],
                "away_team": row['away_team_name'],
                "home_score": parse_int(row['home_team_score']),
                "away_score": parse_int(row['away_team_score']),
                "home_penalties": parse_int(row['home_team_score_penalties']),
                "away_penalties": parse_int(row['away_team_score_penalties']),
                "result": row['result'],
                "stadium": row['stadium_name'],
                "city": row['city_name'],
                # "attendance": parse_int(row.get('attendance', 0)) # Not in matches.csv apparently, looked at column list earlier
            }
            records.append(record)

    print(f"Found {len(records)} matches.")
    
    # Insert in batches
    batch_size = 100
    total_inserted = 0
    
    supabase = get_supabase()
    
    print("Clearing existing data...")
    supabase.table("historical_matches").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        print(f"Inserting batch {i} to {i+batch_size}...")
        try:
            # We use the table name 'historical_matches'
            response = supabase.table("historical_matches").insert(batch).execute()
            total_inserted += len(batch)
        except Exception as e:
            print(f"Error inserting batch: {e}")
            # Continue or break? Let's break to avoid spamming errors if table doesn't exist
            break

    print(f"Successfully inserted {total_inserted} rows.")

if __name__ == "__main__":
    ingest_data()
