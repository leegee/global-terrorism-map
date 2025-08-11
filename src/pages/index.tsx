import { onMount, onCleanup, createSignal } from "solid-js";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, Point } from "geojson";
import { initDB, queryEvents } from '../db';
import HoverTooltip from "../components/HoverTooltip";

export default function Home() {
  let mapContainer: HTMLDivElement | undefined;
  let map: maplibregl.Map | undefined;
  let db: any;
  const [mapReady, setMapReady] = createSignal(false);

  async function updateEvents() {
    if (!map || !db) return;

    const bounds = map.getBounds();
    const minLat = bounds.getSouth();
    const maxLat = bounds.getNorth();
    const minLon = bounds.getWest();
    const maxLon = bounds.getEast();

    const rows = await queryEvents(db, minLat, maxLat, minLon, maxLon);

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

    map.on("load", () => {
      map.addSource("events", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.getCanvas().style.cursor = "default";

      map.addLayer({
        id: "events-layer",
        type: "circle",
        source: "events",
        paint: {
          "circle-radius": 4,
          "circle-color": "#f84c4c",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff",
        },
      });

      updateEvents();
      map.on("moveend", updateEvents);
      setMapReady(true);
    });
  });

  onCleanup(() => {
    if (map) map.remove();
  });

  return <>
    <div style={{ width: "100vw", height: "100vh" }} ref={mapContainer}></div>
    {mapReady() && map && <HoverTooltip map={map} layerId="events-layer" />}
  </>
}
