import sqlite3

def list_prices_3124_camberwell():
    db_path = 'backend/data/history.db'
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    query = '''
        SELECT postcode, suburb, station, date, price
        FROM petrol_prices
        WHERE postcode = '3124' AND LOWER(suburb) = 'camberwell'
        ORDER BY date DESC
    '''
    rows = c.execute(query).fetchall()
    conn.close()
    if not rows:
        print("No records found for 3124 Camberwell.")
        return
    print(f"Found {len(rows)} records for 3124 Camberwell:")
    for row in rows:
        print(f"Postcode: {row[0]}, Suburb: {row[1]}, Station: {row[2]}, Date: {row[3]}, Price: {row[4]}")

if __name__ == "__main__":
    list_prices_3124_camberwell()
