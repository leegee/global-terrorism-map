import { onMount, onCleanup } from "solid-js";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, Point } from "geojson";
import { initDB, queryEvents } from '../db';
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
      style: {
        version: 8,
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
      center: [0, 0],
      zoom: 2,
    });

    map.getCanvas().style.cursor = "default";

    map.on("load", () => {
      map.addSource("events", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
        cluster: true,           // enable clustering
        clusterMaxZoom: 14,      // max zoom to cluster points on
        clusterRadius: 50,       // cluster radius in pixels
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
            "#51bbd6",    // <= 100 points
            100,
            "#f1f075",    // <= 750 points
            750,
            "#f28cb1",    // > 750 points
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
          "circle-stroke-color": "#fff",
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
          "text-color": "#000",
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
