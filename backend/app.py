from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import math
import requests
import os
import json
from threading import Lock

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
DATA_DIR = os.path.join(BASE_DIR, 'backend', 'data')
DB_PATH = os.path.join(DATA_DIR, 'history.db')
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')

# Enable CORS after app is defined
from flask_cors import CORS
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})

# --- Suburb Candidates API endpoint ---
@app.route('/api/suburb_candidates')
def suburb_candidates():
    suburb = request.args.get('suburb', '').strip().lower()
    if not suburb:
        return jsonify({'candidates': []})
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Try exact match first
    c.execute("SELECT DISTINCT suburb, postcode FROM latest_petrol_prices WHERE LOWER(suburb)=? ORDER BY postcode", (suburb,))
    rows = c.fetchall()
    # If no exact match, try fuzzy match (LIKE)
    if not rows:
        like_pattern = f"%{suburb}%"
        c.execute("SELECT DISTINCT suburb, postcode FROM latest_petrol_prices WHERE LOWER(suburb) LIKE ? ORDER BY suburb, postcode", (like_pattern,))
        rows = c.fetchall()
    # Always include capital city + postcode as a candidate if search matches a major city
    city_fallbacks = {
        'melbourne': '3000',
        'sydney': '2000',
        'brisbane': '4000',
        'adelaide': '5000',
        'perth': '6000',
        'hobart': '7000',
        'darwin': '0800',
        'canberra': '2600',
    }
    candidates = [dict(suburb=row[0], postcode=row[1]) for row in rows]
    city_key = suburb.strip().lower()
    if city_key in city_fallbacks:
        city_candidate = {'suburb': city_key.title(), 'postcode': city_fallbacks[city_key]}
        # Only add if not already present
        if city_candidate not in candidates:
            candidates.insert(0, city_candidate)
    # If still no candidates, use Nominatim to geocode and extract postcode
    if not candidates:
        try:
            url = f"https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q={suburb}, Australia"
            resp = requests.get(url, headers={'User-Agent': 'petrol-forecast-bot'})
            data = resp.json()
            if data:
                best = data[0]
                # Try to extract postcode and suburb name from address
                address = best.get('address', {})
                nom_suburb = address.get('suburb') or address.get('city') or address.get('town') or address.get('village') or suburb.title()
                postcode = address.get('postcode', '')
                if nom_suburb and not postcode and city_key in city_fallbacks:
                    postcode = city_fallbacks[city_key]
                # Removed stray 'i' character that caused syntax error
                if nom_suburb and postcode:
                    candidates.append({'suburb': nom_suburb, 'postcode': postcode})
        except Exception:
            pass
    conn.close()
    return jsonify({'candidates': candidates})

# --- Forecast API endpoint ---
@app.route('/api/forecast')
def api_forecast():
    city = request.args.get('city', '').strip().lower()
    city_map = {
        'melbourne': 'Melbourne',
        'sydney': 'Sydney',
        'brisbane': 'Brisbane',
    }
    city_name = city_map.get(city)
    if not city_name:
        return {"error": "Invalid city."}, 400
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        SELECT forecast_text, created_at FROM petrol_forecast
        WHERE city = ?
        ORDER BY forecast_date DESC, created_at DESC
        LIMIT 1
    ''', (city_name,))
    row = c.fetchone()
    conn.close()
    if row:
        forecast_text, created_at = row
        # Format created_at for display (YYYY-MM-DD HH:MM:SS)
        try:
            from datetime import datetime
            dt = datetime.strptime(created_at[:19], "%Y-%m-%d %H:%M:%S")
            created_at_str = dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            created_at_str = created_at
        return {"forecast_text": forecast_text, "created_at": created_at_str}
    else:
        return {"forecast_text": None, "created_at": None}


## Removed duplicate Flask app initialization here. Only the first initialization at the top is used.

# --- Geocode cache (JSON file) ---
GEOCODE_CACHE_PATH = os.path.join(DATA_DIR, 'geocode_cache.json')
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

def geocode_cached(suburb, postcode=None):
    # Fallback coordinates for capital city+postcode pairs
    city_coords = {
        ('melbourne', '3000'): (-37.8142454, 144.9631732),
        ('sydney', '2000'): (-33.8688, 151.2093),
        ('brisbane', '4000'): (-27.4698, 153.0251),
        ('adelaide', '5000'): (-34.9285, 138.6007),
        ('perth', '6000'): (-31.9505, 115.8605),
        ('hobart', '7000'): (-42.8821, 147.3272),
        ('darwin', '0800'): (-12.4634, 130.8456),
        ('canberra', '2600'): (-35.2820, 149.1286),
    }
    key = suburb.strip().lower()
    if postcode:
        city_key = (key, str(postcode).strip())
        if city_key in city_coords:
            return city_coords[city_key]
    cache = load_geocode_cache()
    if postcode:
        key = f"{key} {str(postcode).strip()}"
    if key in cache:
        return cache[key]['lat'], cache[key]['lng']
    # Compose query for geocoding
    query = suburb
    if postcode:
        query = f"{suburb} {postcode}"
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={query}, Australia"
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
    postcode = request.args.get('postcode')
    max_dist = request.args.get('distance', type=float)
    if not suburb or max_dist is None:
        return jsonify({'error': 'Missing suburb or distance'}), 400
    # Result cache lookup (include postcode in key if provided)
    cache_key = f"{suburb.strip().lower()}|{postcode or ''}|{max_dist}"
    with _result_cache_lock:
        if cache_key in _result_cache:
            return jsonify(_result_cache[cache_key])
    lat, lng = geocode_cached(suburb, postcode)
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
    conn = sqlite3.connect(DB_PATH)
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

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
