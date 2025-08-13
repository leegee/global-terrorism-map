import { mapState, setMapState } from "../store";

export default function DateRangeControl() {
    const minYear = () => mapState.dateRange[0];
    const maxYear = () => mapState.dateRange[1];

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
