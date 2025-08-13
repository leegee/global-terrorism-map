import initSqlJs, { Database, SqlJsStatic } from "sql.js";
import { HEATMAP_ZOOM_LEVEL } from "../config";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

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

export interface Point {
    latitude: number;
    longitude: number;
    [key: string]: any; // any other properties
}


export function fanPoints(
    rows: Point[],
    zoom: number,
    maxZoomForFanning = HEATMAP_ZOOM_LEVEL
): Point[] {
    if (!rows || rows.length === 0) return [];

    const doFan = zoom >= maxZoomForFanning;
    const grouped = new Map<string, Point[]>();

    for (const row of rows) {
        const key = `${row.latitude},${row.longitude}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(row);
    }

    const fanned: Point[] = [];
    const baseRadius = 0.002;
    const ringStep = 0.001;

    grouped.forEach((group, key) => {
        if (group.length === 1 || !doFan) {
            fanned.push(...group);
            return;
        }

        const [lat, lng] = key.split(",").map(Number);
        const latRad = (lat * Math.PI) / 180;

        let remaining = group.length;
        let idx = 0;
        let ring = 0;

        while (remaining > 0) {
            // const pointsInRing = Math.min(remaining, 6 + ring * 5); // increase capacity per ring
            const pointsInRing = Math.min(remaining, Math.ceil(3 * Math.pow(1.25, ring)));
            const radius = baseRadius + ring * ringStep;
            const startAngle = Math.random() * 2 * Math.PI; // random offset per ring

            for (let i = 0; i < pointsInRing; i++) {
                const angle = startAngle + (2 * Math.PI * i) / pointsInRing;
                const row = group[idx];

                row.latitude = lat + radius * Math.cos(angle);
                row.longitude = lng + (radius * Math.sin(angle)) / Math.cos(latRad);

                fanned.push(row);
                idx++;
            }

            remaining -= pointsInRing;
            ring++;
        }
    });

    return fanned;
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

    return fanPoints(rows as Point[], HEATMAP_ZOOM_LEVEL + 3);
}

export function queryEventsLatLng(
    db: Database,
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
    const shouldCluster = zoom <= HEATMAP_ZOOM_LEVEL;

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

    return fanPoints(rows as Point[], zoom);
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
