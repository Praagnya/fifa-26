import os 
from supabase import create_client, Client 

def get_supabase() -> Client: 
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key: 
        raise ValueError(("Missing SUPABASE credentials in .env file"))
    return create_client(url, key)
