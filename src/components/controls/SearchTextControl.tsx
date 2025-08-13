import { mapState, setMapState } from "../../store";

export default function SearchTextControl() {
    const q = () => mapState.q;

    const onBlur = (value: string) => setMapState("q", value.trim());

    return (
        <div class="field label border no-padding small round">
            <input
                type="text"
                placeholder=" "
                value={q()}
                onInput={e => onBlur(e.currentTarget.value)}
            />
            <label>Search terms</label>
        </div>
    );
}
