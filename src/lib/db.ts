import initSqlJs, { Database, SqlJsStatic } from "sql.js";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
const CLUSTER_SIZE = 0.25;
export const POINT_DIAMETER_PX = 12; // todo move

export type { Database };

// const ZOOM_TO_PIXEL_FACTOR = 2;

export function getPixelRadius(zoom: number) {
    const baseZoom = 6;       // reference zoom
    const baseRadius = 20;    // pixels at reference zoom
    return Math.max(4, Math.min(40, (baseRadius / baseZoom) * zoom));
}

function clusterSizeFromZoom(pixelRadius: number, zoom: number, lat: number) {
    // Degrees per pixel at current latitude
    const metersPerPixel = (156543.03392 * Math.cos(lat * Math.PI / 180)) / Math.pow(2, zoom);
    // Convert meters to degrees (approx)
    const degPerMeter = 1 / 111320; // avg meters per degree latitude
    const degRadius = metersPerPixel * pixelRadius * degPerMeter;

    return { latSize: degRadius, lonSize: degRadius / Math.cos(lat * Math.PI / 180) };
}

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

    return fanned;
}

export function queryEventsLatLng(
    db: Database,
    shouldCluster: boolean,
    zoom: number,
    centerLat: number,
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
    q: string,
    startYear?: string,
    endYear?: string,
) {
    const start = startYear ? parseInt(startYear, 10) : 1900;
    const end = endYear ? parseInt(endYear, 10) : new Date().getFullYear();
    const qCleaned = (q ?? '').trim();

    // const pixelRadius = Math.max(4, Math.min(20, POINT_DIAMETER_PX * (zoom / ZOOM_TO_PIXEL_FACTOR)));
    const pixelRadius = getPixelRadius(zoom);
    const { latSize, lonSize } = clusterSizeFromZoom(pixelRadius, zoom, centerLat);

    if (shouldCluster) {
        const sql = `
            SELECT
                ROUND(latitude / ?) * ? AS latitude,
                ROUND(longitude / ?) * ? AS longitude,
                COUNT(*) AS count
            FROM events
            WHERE latitude BETWEEN ? AND ?
              AND longitude BETWEEN ? AND ?
              AND iyear BETWEEN ? AND ?
            GROUP BY latitude, longitude
        `;
        const bindValues = [
            latSize, latSize,
            lonSize, lonSize,
            minLat, maxLat, minLon, maxLon,
            start, end
        ];
        const stmt = db.prepare(sql);
        const rows: Array<{ latitude: number; longitude: number; count: number }> = [];
        stmt.bind(bindValues);
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();

        return rows;
    }

    let sql = `
    SELECT eventid, latitude, longitude
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

    console.log('Point set size', fanned.length)

    return fanned;
}

export function getEventById(eventId: number): { [key: string]: any } | null {
    const stmt = db.prepare(`SELECT * FROM events WHERE eventid = ? LIMIT 1`);

    try {
        stmt.bind([eventId]);
        if (stmt.step()) {
            return stmt.getAsObject();
        }
        return null;
    } finally {
        stmt.free();
    }
}
