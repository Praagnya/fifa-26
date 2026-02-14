
import os
import json
from amadeus import Client, ResponseError
from dotenv import load_dotenv

load_dotenv()

# Initialize Amadeus client
amadeus = Client(
    client_id=os.environ.get("AMADEUS_API_KEY"),
    client_secret=os.environ.get("AMADEUS_API_SECRET")
)

def get_location_details(iata_code):
    try:
        response = amadeus.reference_data.locations.get(
            keyword=iata_code,
            subType="AIRPORT"
        )
        print(json.dumps(response.data, indent=2))
    except ResponseError as error:
        print(error)

if __name__ == "__main__":
    get_location_details("BLR")
