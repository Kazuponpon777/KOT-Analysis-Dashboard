
import requests
import json
from datetime import datetime

API_KEY = "1614675783c84975b9d25592e3a147c1"
BASE_URL = "https://api.kingtime.jp/v1.0"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def test_api():
    print("Testing connection to KING OF TIME API...")
    
    # Try getting daily workings for today
    today = datetime.now().strftime("%Y-%m-%d")
    # Using a known date format for KOT API often requires just the date or range
    # Let's try getting company info or similar simple endpoint first if possible,
    # otherwise daily-workings for today.
    
    # Common endpoint pattern: /daily-workings
    # url = f"{BASE_URL}/daily-workings?date={today}"
    # Actually KOT often uses /daily-workings and returns a list.
    
    # Let's try to get employees first, it's usually simpler.
    url = f"{BASE_URL}/employees"
    
    try:
        response = requests.get(url, headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Successfully connected!")
            print(f"Employees count: {len(data) if isinstance(data, list) else 'Unknown'}")
            if isinstance(data, list) and len(data) > 0:
                print("First employee sample:", json.dumps(data[0], indent=2, ensure_ascii=False))
            elif isinstance(data, dict):
                 print("Response:", json.dumps(data, indent=2, ensure_ascii=False))
        else:
            print("Failed to connect.")
            print("Response:", response.text)
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_api()
