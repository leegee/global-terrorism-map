// store.ts
import { createStore } from "solid-js/store";
import { initDB } from "./lib/db";

export const [mapState, setMapState] = createStore({
    db: null,
    dateRange: [null, null] as [string | null, string | null],
    q: "",
    count: 0
});

// Kick off DB load when the store is first imported
(async () => {
    const database = await initDB("/globalterrorismdb.sqlite");
    setMapState("db", database);
})();
