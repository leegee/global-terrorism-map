import { onMount, onCleanup, createSignal } from "solid-js";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { createPointsLayer } from "./points-layer";
import { getPixelRadius } from "../../lib/db";
import { HEATMAP_ZOOM_LEVEL } from "../../config";
import { mapState } from "../../store";
import MapDataFetcher from "./MapDataFetcher";
import styles from "./Map.module.scss";
import Tooltip from "./Tooltip";

const POINT_ALPHA = 0.75;

export default function MapComponent() {
    let mapContainer!: HTMLDivElement;
    let map!: maplibregl.Map;
    const [mapReady, setMapReady] = createSignal(false);
    let pointSize = 1;

    function maybeTooltip(e: MouseEvent) {
        const zoom = map.getZoom();
        if (zoom < HEATMAP_ZOOM_LEVEL) {
            document.dispatchEvent(new CustomEvent("tooltip-hide"));
            return;
        }
        const self = (map.getLayer("events_layer") as any);
        if (!self.pixelCoords) return;

        const rect = mapContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const radius = pointSize / 2;

        let found = false;
        for (const p of self.pixelCoords) {
            const dx = mouseX - p.x;
            const dy = mouseY - p.y;
            if (dx * dx + dy * dy <= radius * radius) {
                document.dispatchEvent(new CustomEvent("tooltip-show", {
                    detail: { lngLat: map.unproject([p.x, p.y]), eventId: p.id }
                }));
                found = true;
                break;
            }
        }
        if (!found) document.dispatchEvent(new CustomEvent("tooltip-hide"));
    }

    onMount(() => {
        map = new maplibregl.Map({
            container: mapContainer,
            style: {
                version: 8 as const,
                glyphs: "fonts/{fontstack}/{range}.pbf",
                sources: {
                    cartoDark: {
                        type: "raster",
                        tiles: [
                            "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                            "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                            "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                            "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                            "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                        ],
                        tileSize: 256,
                        attribution:
                            '© <a href="https://carto.com/attributions">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                    },
                },
                layers: [
                    {
                        id: "cartoDarkLayer",
                        type: "raster",
                        source: "cartoDark",
                        minzoom: 0,
                        maxzoom: 19,
                    },
                ],
            },
            maxZoom: 13,
            attributionControl: false,
            renderWorldCopies: false,
            center: [-0.1276, 51.5074],
            zoom: HEATMAP_ZOOM_LEVEL + 1,
        });

        map.on("load", () => {
            map.addSource("events_heatmap", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });

            map.addLayer({
                id: "events_heatmap",
                type: "heatmap",
                source: "events_heatmap",
                maxzoom: HEATMAP_ZOOM_LEVEL,
                paint: {
                    "heatmap-weight": ["interpolate", ["linear"], ["get", "count"], 0, 0, 1, 1],
                    "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 3],
                    "heatmap-color": [
                        "interpolate", ["linear"], ["heatmap-density"],
                        0, "rgba(0,0,255, 0)", 0.1, "royalblue", 0.3, "cyan",
                        0.5, "lime", 0.7, "yellow", 1, "red"
                    ],
                    "heatmap-opacity": 0.4,
                    "heatmap-radius": ["interpolate", ["linear"], ["zoom"],
                        0, getPixelRadius(0) * 0.7,
                        HEATMAP_ZOOM_LEVEL, getPixelRadius(6) * 1.1
                    ]
                }
            });

            map.addLayer(
                createPointsLayer(map, mapState, HEATMAP_ZOOM_LEVEL, POINT_ALPHA, size => {
                    pointSize = size;
                })
            );

            mapContainer.addEventListener("click", (e) => maybeTooltip(e));
            setMapReady(true);
        });
    });

    onCleanup(() => map && map.remove());

    return (
        <>
            <div class={styles.component} ref={mapContainer} />
            {mapReady() && <Tooltip map={map} />}
            {mapReady() && <MapDataFetcher map={map} db={mapState.db} />}
        </>
    );
}
