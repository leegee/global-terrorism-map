import initSqlJs, { Database, SqlJsStatic } from "sql.js";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

export async function initDB(sqliteFileUrl: string): Promise<Database> {
    if (db) return db;

    if (!SQL) {
        SQL = await initSqlJs({
            locateFile: (file) => `node_modules/sql.js/dist/${file}`,
        });
    }

    const response = await fetch(sqliteFileUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch SQLite file: ${sqliteFileUrl}`);
    }

    const buffer = await response.arrayBuffer();
    db = new SQL.Database(new Uint8Array(buffer));
    return db;
}

export function queryEvents(
    db: Database,
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
    startYear?: string,
    endYear?: string
) {
    const start = startYear ? parseInt(startYear, 10) : 1970;
    const end = endYear ? parseInt(endYear, 10) : new Date().getFullYear();

    const sql = `
    SELECT eventid, iyear, country_txt, latitude, longitude, summary
    FROM events
    WHERE latitude BETWEEN ? AND ?
      AND longitude BETWEEN ? AND ?
      AND iyear BETWEEN ? AND ?
    ORDER BY iyear DESC
  `;

    const stmt = db.prepare(sql);
    const rows: any[] = [];

    try {
        stmt.bind([minLat, maxLat, minLon, maxLon, start, end]);

        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
    } finally {
        stmt.free();
    }

    // console.log(
    //     'row count', rows.length,
    //     'from sql', sql,
    //     'using bind', [minLat, maxLat, minLon, maxLon, start, end]
    // );

    return rows;
}
