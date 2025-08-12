import { onMount, onCleanup, createSignal, createEffect } from "solid-js";
import type { Feature, Point } from "geojson";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import styles from './Map.module.scss';
import { baseStyle } from "../lib/map-style";
import { queryEvents } from "../lib/db";
import HoverTooltip from "./HoverTooltip";
import { addHandleForcedSearchEvent, removeHandleForcedSearchEvent } from "../lib/forced-search-event";

interface MapProps {
    db: any;
    dateRange: [string, string];
    q: string;
    onReady?: () => void;
}

export default function MapComponent(props: MapProps) {
    let mapContainer: HTMLDivElement | undefined;
    let map: maplibregl.Map | undefined;
    const [mapReady, setMapReady] = createSignal(false);

    async function updateMapWithData() {
        if (!map || !props.db) return;

        const activeRange = props.dateRange;
        const [startYear, endYear] = activeRange;
        const q = props.q;

        const bounds = map.getBounds();
        const minLat = bounds.getSouth();
        const maxLat = bounds.getNorth();
        const minLon = bounds.getWest();
        const maxLon = bounds.getEast();

        const rows = queryEvents(
            props.db,
            minLat,
            maxLat,
            minLon,
            maxLon,
            q,
            startYear,
            endYear
        );

        const features: Feature<Point>[] = rows.map(row => ({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [row.longitude, row.latitude],
            },
            properties: { ...row },
        }));

        const source = map.getSource("events") as maplibregl.GeoJSONSource;
        if (source) {
            source.setData({
                type: "FeatureCollection",
                features,
            });
        }
    }

    onMount(() => {
        if (!mapContainer) return;

        map = new maplibregl.Map({
            container: mapContainer,
            style: baseStyle as any,
            center: [0, 0],
            zoom: 2,
            maxZoom: 13,
            attributionControl: false,
        });

        map.getCanvas().style.cursor = "default";

        map.addControl(
            new maplibregl.AttributionControl({
                compact: true,
                customAttribution: "Data © U. Maryland Global Terrorism Database",
            }),
            "bottom-right"
        );

        map.on("load", () => {
            map.addSource("events", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
                cluster: true,
                clusterMaxZoom: 11,
                clusterRadius: 15,
            });

            map.addLayer({
                id: "clusters",
                type: "circle",
                source: "events",
                filter: ["has", "point_count"],
                paint: {
                    "circle-color": [
                        "step",
                        ["get", "point_count"],
                        "#6a5acd55",
                        10,
                        "#483d8b55",
                        100,
                        "#7b68ee55",
                        1000,
                        "#9370db55",
                    ],
                    "circle-radius": [
                        "step",
                        ["get", "point_count"],
                        20,
                        100,
                        30,
                        750,
                        40,
                    ],
                    "circle-stroke-width": 1,
                    "circle-stroke-color": "#fff5",
                },
            });

            map.addLayer({
                id: "cluster-count",
                type: "symbol",
                source: "events",
                filter: ["has", "point_count"],
                layout: {
                    "text-field": "{point_count_abbreviated}",
                    "text-font": ["Open Sans Regular"],
                    "text-size": 12,
                },
                paint: { "text-color": "#ddd" },
            });

            map.addLayer({
                id: "unclustered-point",
                type: "circle",
                source: "events",
                filter: ["!", ["has", "point_count"]],
                paint: {
                    "circle-radius": 4,
                    "circle-color": "#f84c4c",
                    "circle-stroke-width": 1,
                    "circle-stroke-color": "#fff",
                },
            });

            map.on("mousemove", "unclustered-point", (e) => {
                const features = e.features;
                if (!features?.length) {
                    document.dispatchEvent(new CustomEvent("tooltip-hide"));
                    return;
                }
                document.dispatchEvent(
                    new CustomEvent("tooltip-show", {
                        detail: {
                            lngLat: e.lngLat,
                            properties: features[0].properties || {},
                        },
                    })
                );
            });

            map.on("mouseleave", "unclustered-point", () => {
                document.dispatchEvent(new CustomEvent("tooltip-hide"));
            });

            addHandleForcedSearchEvent(updateMapWithData);

            setMapReady(true);
            props.onReady?.();
        });
    });

    onCleanup(() => {
        if (map) map.remove();
        removeHandleForcedSearchEvent(updateMapWithData);
    });

    createEffect(() => {
        if (map && mapReady()) updateMapWithData();
    });

    return (
        <>
            <div class={styles.component} ref={mapContainer} />
            {mapReady() && <HoverTooltip map={map!} />}
        </>
    );
}
