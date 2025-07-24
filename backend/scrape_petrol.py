# Scrape petrol prices for Melbourne from PetrolSpy and save as CSV
#using selenium headed mode to handle clicking the list view button
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
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Step 1: navigate to PetrolSpy Melbourne page URL: "https://petrolspy.com.au/map/latlng/-37.814107/144.96328"
# Step 2: click this webelement <button id="list-view" class="button map-button map-control" style="z-index: 2147483647; float: right;"><div></div></button>
# Step 3: Parse HTML to extract suburb, station, price
# Step 4: Save to CSV with headers: date, suburb, station, price
def scrape_petrol_prices():
    # Replace this URL with the actual API endpoint you find in browser dev tools
    api_url = "https://www.petrolspy.com.au/webservice-1/station/box?neLat=-37.7&neLng=145.2&swLat=-38.1&swLng=144.7&fuelType=1"
    response = requests.get(api_url)
    if response.status_code != 200:
        print("Failed to fetch data from API")
        return

    data = response.json()
    print("Top-level keys in API response:", list(data.keys()))  # Debug
    print("Full API response (truncated):", str(data)[:300])  # Print only the first 300 chars

    message = data.get('message', {})
    print("Keys in data['message']:", list(message.keys()))  # Debug
    for k in message:
        print(f"Key '{k}' sample (truncated):", str(message[k])[:200])  # Print first 200 chars of each value

    stations = message.get('list', [])
    if stations:
        print("Sample station entry (truncated):", str(stations[0])[:300])  # Print only the first 300 chars

    petrol_data = []
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # Adjust this parsing based on the actual JSON structure
    for station in stations:
        suburb = station.get('suburb')
        name = station.get('name')
        postcode = station.get('postCode')  # Add postcode extraction
        price = None
        prices = station.get('prices', {})
        if 'U91' in prices and 'amount' in prices['U91']:
            price = prices['U91']['amount']
        elif prices:
            # fallback: get the first available price
            for v in prices.values():
                if 'amount' in v:
                    price = v['amount']
                    break
        if suburb and name and price and postcode:
            petrol_data.append({
                'date': now,
                'suburb': suburb,
                'station': name,
                'postcode': postcode,  # Add postcode to output
                'price': price
            })

    if not petrol_data:
        print("No petrol data found in API response.")
        return

    df = pd.DataFrame(petrol_data)
    csv_path = 'backend/data/history.csv'
    df.to_csv(csv_path, index=False, mode='a', header=not pd.io.common.file_exists(csv_path))
    print(f"Saved {len(petrol_data)} records to {csv_path}")

if __name__ == "__main__":
    scrape_petrol_prices()
# This will run the scraping function when the script is executed
# Ensure you have the necessary packages installed: selenium, webdriver_manager, pandas, beautifulsoup4
# You may need to adjust the sleep times based on your internet speed and the website's loading time
# Make sure to run this script in an environment where you can install and use Selenium and the Chrome WebDriver