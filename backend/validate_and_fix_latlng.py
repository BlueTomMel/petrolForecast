import sqlite3
import requests
import time


# Use the history.db file for table inspection
DB_PATH = 'backend/data/history.db'
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

def is_valid_latlng(lat, lng):
    try:
        lat = float(lat)
        lng = float(lng)
        return -90 <= lat <= 90 and -180 <= lng <= 180
    except Exception:
        return False

def geocode(address):
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={requests.utils.quote(address)}"
    try:
        resp = requests.get(url, headers={'User-Agent': 'petrol-forecast-bot'})
        data = resp.json()
        if data:
            return float(data[0]['lat']), float(data[0]['lon'])
    except Exception:
        pass
    return None, None

def main():
    # Find all stations with blank or invalid lat/lng
    c.execute("SELECT rowid, station, address, lat, lng FROM petrol_prices")
    rows = c.fetchall()
    updated = 0
    for rowid, station, address, lat, lng in rows:
        if not is_valid_latlng(lat, lng):
            # Try to geocode using address
            if address:
                lat2, lng2 = geocode(address)
                if lat2 is not None and lng2 is not None:
                    c.execute("UPDATE petrol_prices SET lat=?, lng=? WHERE rowid=?", (lat2, lng2, rowid))
                    print(f"Updated {station} at {address} to lat={lat2}, lng={lng2}")
                    updated += 1
                    conn.commit()
                    time.sleep(1)  # Be nice to Nominatim
                else:
                    print(f"Could not geocode {station} at {address}")
            else:
                print(f"No address for {station}, cannot geocode.")
    print(f"Done. Updated {updated} stations.")

if __name__ == '__main__':
    # Print all table names for debugging
    print('Tables in database:')
    for row in c.execute("SELECT name FROM sqlite_master WHERE type='table'"):
        print('  -', row[0])
    main()
