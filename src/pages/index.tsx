import { onMount } from "solid-js";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function Home() {
  let mapContainer: HTMLDivElement | undefined;

  onMount(() => {
    if (!mapContainer) return;

    // const map = new maplibregl.Map({
    //   container: mapContainer,
    //   style: "https://demotiles.maplibre.org/style.json",
    //   center: [0, 0],
    //   zoom: 2,
    // });

    const map = new maplibregl.Map({
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

    return () => map.remove();
  });

  return (
    <div style={{ width: "100vw", height: "100vh" }} ref={mapContainer}></div>
  );
}
