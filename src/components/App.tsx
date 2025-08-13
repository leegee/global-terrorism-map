import { createEffect, onMount } from "solid-js";
import styles from "./App.module.scss";
import DateRangeControl from "./controls/DateRangeControl";
import MapComponent from "./Map";
import SearchTextControl from "./controls/SearchTextControl";
import { mapState, setMapState } from "../store";
import { initDB } from "../lib/db";

export default function App() {
    onMount(async () => {
        const db = await initDB("/globalterrorismdb.sqlite");
        setMapState("db", db);
    });

    return (
        <main class={styles.component}>
            <footer class={styles.controls}>
                <nav class="no-space">
                    <DateRangeControl />
                    <SearchTextControl />
                </nav>
            </footer>

            {mapState.db
                ? <MapComponent />
                : <p>Loading database...</p>
            }
        </main>
    );
}
