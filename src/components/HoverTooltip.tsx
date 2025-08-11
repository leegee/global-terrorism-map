import { onCleanup, onMount } from "solid-js";
import maplibregl from "maplibre-gl";

interface HoverTooltipProps {
    map: maplibregl.Map;
}

export default function HoverTooltip(props: HoverTooltipProps) {
    let popup: maplibregl.Popup | null = null;

    function showTip(e: CustomEvent) {
        if (!props.map) return;

        const { lngLat, html } = e.detail;

        if (!popup) {
            popup = new maplibregl.Popup({
                closeButton: false,
                closeOnClick: false,
                offset: 10,
            });
        }

        popup.setLngLat(lngLat).setHTML(html).addTo(props.map);
    }

    function removeTip() {
        if (popup) {
            popup.remove();
            popup = null;
        }
    }

    onMount(() => {
        document.addEventListener("tooltip-show", showTip);
        document.addEventListener("tooltip-hide", removeTip);
    });

    onCleanup(() => {
        document.removeEventListener("tooltip-show", showTip);
        document.removeEventListener("tooltip-hide", removeTip);
        removeTip();
    });

    return null;
}
