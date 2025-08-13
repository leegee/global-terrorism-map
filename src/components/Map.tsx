import { onMount, onCleanup } from "solid-js";
import maplibregl, { CustomLayerInterface } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { queryEventsLatLng } from "../lib/db";
import type { Database } from "sql.js";

export default function MapComponent(props: { db: Database }) {
    let mapContainer: HTMLDivElement | undefined;
    let map: maplibregl.Map | undefined;

    const customLayer: CustomLayerInterface = {
        id: "events_layer",
        type: "custom",
        renderingMode: "2d",

        onAdd(mapInstance, gl) {
            const self = this as any;
            self.map = mapInstance;
            self.gl = gl;

            // Vertex shader
            const vertexSource = `
        attribute vec2 a_pos;
        uniform float u_pointSize;
        void main() {
          gl_PointSize = u_pointSize;
          gl_Position = vec4(a_pos, 0.0, 1.0);
        }
      `;

            // Fragment shader: circular points
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

            const gl: WebGLRenderingContext = self.gl;
            gl.useProgram(self.program);

            const canvas = gl.canvas as HTMLCanvasElement;

            const bounds = map.getBounds();
            const events = queryEventsLatLng(
                props.db,
                bounds.getSouth(),
                bounds.getNorth(),
                bounds.getWest(),
                bounds.getEast(),
                ""
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

            gl.uniform1f(self.uPointSize, 12);
            gl.uniform4f(self.uColor, 1, 0, 0, 1);

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

    function fetchAndShowPopup(eventid: string, x: number, y: number) {
        const popup = document.getElementById("popup")!;
        popup.style.left = x + "px";
        popup.style.top = y + "px";
        popup.textContent = `Event ID: ${eventid}`;
        popup.style.display = "block";
    }

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
            map.addLayer(customLayer);
            console.info("Custom layer added");

            mapContainer.addEventListener("mousemove", (e) => {
                const self = customLayer as any;
                if (!self.pixelCoords) return;

                const rect = mapContainer.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const radius = 6;
                for (const p of self.pixelCoords) {
                    const dx = mouseX - p.x;
                    const dy = mouseY - p.y;
                    if (dx * dx + dy * dy <= radius * radius) {
                        fetchAndShowPopup(p.id, e.clientX, e.clientY);
                        return;
                    }
                }

                // hide popup if not hovering
                const popup = document.getElementById("popup")!;
                popup.style.display = "none";
            });
        });
    });

    onCleanup(() => {
        if (map) map.remove();
    });

    return (
        <>
            <div style={{ width: "100vw", height: "100vh" }} ref={mapContainer} />
            <div
                id="popup"
                style={{
                    position: "absolute",
                    display: "none",
                    background: "white",
                    padding: "4px 8px",
                    color: 'black',
                    border: "1px solid black",
                    "pointer-events": "none",
                }}
            />
        </>
    );
}
