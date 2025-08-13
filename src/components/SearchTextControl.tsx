import { mapState, setMapState } from "../store";
import { forceSearch } from "../lib/forced-search-event";

export default function SearchTextControl() {
    const q = () => mapState.q;

    const onBlur = (value: string) => {
        setMapState("q", value.trim());
    };

    return (
        <nav class="no-space">
            <div class="small field border left-round">
                <input
                    type="text"
                    placeholder="Search"
                    value={q()}
                    onBlur={e => onBlur(e.currentTarget.value)}
                />
            </div>
            <button class="right-round" onClick={forceSearch}>Search</button>
        </nav>
    );
}
