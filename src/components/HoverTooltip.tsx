import { onCleanup, onMount } from "solid-js";
import maplibregl from "maplibre-gl";
import styles from "./HoverTooltip.module.scss";

interface HoverTooltipProps {
    map: maplibregl.Map;
}

const fields = {
    "Event ID": "eventid",
    "Year": "iyear",
    "Country": "country_txt",
    "Latitude": "latitude",
    "Longitude": "longitude",
    "Attack Type": "attacktype1_txt",
    "Target Type": "targtype1_txt",
    "Weapon Type": "weaptype1_txt",
    "Killed": "nkill",
    "Wounded": "nwound",
    "Group Name": "gname",
    "Motive": "motive",
    "Claimed": "claimed",
    "Success": "success",
    "Summary": "summary"
};


export default function HoverTooltip(props: HoverTooltipProps) {
    let popup: maplibregl.Popup | null = null;

    function showTip(e: CustomEvent) {
        if (!props.map) return;

        const { lngLat, properties } = e.detail;

        if (!popup) {
            popup = new maplibregl.Popup({
                closeButton: false,
                closeOnClick: false,
                offset: 10,
            });
        }

        const html = `
        <section>
        <table>
          <tbody>
            ${Object.entries(fields).map(([label, key]) => {
            if (['latitude', 'longitude'].includes(key)) return;

            let value = properties[key];

            if (value === null || value === undefined || value === '') return '';

            if (key === "claimed" || key === "success") {
                value = (value === 1 || value === true) ? "Yes" : "No";
            }

            if (value === null || value === undefined || value === "") {
                value = (key === "summary") ? "" : "N/A";
            }

            return `
                <tr>
                  <th>${label}</th>
                  <td>${value}</td>
                </tr>
              `;
        }).join("")}
          </tbody>
        </table>
        </section>
      `;

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
