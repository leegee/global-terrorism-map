import { createSignal, createEffect } from 'solid-js';
import styles from './HoverTooltip.module.scss';

type DateRange = [string, string];

interface DateRangeControlProps {
    initialRange?: DateRange;
    onChange: (range: DateRange) => void;
}

export function DateRangeControl(props: DateRangeControlProps) {
    const [minDate, setMinDate] = createSignal(props.initialRange?.[0] ?? '1970');
    const [maxDate, setMaxDate] = createSignal(props.initialRange?.[1] ?? new Date().getFullYear().toString());

    createEffect(() => {
        if (minDate() > maxDate()) {
            setMaxDate(minDate());
        }
        props.onChange([minDate(), maxDate()]);
    });

    return (
        <fieldset class={styles.component}>
            <legend>Date Range</legend>

            <div class="row">
                <div class="field border label">
                    <input
                        type="number"
                        value={minDate()}
                        onBlur={e => setMinDate(e.currentTarget.value)}
                        min={1970}
                        max={maxDate()}
                    />
                    <label>From</label>
                </div>

                <div class="field border label">
                    <input
                        type="number"
                        value={maxDate()}
                        onBlur={e => setMaxDate(e.currentTarget.value)}
                        min={minDate()}
                        max={new Date().getFullYear().toString()}
                    />
                    <label>To</label>
                </div>
            </div>
        </fieldset>
    );
}
