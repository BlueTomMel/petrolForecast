import sqlite3

DB_PATH = 'backend/data/history.db'
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

print("Petrol stations with missing location info:")
query = '''
SELECT station, address, postcode, suburb, date, price, lat, lng
FROM petrol_prices
WHERE lat IS NULL OR lng IS NULL OR lat='' OR lng=''
ORDER BY station, address, date DESC
'''
for row in c.execute(query):
    print(row)
conn.close()
