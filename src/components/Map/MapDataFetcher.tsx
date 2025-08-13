import { createEffect, onCleanup } from "solid-js";
import { type Event, mapState, setMapState } from "../../store";
import { type Database, queryEventsLatLng } from "../../lib/db";

interface Props {
    map: maplibregl.Map;
    db: Database;
}

export default function MapDataFetcher(props: Props) {
    const map = props.map;
    const db = props.db;

    if (!map || !db) return null;

    const HEATMAP_ZOOM_LEVEL = 6;

    async function fetchEvents() {
        const zoom = map.getZoom();
        const bounds = map.getBounds();
        const [startYear, endYear] = mapState.dateRange;

        const events: Event[] = (await queryEventsLatLng(
            db,
            zoom < HEATMAP_ZOOM_LEVEL,
            zoom,
            (bounds.getNorth() + bounds.getSouth()) / 2,
            bounds.getSouth(),
            bounds.getNorth(),
            bounds.getWest(),
            bounds.getEast(),
            mapState.q,
            startYear,
            endYear
        )).map(ev => ({
            ...ev,
            eventid: ev.eventid || String(Math.random()),
        }));

        setMapState("results", events);
        setMapState("count", events.length);
    }

    createEffect(() => {
        if (!db || !map) return;
        mapState.q;
        mapState.dateRange;
        fetchEvents();
    });

    const onMoveEnd = () => fetchEvents();
    map.on("moveend", onMoveEnd);

    onCleanup(() => {
        map.off("moveend", onMoveEnd);
    });

    return null;
}
