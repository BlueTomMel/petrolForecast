"""
Scrape petrol price trend prediction for next week from Gemini AI and store in the database.
"""
import sqlite3
import datetime
import requests
import time

GEMINI_API_KEY = "AIzaSyBiSkMA5YNg076VpeDIB1UOqEHzT1VI8xE"  
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

CITIES = [
    ("Melbourne", "Victoria"),
    ("Sydney", "New South Wales"),
    ("Brisbane", "Queensland")
]

def get_gemini_forecast(city, state):
    prompt = (
        f"Please provide a researched prediction for the trend of petrol prices in {city}, {state}, Australia for the next week. "
        "Give a short summary and, if possible, a trend for next week and the current and next price cycle. Do your best to predict. I know the risk of it."
    )
    data = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ]
    }
    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
    }
    try:
        resp = requests.post(GEMINI_API_URL, headers=headers, json=data, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        forecast_text = result["candidates"][0]["content"]["parts"][0]["text"]
        return forecast_text.strip()
    except Exception as e:
        print(f"Error fetching forecast for {city}: {e}")
        return None

def store_forecast(city, forecast_text):
    conn = sqlite3.connect("backend/data/history.db")
    c = conn.cursor()
    forecast_date = datetime.date.today().isoformat()
    c.execute('''
        CREATE TABLE IF NOT EXISTS petrol_forecast (
            city TEXT,
            forecast_date TEXT,
            forecast_text TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (city, forecast_date)
        )
    ''')
    c.execute('''
        INSERT OR REPLACE INTO petrol_forecast (city, forecast_date, forecast_text)
        VALUES (?, ?, ?)
    ''', (city, forecast_date, forecast_text))
    conn.commit()
    conn.close()

def main():
    for city, state in CITIES:
        print(f"Fetching forecast for {city}...")
        forecast = get_gemini_forecast(city, state)
        if forecast:
            store_forecast(city, forecast)
            print(f"Stored forecast for {city}.")
        else:
            print(f"No forecast for {city}.")
        time.sleep(2)  # Be polite to the API

if __name__ == "__main__":
    main()
