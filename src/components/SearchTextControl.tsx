import { createSignal, createEffect, Setter } from 'solid-js';
import { forceSearch } from '../lib/forced-search-event';

type DateRange = [string, string];

interface InputTextControlProps {
    q?: string;
    onChange: Setter<string>;
}


export default function SearchTextControl(props: InputTextControlProps) {
    const [q, setQ] = createSignal(props.q);


    createEffect(() => {
        props.onChange(q());
    });

    return (
        <nav class="no-space">
            <div class="small  field border left-round">
                <input type="text" placeholder=" " onBlur={e => setQ(e.currentTarget.value.trim())} />
            </div>
            <button class="right-round" onClick={forceSearch}>Search</button>
        </nav>
    );
}
