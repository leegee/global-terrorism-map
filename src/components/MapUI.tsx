import { createSignal, onMount } from "solid-js";
import styles from "./MapUI.module.scss";
import { initDB } from "../lib/db";
import { DateRangeControl } from "./DateRangeControl";
import MapComponent from "./Map/Base";

export default function HomePage() {
    const [db, setDb] = createSignal<any>(null);
    const [dateRange, setDateRange] = createSignal<[string, string]>(["1970", "2021"]);

    onMount(async () => {
        const database = await initDB("/globalterrorismdb.sqlite");
        setDb(database);
    });

    return (
        <section class={styles.component}>
            <aside class={styles.controls}>
                <DateRangeControl initialRange={dateRange()} onChange={setDateRange} />
            </aside>

            <div class={styles.map}>
                {db() && (
                    <MapComponent
                        db={db()}
                        dateRange={dateRange()}
                    />
                )}
            </div>
        </section>
    );
}
