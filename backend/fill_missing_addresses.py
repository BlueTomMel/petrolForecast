"""
Update old records in petrol_prices table to fill missing addresses using the address from the latest record for each (postcode, suburb, station).
"""
import sqlite3

def fill_missing_addresses(db_path='backend/data/history.db'):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    # Find latest address for each (postcode, suburb, station)
    c.execute('''
        SELECT postcode, suburb, station, address
        FROM petrol_prices
        WHERE address != '' AND address IS NOT NULL AND date = (
            SELECT MAX(date) FROM petrol_prices p2
            WHERE p2.postcode = petrol_prices.postcode
              AND p2.suburb = petrol_prices.suburb
              AND p2.station = petrol_prices.station
        )
    ''')
    latest_addresses = c.fetchall()
    updated = 0
    for postcode, suburb, station, address in latest_addresses:
        # Update all records for this station with missing address
        c.execute('''
            UPDATE petrol_prices
            SET address = ?
            WHERE postcode = ? AND suburb = ? AND station = ? AND (address IS NULL OR address = '')
        ''', (address, postcode, suburb, station))
        updated += c.rowcount
    conn.commit()
    conn.close()
    print(f"Updated {updated} records with missing addresses.")

if __name__ == "__main__":
    fill_missing_addresses()
