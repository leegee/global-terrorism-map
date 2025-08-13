import { onCleanup, onMount } from "solid-js";
import { render } from "solid-js/web";
import maplibregl from "maplibre-gl";
import schema from "../scheme.json";
import { getEventById } from "../lib/db";

interface HoverTooltipProps {
    map: maplibregl.Map;
}

type FieldInfo = {
    type: string;
    display: string;
};

const columnTypes: Record<string, string> = {};
const fields: Record<string, string> = {};

for (const key in schema) {
    const info: FieldInfo = schema[key];
    columnTypes[key] = info.type;
    fields[info.display] = key;
}

// A small Solid component to render the popup table
function PopupContent(props: { properties: Record<string, any> }) {
    return (
        <section>
            <table>
                <tbody>
                    {Object.entries(fields).map(([label, key]) => {
                        if (["latitude", "longitude"].includes(key)) return null;

                        let value = props.properties[key];
                        if (value === null || value === undefined || value === "") {
                            value = key === "summary" ? "" : "N/A";
                        }

                        if (key === "claimed" || key === "success") {
                            value = value === 1 || value === true ? "Yes" : "No";
                        }

                        return (
                            <tr>
                                <th>{label}</th>
                                <td>{value}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </section>
    );
}

export default function HoverTooltip(props: HoverTooltipProps) {
    let popup: maplibregl.Popup | null = null;

    function showTip(e: CustomEvent) {
        if (!props.map) return;

        const { lngLat, eventId } = e.detail;
        const properties = getEventById(eventId);
        if (!properties) return;

        if (!popup) {
            popup = new maplibregl.Popup({
                closeButton: false,
                closeOnClick: false,
                offset: 10,
            });
        }

        // Use Solid to render JSX into a container div
        const container = document.createElement("div");
        render(() => <PopupContent properties={properties} />, container);

        popup.setLngLat(lngLat).setDOMContent(container).addTo(props.map);
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
