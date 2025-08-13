import { mapState, setMapState } from "../store";

const DB_MIN_YEAR = 1970;
const DB_MAX_YEAR = 2022;

export default function DateRangeControl() {
    const minYear = () => {
        const v = Number(mapState.dateRange?.[0] ?? DB_MIN_YEAR);
        const max = Number(mapState.dateRange?.[1] ?? DB_MAX_YEAR);
        const clamped = Math.min(Math.max(v, DB_MIN_YEAR), max);
        return clamped.toString();
    };

    const maxYear = () => {
        const v = Number(mapState.dateRange?.[1] ?? DB_MAX_YEAR);
        const min = Number(mapState.dateRange?.[0] ?? DB_MIN_YEAR);
        const clamped = Math.max(Math.min(v, DB_MAX_YEAR), min);
        return clamped.toString();
    };

    const setRange = (newRange: [string, string]) => {
        const [min, max] = newRange;
        setMapState("dateRange", [min, max]);
    };

    const onMinBlur = (value: string) => {
        if (value > maxYear()) setRange([value, value]);
        else setRange([value, maxYear()]);
    };

    const onMaxBlur = (value: string) => {
        if (value < minYear()) setRange([value, value]);
        else setRange([minYear(), value]);
    };

    return (
        <>
            <div class="field label border no-padding small round">
                <input
                    type="number"
                    value={minYear()}
                    onBlur={e => onMinBlur(e.currentTarget.value)}
                    min={1970}
                    max={maxYear()}
                />
                <label>From</label>
            </div>

            <div class="field label border no-padding small round">
                <input
                    type="number"
                    value={maxYear()}
                    onBlur={e => onMaxBlur(e.currentTarget.value)}
                    min={minYear()}
                    max={new Date().getFullYear().toString()}
                />
                <label>To</label>
            </div>
        </>
    );
}
