import { createSignal, createEffect } from 'solid-js';

type DateRange = [string, string];

interface InputTextControlProps {
    q?: string;
    onChange: (q: string) => void;
}

export default function SearchTextControl(props: InputTextControlProps) {
    const [q, setQ] = createSignal(props.q);

    createEffect(() => {
        props.onChange(q());
    });

    return (
        <div class="field label suffix border small">
            <input type="text" onBlur={e => setQ(e.currentTarget.value.trim())} placeholder=' ' />
            <label>Search</label>
            <i>search</i>
        </div>
    );
}
