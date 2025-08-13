import { createStore } from "solid-js/store";
import type { Database } from "./lib/db";

export interface Event {
    eventid: string;
    longitude: number;
    latitude: number;
    count?: number;
}

export interface MapState {
    db: Database | null;
    dateRange: [string, string];
    q: string;
    count: number;
    results: Event[];
}

export const [mapState, setMapState] = createStore<MapState>({
    db: null,
    dateRange: ["1970", "2021"],
    q: "",
    count: 0,
    results: [],
});
