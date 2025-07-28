import sqlite3
from collections import defaultdict

DB_PATH = 'backend/data/history.db'
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

postcode = '3103'
print(f"Petrol stations in Camberwell (postcode {postcode}):")

# Fetch all records for the postcode, ordered by station, address, and date descending
rows = c.execute("SELECT station, address, price, date FROM petrol_prices WHERE postcode=? ORDER BY station, address, date DESC", (postcode,)).fetchall()

# Group by station+address, keep only the two most recent records
station_map = defaultdict(list)
for row in rows:
    key = (row[0], row[1])  # (station, address)
    if len(station_map[key]) < 2:
        station_map[key].append(row)

for key, prices in station_map.items():
    print(f"Station: {key[0]}, Address: {key[1]}")
    for price_info in prices:
        print(f"  Price: {price_info[2]}, Date: {price_info[3]}")
    print("-" * 40)

conn.close()
