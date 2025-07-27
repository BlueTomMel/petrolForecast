import sqlite3

def average_price_sydney():
    db_path = 'backend/data/history.db'
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    query = '''
        SELECT AVG(price)
        FROM petrol_prices
        WHERE postcode LIKE '2%' AND suburb IS NOT NULL AND price IS NOT NULL
    '''
    avg_price = c.execute(query).fetchone()[0]
    conn.close()
    if avg_price is None:
        print("No price data found for Sydney stations.")
    else:
        print(f"Average price for Sydney petrol stations: {avg_price:.2f}")

if __name__ == "__main__":
    average_price_sydney()
