import { onCleanup } from "solid-js";
import maplibregl from "maplibre-gl";

interface HoverTooltipProps {
    map: maplibregl.Map;
    layerId: string;
}

export default function HoverTooltip(props: HoverTooltipProps) {
    let popup: maplibregl.Popup | null = null;

    function onMouseMove(e: maplibregl.MapMouseEvent) {
        const features = props.map.queryRenderedFeatures(e.point, { layers: [props.layerId] });
        if (!features.length) {
            popup?.remove();
            popup = null;
            return;
        }

        const feature = features[0];
        const properties = feature.properties as Record<string, any>;

        if (!popup) {
            popup = new maplibregl.Popup({
                closeButton: false,
                closeOnClick: false,
                offset: 10,
            });
        }

        popup
            .setLngLat(e.lngLat)
            .setHTML(
                `<strong>Event ID:</strong> ${properties.eventid || "N/A"}<br/>
         <strong>Year:</strong> ${properties.iyear || "N/A"}<br/>
         <strong>Country:</strong> ${properties.country_txt || "N/A"}<br/>
         <em>${properties.summary || ""}</em>`
            )
            .addTo(props.map);
    }

    function onMouseLeave() {
        if (popup) {
            popup.remove();
            popup = null;
        }
    }

    props.map.on("mousemove", props.layerId, onMouseMove);
    props.map.on("mouseleave", props.layerId, onMouseLeave);

    onCleanup(() => {
        props.map.off("mousemove", props.layerId, onMouseMove);
        props.map.off("mouseleave", props.layerId, onMouseLeave);
        if (popup) {
            popup.remove();
            popup = null;
        }
    });

    return null;
}
