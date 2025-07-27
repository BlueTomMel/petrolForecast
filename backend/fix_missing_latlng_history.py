import sqlite3

DB_PATH = 'backend/data/history.db'
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Find all unique station+address combos
c.execute("SELECT DISTINCT station, address FROM petrol_prices")
stations = c.fetchall()
updated = 0
for station, address in stations:
    # Get latest record with valid lat/lng
    c.execute("SELECT lat, lng FROM petrol_prices WHERE station=? AND address=? AND lat IS NOT NULL AND lng IS NOT NULL AND lat != '' AND lng != '' ORDER BY date DESC LIMIT 1", (station, address))
    result = c.fetchone()
    if result:
        lat, lng = result
        # Update all previous records with missing/blank lat/lng
        c.execute("UPDATE petrol_prices SET lat=?, lng=? WHERE station=? AND address=? AND (lat IS NULL OR lng IS NULL OR lat='' OR lng='')", (lat, lng, station, address))
        count = c.rowcount
        if count:
            print(f"Updated {count} records for {station} at {address} with lat={lat}, lng={lng}")
            updated += count
            conn.commit()
print(f"Done. Populated {updated} missing lat/lng records.")
conn.close()
