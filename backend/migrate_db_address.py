"""
Migrate existing petrol_prices table to new schema with address column.
- Adds 'address' column after 'station'.
- Sets address to empty string for old records.
"""
import sqlite3

def migrate_db_schema(db_path='backend/data/history.db'):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    # Check if address column exists
    c.execute("PRAGMA table_info(petrol_prices)")
    columns = [row[1] for row in c.fetchall()]
    if 'address' in columns:
        print("Address column already exists. No migration needed.")
        conn.close()
        return
    # Rename old table
    c.execute('ALTER TABLE petrol_prices RENAME TO petrol_prices_old')
    # Create new table with address column
    c.execute('''
        CREATE TABLE petrol_prices (
            postcode TEXT,
            suburb TEXT,
            station TEXT,
            address TEXT,
            date TEXT,
            price REAL
        )
    ''')
    # Copy data, set address to empty string
    c.execute('''
        INSERT INTO petrol_prices (postcode, suburb, station, address, date, price)
        SELECT postcode, suburb, station, '', date, price FROM petrol_prices_old
    ''')
    conn.commit()
    c.execute('DROP TABLE petrol_prices_old')
    conn.commit()
    conn.close()
    print("Migration complete. 'address' column added.")

if __name__ == "__main__":
    migrate_db_schema()
