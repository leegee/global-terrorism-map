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

function escapeLike(str: string) {
    return str.replace(/([%_\\])/g, '\\$1');
}

export function queryEvents(
    db: Database,
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
    q: string,
    startYear?: string,
    endYear?: string
) {
    const start = startYear ? parseInt(startYear, 10) : 1900;
    const end = endYear ? parseInt(endYear, 10) : new Date().getFullYear();
    const qCleaned = (q ?? '').trim();

    let sql = `
    SELECT eventid, iyear, country_txt, latitude, longitude, summary
    FROM events
    WHERE latitude BETWEEN ? AND ?
      AND longitude BETWEEN ? AND ?
      AND iyear BETWEEN ? AND ?
  `;
    const bindValues: (number | string)[] = [minLat, maxLat, minLon, maxLon, start, end];

    if (qCleaned) {
        sql += " AND summary LIKE ? ESCAPE '\\'";
        bindValues.push(`%${escapeLike(qCleaned)}%`);
    }

    sql += ' ORDER BY iyear DESC';

    const stmt = db.prepare(sql);
    const rows: Array<{ [key: string]: any }> = [];

    try {
        stmt.bind(bindValues);

        while (stmt.step()) {
            const row = stmt.getAsObject();
            rows.push(row);
        }
    } finally {
        stmt.free();
    }

    // Fan out duplicates with radius scaling and longitude correction
    const grouped = new Map<string, any[]>();
    for (const row of rows) {
        const key = `${row.latitude},${row.longitude}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(row);
    }

    const fanned: Array<{ [key: string]: any }> = [];
    const baseRadius = 0.0001;

    grouped.forEach((group, key) => {
        if (group.length === 1) {
            fanned.push(group[0]);
            return;
        }

        const [lat, lng] = key.split(",").map(Number);
        const latRad = (lat * Math.PI) / 180;

        // Scale the outter ring
        const radius = baseRadius * Math.sqrt(group.length) * 20;

        group.forEach((row, i) => {
            const angle = (2 * Math.PI * i) / group.length;
            row.latitude = lat + radius * Math.cos(angle);
            row.longitude = lng + (radius * Math.sin(angle)) / Math.cos(latRad);
            fanned.push(row);
        });
    });

    // console.log(
    //     "row count", fanned.length,
    //     "from sql", sql,
    //     "using bind", [minLat, maxLat, minLon, maxLon, start, end]
    // );

    console.log(fanned.length)

    return fanned;
}

