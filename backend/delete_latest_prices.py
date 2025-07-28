import sqlite3

DB_PATH = 'backend/data/history.db'
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Find and delete the latest price record for each station/address/postcode
c.execute('''
    SELECT station, address, postcode, MAX(date) as max_date
    FROM petrol_prices
    GROUP BY station, address, postcode
''')
latest_records = c.fetchall()

deleted_count = 0
for station, address, postcode, max_date in latest_records:
    c.execute('''
        DELETE FROM petrol_prices
        WHERE station=? AND address=? AND postcode=? AND date=?
    ''', (station, address, postcode, max_date))
    deleted_count += c.rowcount

conn.commit()
conn.close()
print(f"Deleted {deleted_count} latest price records.")
