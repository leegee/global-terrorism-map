import { onMount, onCleanup } from "solid-js";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, Point } from "geojson";

import { initDB, queryEvents } from '../lib/db';
import { baseStyle } from '../lib/map-style';
import HoverTooltip from "../components/HoverTooltip";

export default function Home() {
  let mapContainer: HTMLDivElement | undefined;
  let map: maplibregl.Map | undefined;
  let db: any;

  async function updateEvents() {
    if (!map || !db) return;

    const bounds = map.getBounds();
    const minLat = bounds.getSouth();
    const maxLat = bounds.getNorth();
    const minLon = bounds.getWest();
    const maxLon = bounds.getEast();

    // Load ALL events inside bounds - remove LIMIT to allow clustering on all
    const rows = queryEvents(db, minLat, maxLat, minLon, maxLon);

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
      style: baseStyle as any, // ikr
      center: [0, 0],
      zoom: 2,
      attributionControl: false,
    });

    map.getCanvas().style.cursor = "default";

    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: 'Data © U. Maryland Global Terrorism Database',
      }),
      'bottom-right'
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

      // Cluster circles layer
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

      // Cluster count labels
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

      // Unclustered points
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

      updateEvents();
      map.on("moveend", updateEvents);
    });
  });

  onCleanup(() => {
    if (map) map.remove();
  });

  return <>
    <div style={{ width: "100vw", height: "100vh" }} ref={mapContainer}></div>;
    {map && <HoverTooltip map={map} layerId="unclustered-point" />}
  </>;
}
