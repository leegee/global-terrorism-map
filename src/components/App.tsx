import { createSignal, onMount } from "solid-js";
import styles from "./App.module.scss";
import { initDB } from "../lib/db";
import DateRangeControl from "./DateRangeControl";
import MapComponent from "./Map";
import SearchTextControl from "./SearchTextControl";

export default function App() {
    const [db, setDb] = createSignal<any>(null);
    const [dateRange, setDateRange] = createSignal<[string, string]>(["1970", "2021"]);
    const [q, setQ] = createSignal<string>('');

    onMount(async () => {
        const database = await initDB("/globalterrorismdb.sqlite");
        setDb(database);
    });

    return (
        <main class={styles.component}>

            <footer class={styles.controls}>
                <nav class='no-space'>
                    <DateRangeControl initialRange={dateRange()} onChange={setDateRange} />
                    <SearchTextControl q={q()} onChange={setQ} />
                </nav>
            </footer>

            {db() && (
                <MapComponent
                    db={db()}
                    dateRange={dateRange()}
                    q={q()}
                />
            )}

            {!db() && <p>Loading database...</p>}

        </main>
    );
}
