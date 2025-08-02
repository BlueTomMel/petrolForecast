

from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import math
import requests
import os
import json
from threading import Lock

app = Flask(__name__, static_folder='../frontend', static_url_path='')

# --- Geocode cache (JSON file) ---
GEOCODE_CACHE_PATH = os.path.join(os.path.dirname(__file__), 'data', 'geocode_cache.json')
_geocode_cache = None
_geocode_cache_lock = Lock()

def load_geocode_cache():
    global _geocode_cache
    if _geocode_cache is None:
        if os.path.exists(GEOCODE_CACHE_PATH):
            with open(GEOCODE_CACHE_PATH, 'r') as f:
                _geocode_cache = json.load(f)
        else:
            _geocode_cache = {}
    return _geocode_cache

def save_geocode_cache():
    global _geocode_cache
    with open(GEOCODE_CACHE_PATH, 'w') as f:
        json.dump(_geocode_cache, f)

def geocode_cached(suburb):
    cache = load_geocode_cache()
    key = suburb.strip().lower()
    if key in cache:
        return cache[key]['lat'], cache[key]['lng']
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={suburb}, Australia"
    try:
        resp = requests.get(url, headers={'User-Agent': 'petrol-forecast-bot'})
        data = resp.json()
        if data:
            lat, lng = float(data[0]['lat']), float(data[0]['lon'])
            cache[key] = {'lat': lat, 'lng': lng}
            save_geocode_cache()
            return lat, lng
    except Exception:
        pass
    return None, None

def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    lat1, lng1, lat2, lng2 = map(float, [lat1, lng1, lat2, lng2])
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a = math.sin(dLat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# --- In-memory station data cache ---
_station_data = None
_station_data_lock = Lock()

def load_station_data():
    global _station_data
    if _station_data is None:
        DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'history.db')
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT * FROM latest_petrol_prices WHERE lat IS NOT NULL AND lng IS NOT NULL AND lat != '' AND lng != ''")
        columns = [desc[0] for desc in c.description]
        _station_data = [dict(zip(columns, row)) for row in c.fetchall()]
        conn.close()
    return _station_data

def refresh_station_data():
    global _station_data
    _station_data = None
    return load_station_data()

# --- Result cache (suburb+distance) ---
_result_cache = {}
_result_cache_lock = Lock()

def get_result_cache_key(suburb, distance):
    return f"{suburb.strip().lower()}|{distance}"

@app.route('/api/stations_in_range')
def stations_in_range():
    suburb = request.args.get('suburb')
    max_dist = request.args.get('distance', type=float)
    if not suburb or max_dist is None:
        return jsonify({'error': 'Missing suburb or distance'}), 400
    # Result cache lookup
    cache_key = get_result_cache_key(suburb, max_dist)
    with _result_cache_lock:
        if cache_key in _result_cache:
            return jsonify(_result_cache[cache_key])
    lat, lng = geocode_cached(suburb)
    if lat is None or lng is None:
        # Try to suggest a similar suburb using Nominatim
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={suburb}, Australia"
        try:
            resp = requests.get(url, headers={'User-Agent': 'petrol-forecast-bot'})
            data = resp.json()
            if data:
                suggestion = data[0]['display_name'].split(',')[0]
                return jsonify({'error': f'Could not geocode suburb: {suburb}', 'suggestion': suggestion}), 200
        except Exception:
            pass
        return jsonify({'error': f'Could not geocode suburb: {suburb}'}), 200
    # Use in-memory station data
    stations = load_station_data()
    results = []
    for record in stations:
        try:
            station_lat = float(record['lat'])
            station_lng = float(record['lng'])
            dist = haversine(lat, lng, station_lat, station_lng)
            if dist <= max_dist:
                gmaps_url = f"https://www.google.com/maps/dir/?api=1&origin={lat},{lng}&destination={station_lat},{station_lng}"
                record_out = dict(record)
                record_out['distance_km'] = round(dist, 2)
                record_out['gmaps_url'] = gmaps_url
                results.append(record_out)
        except Exception:
            continue
    # Deduplicate by station+address+date
    dedup_map = {}
    for r in results:
        key = f"{r['station']}|{r['address']}|{r['postcode']}|{r['date']}"
        if key not in dedup_map:
            dedup_map[key] = r
    dedup_results = list(dedup_map.values())
    dedup_results.sort(key=lambda x: x['distance_km'])
    # Store in result cache
    with _result_cache_lock:
        _result_cache[cache_key] = dedup_results
    return jsonify(dedup_results)

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

@app.route('/api/prices')
def get_prices():
    db_path = os.path.join(os.path.dirname(__file__), 'data', 'history.db')
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    # Get only the latest price for each unique station (postcode, suburb, station, address)
    c.execute('''
        SELECT p1.postcode, p1.suburb, p1.station, p1.address, p1.lat, p1.lng, p1.date, p1.price
        FROM petrol_prices p1
        INNER JOIN (
            SELECT postcode, suburb, station, address, MAX(date) as max_date
            FROM petrol_prices
            GROUP BY postcode, suburb, station, address
        ) p2
        ON p1.postcode = p2.postcode AND p1.suburb = p2.suburb AND p1.station = p2.station AND p1.address = p2.address AND p1.date = p2.max_date
        ORDER BY p1.postcode, p1.suburb, p1.station, p1.address
    ''')
    rows = c.fetchall()
    conn.close()
    data = [
        {
            'postcode': row[0],
            'suburb': row[1],
            'station': row[2],
            'address': row[3],
            'lat': row[4],
            'lng': row[5],
            'date': row[6],
            'price': row[7]
        } for row in rows
    ]
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True)
