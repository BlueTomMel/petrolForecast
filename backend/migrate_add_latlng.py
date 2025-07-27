"""
Migrate petrol_prices table to add lat REAL, lng REAL columns after address.
"""
import sqlite3

def migrate_add_latlng(db_path='backend/data/history.db'):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    # Check if lat/lng columns exist
    c.execute("PRAGMA table_info(petrol_prices)")
    columns = [row[1] for row in c.fetchall()]
    if 'lat' in columns and 'lng' in columns:
        print("lat/lng columns already exist. No migration needed.")
        conn.close()
        return
    # Rename old table
    c.execute('ALTER TABLE petrol_prices RENAME TO petrol_prices_old')
    # Create new table with lat/lng columns
    c.execute('''
        CREATE TABLE petrol_prices (
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
    # Copy data, set lat/lng to NULL
    c.execute('''
        INSERT INTO petrol_prices (postcode, suburb, station, address, lat, lng, date, price)
        SELECT postcode, suburb, station, address, NULL, NULL, date, price FROM petrol_prices_old
    ''')
    conn.commit()
    c.execute('DROP TABLE petrol_prices_old')
    conn.commit()
    conn.close()
    print("Migration complete. lat/lng columns added.")

if __name__ == "__main__":
    migrate_add_latlng()
