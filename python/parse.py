import sqlite3
import pandas as pd

file1 = 'globalterrorismdb_0522dist.xlsx'
file2 = 'globalterrorismdb_2021Jan-June_1222dist.xlsx'
sqlLiteFile = '../public/globalterrorismdb.sqlite'

df1 = pd.read_excel(file1)
df2 = pd.read_excel(file2)

df = pd.concat([df1, df2], ignore_index=True)

# Filter out rows without lat/lon
df = df.dropna(subset=['latitude', 'longitude'])

# Columns to save - just edit this list to change columns included
columns_to_save = ['eventid', 'iyear', 'country_txt', 'latitude', 'longitude', 'summary']

df = df[columns_to_save]

conn = sqlite3.connect(sqlLiteFile)
cur = conn.cursor()

# Dynamically create the CREATE TABLE statement based on columns_to_save and their types
# Here we assume types based on your current list, adjust if you change columns

column_types = {
    'eventid': 'INTEGER',
    'iyear': 'INTEGER',
    'country_txt': 'TEXT',
    'latitude': 'REAL',
    'longitude': 'REAL',
    'summary': 'TEXT',
    "attacktype1_txt": "TEXT",
    "targtype1_txt": "TEXT",
    "weaptype1_txt": "TEXT",
    "nkill": "INTEGER",
    "nwound ": "INTEGER",
    "gname": "TEXT",
    "motive": "TEXT",
    "summary": "TEXT",
    "claimed": "BOOLEAN",
    "success": "BOOLEAN",
}

# Compose SQL parts for table schema
schema_parts = [f"{col} {column_types.get(col, 'TEXT')}" for col in columns_to_save]
create_table_sql = f'''
CREATE TABLE IF NOT EXISTS events (
    {', '.join(schema_parts)}
)
'''

cur.execute(create_table_sql)

# Clear existing data if needed
cur.execute('DELETE FROM events')

# Insert rows
df.to_sql('events', conn, if_exists='append', index=False)

conn.commit()
conn.close()

print("SQLite DB created:", sqlLiteFile)
