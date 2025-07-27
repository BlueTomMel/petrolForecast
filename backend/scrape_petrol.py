"""
Scrape petrol prices for major Australian cities (Melbourne, Sydney, Brisbane, Adelaide, Perth)
from PetrolSpy API and store the results in a SQLite database.

- Fetches data for each city using the PetrolSpy API.
- Extracts suburb, station, postcode, price, and timestamp.
- Appends all records to the 'petrol_prices' table in backend/data/history.db.

No browser automation is used; all data is fetched via API requests.
"""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
import time
import requests
import pandas as pd
from bs4 import BeautifulSoup
import csv
import datetime
import sqlite3
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Step 1: navigate to PetrolSpy Melbourne page URL: "https://petrolspy.com.au/map/latlng/-37.814107/144.96328"
# Step 2: click this webelement <button id="list-view" class="button map-button map-control" style="z-index: 2147483647; float: right;"><div></div></button>
# Step 3: Parse HTML to extract suburb, station, price
# Step 4: Save to CSV with headers: date, suburb, station, price
def scrape_petrol_prices():
    # Define city API endpoints
    cities = [
        {
            'name': 'Melbourne',
            'api_urls': [
                'https://www.petrolspy.com.au/webservice-1/station/box?neLat=-37.7&neLng=145.2&swLat=-38.1&swLng=144.7&fuelType=1'
            ]
        },
        {
            'name': 'Sydney',
            # Split Sydney into 4 smaller boxes
            'api_urls': [
                'https://www.petrolspy.com.au/webservice-1/station/box?neLat=-33.5&neLng=151.3&swLat=-33.9&swLng=150.9&fuelType=1',
                'https://www.petrolspy.com.au/webservice-1/station/box?neLat=-33.5&neLng=151.7&swLat=-33.9&swLng=151.3&fuelType=1',
                'https://www.petrolspy.com.au/webservice-1/station/box?neLat=-33.1&neLng=151.3&swLat=-33.5&swLng=150.9&fuelType=1',
                'https://www.petrolspy.com.au/webservice-1/station/box?neLat=-33.1&neLng=151.7&swLat=-33.5&swLng=151.3&fuelType=1'
            ]
        },
        {
            'name': 'Brisbane',
            # Split Brisbane into 4 smaller boxes
            'api_urls': [
                'https://www.petrolspy.com.au/webservice-1/station/box?neLat=-27.2&neLng=153.2&swLat=-27.6&swLng=152.8&fuelType=1',
                'https://www.petrolspy.com.au/webservice-1/station/box?neLat=-27.2&neLng=153.6&swLat=-27.6&swLng=153.2&fuelType=1',
                'https://www.petrolspy.com.au/webservice-1/station/box?neLat=-26.8&neLng=153.2&swLat=-27.2&swLng=152.8&fuelType=1',
                'https://www.petrolspy.com.au/webservice-1/station/box?neLat=-26.8&neLng=153.6&swLat=-27.2&swLng=153.2&fuelType=1'
            ]
        },
        {
            'name': 'Adelaide',
            'api_urls': [
                'https://www.petrolspy.com.au/webservice-1/station/box?neLat=-34.6&neLng=138.9&swLat=-35.2&swLng=138.2&fuelType=1'
            ]
        },
        {
            'name': 'Perth',
            'api_urls': [
                'https://www.petrolspy.com.au/webservice-1/station/box?neLat=-31.7&neLng=116.2&swLat=-32.3&swLng=115.6&fuelType=1'
            ]
        }
    ]

    petrol_data = []
    all_stations = []

    for city in cities:
        total_city_stations = 0
        for api_url in city['api_urls']:
            print(f"Fetching data for {city['name']} from {api_url} ...")
            response = requests.get(api_url)
            if response.status_code != 200:
                print(f"Failed to fetch data from API for {city['name']} (url: {api_url})")
                continue
            data = response.json()
            message = data.get('message', {})
            stations = message.get('list', [])
            total_city_stations += len(stations)
            all_stations.extend(stations)
            print(f"[DEBUG] {city['name']} API ({api_url}) returned {len(stations)} stations.")
            if stations:
                print(f"[DEBUG] Sample {city['name']} station: {stations[0]}")
        print(f"[DEBUG] {city['name']} total stations from all boxes: {total_city_stations}")

    for station in all_stations:
        suburb = station.get('suburb')
        name = station.get('name')
        address = station.get('address')
        postcode = station.get('postCode')
        price = None
        date = None
        lat = None
        lng = None
        # Extract lat/lng if available
        location = station.get('location')
        if location and isinstance(location, dict):
            lng = location.get('x')
            lat = location.get('y')
        prices = station.get('prices', {})
        # Prefer U91, else any available price
        if 'U91' in prices and 'amount' in prices['U91']:
            price = prices['U91']['amount']
            updated_ts = prices['U91'].get('updated')
        elif prices:
            for v in prices.values():
                if 'amount' in v:
                    price = v['amount']
                    updated_ts = v.get('updated')
                    break
        else:
            updated_ts = None
        # Convert updated_ts (ms since epoch) to readable date/time
        if updated_ts:
            date = datetime.datetime.fromtimestamp(updated_ts / 1000).strftime('%Y-%m-%d %H:%M:%S')
        else:
            date = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        if suburb and name and address and price and postcode:
            petrol_data.append({
                'date': date,
                'suburb': suburb,
                'station': name,
                'address': address,
                'postcode': postcode,
                'price': price,
                'lat': lat,
                'lng': lng
            })

    if not petrol_data:
        print("No petrol data found in API responses.")
        return

    # Store data in SQLite database
    db_path = 'backend/data/history.db'
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    # Create table if not exists (add address, lat, lng columns)
    c.execute('''
        CREATE TABLE IF NOT EXISTS petrol_prices (
            postcode TEXT,
            suburb TEXT,
            station TEXT,
            address TEXT,
            lat REAL,
            lng REAL,
            date TEXT,
            price REAL
        )
    ''')
    # Insert records
    for record in petrol_data:
        c.execute('''
            INSERT INTO petrol_prices (postcode, suburb, station, address, lat, lng, date, price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record['postcode'],
            record['suburb'],
            record['station'],
            record['address'],
            record['lat'],
            record['lng'],
            record['date'],
            record['price']
        ))
    conn.commit()
    conn.close()
    print(f"Saved {len(petrol_data)} records to {db_path}")

if __name__ == "__main__":
    scrape_petrol_prices()
# This will run the scraping function when the script is executed
# Ensure you have the necessary packages installed: selenium, webdriver_manager, pandas, beautifulsoup4
# You may need to adjust the sleep times based on your internet speed and the website's loading time
# Make sure to run this script in an environment where you can install and use Selenium and the Chrome WebDriver