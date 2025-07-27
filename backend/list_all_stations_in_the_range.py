
import sqlite3
import math
import sys
import requests

def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    lat1, lng1, lat2, lng2 = map(float, [lat1, lng1, lat2, lng2])
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a = math.sin(dLat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def geocode(suburb):
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={suburb}, Australia"
    try:
        resp = requests.get(url, headers={'User-Agent': 'petrol-forecast-bot'})
        data = resp.json()
        if data:
            return float(data[0]['lat']), float(data[0]['lon'])
    except Exception:
        pass
    return None, None

def main():
    if len(sys.argv) < 3:
        print("Usage: python list_stations_within.py <suburb> <distance_km>")
        sys.exit(1)
    suburb = sys.argv[1]
    try:
        max_dist = float(sys.argv[2])
    except Exception:
        print("Distance must be a number.")
        sys.exit(1)

    lat, lng = geocode(suburb)
    if lat is None or lng is None:
        print(f"Could not geocode suburb: {suburb}")
        sys.exit(1)
    print(f"Suburb '{suburb}' center: lat={lat}, lng={lng}")

    DB_PATH = 'backend/data/history.db'
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    query = '''
    SELECT * FROM petrol_prices p
    WHERE p.date = (
        SELECT MAX(date) FROM petrol_prices p2 WHERE p2.station=p.station AND p2.address=p.address
    )
    AND lat IS NOT NULL AND lng IS NOT NULL AND lat != '' AND lng != ''
    '''
    c.execute("PRAGMA table_info(petrol_prices)")
    columns = [col[1] for col in c.fetchall()]
    lat_idx = columns.index('lat')
    lng_idx = columns.index('lng')
    results = []
    for row in c.execute(query):
        station_lat, station_lng = row[lat_idx], row[lng_idx]
        try:
            dist = haversine(lat, lng, station_lat, station_lng)
            if dist <= max_dist:
                # Google Maps directions: origin=station, destination=suburb
                gmaps_url = f"https://www.google.com/maps/dir/?api=1&origin={station_lat},{station_lng}&destination={lat},{lng}"
                results.append((row, dist, gmaps_url))
        except Exception:
            continue
    # Sort by distance ascending
    results.sort(key=lambda x: x[1])
    for r, dist, gmaps_url in results:
        print(r, f"Distance: {dist:.2f} km", gmaps_url)
    conn.close()

if __name__ == '__main__':
    main()
