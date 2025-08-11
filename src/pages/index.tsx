import { onMount, onCleanup, createSignal } from "solid-js";
import type { Feature, Point } from "geojson";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "beercss";
import "material-dynamic-colors";

import styles from "./index.module.scss";
import { initDB, queryEvents } from "../lib/db";
import { baseStyle } from "../lib/map-style";
import HoverTooltip from "../components/HoverTooltip";
import { DateRangeControl } from "../components/DateRangeControl";

export default function Home() {
  const [dateRange, setDateRange] = createSignal<[string, string]>([
    "2023",
    "2025",
  ]);

  let mapContainer: HTMLDivElement | undefined;
  let map: maplibregl.Map | undefined;
  let db: any;

  async function updateEventLayer(range?: [string, string]) {
    if (!map || !db) return;

    const activeRange = range ?? dateRange();
    const [startYear, endYear] = activeRange;

    const bounds = map.getBounds();
    const minLat = bounds.getSouth();
    const maxLat = bounds.getNorth();
    const minLon = bounds.getWest();
    const maxLon = bounds.getEast();

    const rows = queryEvents(
      db,
      minLat,
      maxLat,
      minLon,
      maxLon,
      startYear,
      endYear
    );

    const features: Feature<Point>[] = rows.map(
      ({ eventid, iyear, country_txt, latitude, longitude, summary }) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        properties: {
          eventid,
          iyear,
          country_txt,
          summary,
        },
      })
    );

    const source = map.getSource("events") as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: "FeatureCollection",
        features,
      });
    }
  }

  onMount(async () => {
    if (!mapContainer) return;

    db = await initDB("/globalterrorismdb.sqlite");

    map = new maplibregl.Map({
      container: mapContainer,
      style: baseStyle as any,
      center: [0, 0],
      zoom: 2,
      attributionControl: false,
    });

    map.getCanvas().style.cursor = "default";

    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          "Data © U. Maryland Global Terrorism Database",
      }),
      "bottom-right"
    );

    map.on("load", () => {
      map.addSource("events", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 30,
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
        paint: {
          "text-color": "#ddd",
        },
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

      updateEventLayer(dateRange());

      map.on("moveend", () => updateEventLayer());
    });
  });

  onCleanup(() => {
    if (map) map.remove();
  });

  createSignal(() => {
    if (!map) return;
    updateEventLayer(dateRange());
  });

  return (
    <>
      <section class={styles.component}>
        <aside class={styles.controls}>
          <DateRangeControl
            initialRange={dateRange()}
            onChange={setDateRange}
          />
        </aside>

        <div class={styles.map} ref={mapContainer}></div>

        {map && (
          <HoverTooltip map={map} layerId="unclustered-point" />
        )}
      </section>
    </>
  );
}
