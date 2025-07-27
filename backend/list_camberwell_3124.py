import sqlite3

DB_PATH = 'backend/data/history.db'
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

postcode = '3124'
print(f"Petrol stations in Camberwell (postcode {postcode}):")
for row in c.execute("SELECT * FROM petrol_prices WHERE postcode=? ORDER BY station", (postcode,)):
    print(row)
conn.close()
