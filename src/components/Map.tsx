import { onMount, onCleanup, createSignal } from "solid-js";
import maplibregl, { CustomLayerInterface } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { queryEventsLatLng, type Database } from "../lib/db";
import HoverTooltip from "./HoverTooltip";
import { baseStyle } from "../lib/map-style";
import { addHandleForcedSearchEvent } from "../lib/forced-search-event";

interface MapProps {
    db: Database;
    dateRange: [string, string];
    q: string;
    onReady?: () => void;
}

const POINT_DIAMETER_PX = 12;
const POINT_ALPHA = 0.75;
const HEATMAP_ZOOM_LEVEL = 6;

export default function MapComponent(props: MapProps) {
    let mapContainer: HTMLDivElement | undefined;
    let map: maplibregl.Map | undefined;
    const [mapReady, setMapReady] = createSignal(false);
    let pointSize = 1;

    const customLayer: CustomLayerInterface = {
        id: "events_layer",
        type: "custom",
        renderingMode: "2d",

        onAdd(mapInstance, gl) {
            const self = this as any;
            self.map = mapInstance;
            self.gl = gl;

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            const vertexSource = `
        attribute vec2 a_pos;
        uniform float u_pointSize;
        void main() {
          gl_PointSize = u_pointSize;
          gl_Position = vec4(a_pos, 0.0, 1.0);
        }
      `;

            const fragmentSource = `
        precision mediump float;
        uniform vec4 u_color;
        void main() {
          if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
          gl_FragColor = u_color;
        }
      `;

            function compileShader(type: number, src: string) {
                const s = gl.createShader(type)!;
                gl.shaderSource(s, src);
                gl.compileShader(s);
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                    throw new Error(gl.getShaderInfoLog(s) ?? "Shader compile failed");
                }
                return s;
            }

            const vs = compileShader(gl.VERTEX_SHADER, vertexSource);
            const fs = compileShader(gl.FRAGMENT_SHADER, fragmentSource);

            const program = gl.createProgram()!;
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error(gl.getProgramInfoLog(program) ?? "Program link failed");
            }

            self.program = program;
            self.aPos = gl.getAttribLocation(program, "a_pos");
            self.uPointSize = gl.getUniformLocation(program, "u_pointSize");
            self.uColor = gl.getUniformLocation(program, "u_color");

            self.buffer = gl.createBuffer();
            self.pixelCoords = []; // store pixel positions for hit testing
        },

        render() {
            const self = this as any;
            if (!self.program || !self.buffer || self.aPos < 0) return;

            const zoom = map.getZoom();
            if (zoom < 3) {
                // return; Maybe use a heatmap
                pointSize = 2;
            } else if (zoom < 4) {
                pointSize = 5;
            } else if (zoom < 6) {
                pointSize = POINT_DIAMETER_PX / 2;
            } else if (zoom < 8) {
                pointSize = POINT_DIAMETER_PX;
            }

            const gl: WebGLRenderingContext = self.gl;
            gl.useProgram(self.program);

            const canvas = gl.canvas as HTMLCanvasElement;

            const q = props.q;
            const activeRange = props.dateRange;
            const [startYear, endYear] = activeRange;
            const bounds = map.getBounds();

            const events = queryEventsLatLng(
                props.db,
                bounds.getSouth(),
                bounds.getNorth(),
                bounds.getWest(),
                bounds.getEast(),
                q,
                startYear,
                endYear
            );

            // Project points to clip space and store pixel coords
            const coords: number[] = [];
            const pixelCoords: { x: number; y: number; id: string }[] = [];

            events.forEach((ev) => {
                const projected = map.project([ev.longitude, ev.latitude]);
                pixelCoords.push({ x: projected.x, y: projected.y, id: ev.eventid });

                const xClip = (projected.x / canvas.width) * 2 - 1;
                const yClip = -((projected.y / canvas.height) * 2 - 1);
                coords.push(xClip, yClip);
            });

            self.pixelCoords = pixelCoords;

            gl.bindBuffer(gl.ARRAY_BUFFER, self.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coords), gl.STATIC_DRAW);

            gl.enableVertexAttribArray(self.aPos);
            gl.vertexAttribPointer(self.aPos, 2, gl.FLOAT, false, 0, 0);

            gl.uniform1f(self.uPointSize, pointSize);
            // gl.uniform4f(self.uColor, 1, 0, 0, 0.25);
            gl.uniform4f(self.uColor, 1 * POINT_ALPHA, 0 * POINT_ALPHA, 0 * POINT_ALPHA, POINT_ALPHA);

            gl.drawArrays(gl.POINTS, 0, coords.length / 2);
            gl.disableVertexAttribArray(self.aPos);

            map.triggerRepaint();
        },

        onRemove() {
            const self = this as any;
            if (self.buffer) self.gl.deleteBuffer(self.buffer);
            if (self.program) self.gl.deleteProgram(self.program);
        },
    };


    onMount(() => {
        if (!mapContainer) return;

        map = new maplibregl.Map({
            container: mapContainer,
            style: baseStyle as any,
            maxZoom: 13,
            attributionControl: false,
            renderWorldCopies: false,
            center: [-0.1276, 51.5074],
            zoom: 6,
        });

        map.on("load", () => {
            // --- Add heatmap source & layer ---
            map.addSource("events-heat", {
                type: "geojson",
                data: {
                    type: "FeatureCollection",
                    features: [], // initially empty
                },
            });

            map.addLayer({
                id: "events-heat",
                type: "heatmap",
                source: "events-heat",
                maxzoom: HEATMAP_ZOOM_LEVEL,
                paint: {
                    "heatmap-weight": ["interpolate", ["linear"], ["get", "count"], 0, 0, 1, 1],
                    "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 3],
                    "heatmap-color": [
                        "interpolate",
                        ["linear"],
                        ["heatmap-density"],
                        0, "rgba(0,0,255, 0)",
                        0.1, "royalblue",
                        0.3, "cyan",
                        0.5, "lime",
                        0.7, "yellow",
                        1, "red"
                    ],
                    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 6, 20],
                    // "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.8, 6, 0],
                    "heatmap-opacity": 0.4
                },
            });

            map.addLayer(customLayer);

            const updateData = () => {
                const bounds = map!.getBounds();
                const events = queryEventsLatLng(
                    props.db,
                    bounds.getSouth(),
                    bounds.getNorth(),
                    bounds.getWest(),
                    bounds.getEast(),
                    props.q,
                    props.dateRange[0],
                    props.dateRange[1]
                );

                if (map.getZoom() <= HEATMAP_ZOOM_LEVEL) {
                    // Update heatmap data
                    const features = events.map(ev => ({
                        type: "Feature",
                        geometry: { type: "Point", coordinates: [ev.longitude, ev.latitude] },
                        properties: { count: 1 },
                    }) as any);

                    (map!.getSource("events-heat") as maplibregl.GeoJSONSource).setData({
                        type: "FeatureCollection",
                        features,
                    });
                }
                map!.triggerRepaint();
            };

            // Initial load
            updateData();

            map.on("moveend", updateData);
            map.on("zoom", () => {
                const z = map!.getZoom();
                map!.setLayoutProperty("events-heat", "visibility", z <= 6 ? "visible" : "none");
                map!.setLayoutProperty("events_layer", "visibility", z > 6 ? "visible" : "none");
            });

            setMapReady(true);
            props.onReady?.();
        });
    });


    onCleanup(() => {
        if (map) map.remove();
    });

    return (
        <>
            <div style={{ width: "100vw", height: "100vh" }} ref={mapContainer} />
            {mapReady() && <HoverTooltip map={map!} />}
        </>
    );
}
