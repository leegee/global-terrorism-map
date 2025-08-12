import { createSignal, onMount } from "solid-js";
import styles from "./App.module.scss";
import { initDB } from "../lib/db";
import DateRangeControl from "./DateRangeControl";
import MapComponent from "./Map";

export default function App() {
    const [db, setDb] = createSignal<any>(null);
    const [dateRange, setDateRange] = createSignal<[string, string]>(["1970", "2021"]);

    onMount(async () => {
        const database = await initDB("/globalterrorismdb.sqlite");
        setDb(database);
    });

    return (
        <section class={styles.component}>

            <footer class={styles.controls + ' fill'}>
                <nav>
                    <DateRangeControl initialRange={dateRange()} onChange={setDateRange} />
                </nav>
            </footer>

            <section class={styles.map}>
                {db() && (
                    <MapComponent
                        db={db()}
                        dateRange={dateRange()}
                    />
                )}
            </section>
        </section>
    );
}
