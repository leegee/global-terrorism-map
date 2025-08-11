import sqlite3
import pandas as pd
import json

file1 = 'globalterrorismdb_0522dist.xlsx'
file2 = 'globalterrorismdb_2021Jan-June_1222dist.xlsx'
sqlLiteFile = '../public/globalterrorismdb.sqlite'
schema_file = '../src/scheme.json'

# Expects format { columnName: { "type": "...", "display": "..." } }
with open(schema_file, 'r') as f:
    schema = json.load(f)

columns_to_save = list(schema.keys())

# Read Excel files
df1 = pd.read_excel(file1)
df2 = pd.read_excel(file2)

# Combine dataframes
df = pd.concat([df1, df2], ignore_index=True)

# Filter out rows missing latitude or longitude
df = df.dropna(subset=['latitude', 'longitude'])

df = df[columns_to_save]

# Compose SQLite CREATE TABLE schema dynamically based on columns_to_save and schema.json types
schema_parts = []
for col in columns_to_save:
    col_type = schema.get(col, {}).get('type', 'TEXT')  # fallback to TEXT
    schema_parts.append(f"{col} {col_type}")

create_table_sql = f'''
CREATE TABLE IF NOT EXISTS events (
    {', '.join(schema_parts)}
)
'''

conn = sqlite3.connect(sqlLiteFile)
cur = conn.cursor()

cur.execute('DROP TABLE IF EXISTS events')

cur.execute(create_table_sql)
cur.execute('DELETE FROM events')  # Clear old data

df.to_sql('events', conn, if_exists='append', index=False)

conn.commit()
conn.close()

print("SQLite DB created:", sqlLiteFile)
