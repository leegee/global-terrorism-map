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

export default function MapComponent(props: MapProps) {
    let mapContainer: HTMLDivElement | undefined;
    let map: maplibregl.Map | undefined;
    const [mapReady, setMapReady] = createSignal(false);

    const customLayer: CustomLayerInterface = {
        id: "events_layer",
        type: "custom",
        renderingMode: "2d",

        onAdd(mapInstance, gl) {
            const self = this as any;
            self.map = mapInstance;
            self.gl = gl;

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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

            gl.uniform1f(self.uPointSize, POINT_DIAMETER_PX);
            gl.uniform4f(self.uColor, 1, 0, 0, 0.25);

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
            // center: [0, 0],
            // zoom: 2,
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

                const radius = POINT_DIAMETER_PX / 2;
                let found = false;

                for (const p of self.pixelCoords) {
                    const dx = mouseX - p.x;
                    const dy = mouseY - p.y;
                    if (dx * dx + dy * dy <= radius * radius) {
                        document.dispatchEvent(new CustomEvent("tooltip-show", {
                            detail: {
                                lngLat: map.unproject([p.x, p.y]),
                                eventId: p.id
                            }
                        }));
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    document.dispatchEvent(new CustomEvent("tooltip-hide"));
                }
            });

            map.on("mouseleave", () => {
                document.dispatchEvent(new CustomEvent("tooltip-hide"));
            });

            addHandleForcedSearchEvent(() => map.triggerRepaint());
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
