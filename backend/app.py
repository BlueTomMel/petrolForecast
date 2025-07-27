
from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import math
import requests
import os

app = Flask(__name__, static_folder='../frontend', static_url_path='')

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

@app.route('/api/stations_in_range')
def stations_in_range():
    suburb = request.args.get('suburb')
    max_dist = request.args.get('distance', type=float)
    if not suburb or max_dist is None:
        return jsonify({'error': 'Missing suburb or distance'}), 400
    lat, lng = geocode(suburb)
    if lat is None or lng is None:
        return jsonify({'error': f'Could not geocode suburb: {suburb}'}), 400
    DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'history.db')
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
                gmaps_url = f"https://www.google.com/maps/dir/?api=1&origin={station_lat},{station_lng}&destination={lat},{lng}"
                record = dict(zip(columns, row))
                record['distance_km'] = round(dist, 2)
                record['gmaps_url'] = gmaps_url
                results.append(record)
        except Exception:
            continue
    results.sort(key=lambda x: x['distance_km'])
    conn.close()
    return jsonify(results)

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
