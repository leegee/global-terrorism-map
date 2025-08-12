const EVENT_NAME = 'force-search';

const EVENT = new CustomEvent(EVENT_NAME, {
    cancelable: true,
});

export function addHandleForcedSearchEvent(callback: (e: Event) => void) {
    document.addEventListener(EVENT_NAME, callback);
}

export function removeHandleForcedSearchEvent(callback: (e: Event) => void) {
    document.removeEventListener(EVENT_NAME, callback);
}

export function forceSearch() {
    document.dispatchEvent(EVENT);
}
