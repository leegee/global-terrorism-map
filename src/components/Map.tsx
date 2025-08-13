import { onMount, onCleanup } from "solid-js";
import maplibregl, { CustomLayerInterface } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { queryEventsLatLng } from "../lib/db"; // your routine
import type { Database } from "sql.js";

export default function MapComponent(props: { db: Database }) {
    let mapContainer: HTMLDivElement | undefined;
    let map: maplibregl.Map | undefined;

    const customLayer: CustomLayerInterface = {
        id: "events_layer",
        type: "custom",
        renderingMode: "2d",
        onAdd(mapInstance, gl) {
            this.map = mapInstance;
            this.gl = gl;

            // Vertex shader
            const vertexSource = `
        attribute vec2 a_pos;
        void main() {
          gl_PointSize = 10.0;
          gl_Position = vec4(a_pos, 0.0, 1.0);
        }
      `;

            // Fragment shader
            const fragmentSource = `
        void main() {
          gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // red
        }
      `;

            function compileShader(type: number, source: string) {
                const shader = gl.createShader(type)!;
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                    throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compile failed");
                }
                return shader;
            }

            const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
            const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);

            const program = gl.createProgram()!;
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error(gl.getProgramInfoLog(program) ?? "Program link failed");
            }

            this.program = program;
            this.aPos = gl.getAttribLocation(program, "a_pos");

            this.buffer = gl.createBuffer();
        },

        render(gl) {
            if (!this.program || !this.buffer || this.aPos < 0) return;
            gl.useProgram(this.program);

            const canvas = gl.canvas as HTMLCanvasElement;

            // Query events in view
            const bounds = map!.getBounds();
            const events = queryEventsLatLng(
                props.db,
                bounds.getSouth(),
                bounds.getNorth(),
                bounds.getWest(),
                bounds.getEast(),
                "" // query string, optional
            );

            // Convert events to clip space
            const coords: number[] = [];
            events.forEach((ev) => {
                const projected = map!.project([ev.longitude, ev.latitude]);
                const xClip = (projected.x / canvas.width) * 2 - 1;
                const yClip = -((projected.y / canvas.height) * 2 - 1);
                coords.push(xClip, yClip);
            });

            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coords), gl.STATIC_DRAW);
            gl.enableVertexAttribArray(this.aPos);
            gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.POINTS, 0, coords.length / 2);
            gl.disableVertexAttribArray(this.aPos);

            this.map.triggerRepaint();
        },

        onRemove() {
            if (this.buffer) this.gl.deleteBuffer(this.buffer);
            if (this.program) this.gl.deleteProgram(this.program);
        },
    };

    onMount(() => {
        if (!mapContainer) return;

        map = new maplibregl.Map({
            container: mapContainer,
            style: {
                version: 8,
                sources: {
                    osm: {
                        type: "raster",
                        tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
                        tileSize: 256,
                        attribution: "© OpenStreetMap contributors",
                    },
                },
                layers: [
                    { id: "background", type: "background", paint: { "background-color": "#000000" } },
                    { id: "osm", type: "raster", source: "osm" },
                ],
            },
            center: [-0.1276, 51.5074],
            zoom: 6,
        });

        map.on("load", () => {
            map!.addLayer(customLayer);
            console.log("Custom layer added");
        });
    });

    onCleanup(() => {
        if (map) map.remove();
    });

    return <div style={{ width: "100vw", height: "100vh" }} ref={mapContainer} />;
}
