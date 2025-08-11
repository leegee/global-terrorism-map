// src/db.ts
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

// Initialize sql.js once
export async function initDB(sqliteFileUrl: string): Promise<Database> {
    if (db) return db;

    if (!SQL) {
        SQL = await initSqlJs({
            locateFile: (file) => `/node_modules/sql.js/dist/${file}`, // adjust path if needed
        });
    }

    // Fetch the SQLite file as Uint8Array
    const response = await fetch(sqliteFileUrl);
    const buffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    // Load DB from Uint8Array
    db = new SQL.Database(uint8Array);
    return db;
}

// Example query helper
export function queryEvents(
    db: Database,
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
) {
    const stmt = db.prepare(`
    SELECT eventid, iyear, country_txt, latitude, longitude, summary
    FROM events
    WHERE latitude BETWEEN :minLat AND :maxLat
      AND longitude BETWEEN :minLon AND :maxLon
  `);

    stmt.bind({
        ':minLat': minLat,
        ':maxLat': maxLat,
        ':minLon': minLon,
        ':maxLon': maxLon,
    });

    const rows: Array<Record<string, any>> = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}
