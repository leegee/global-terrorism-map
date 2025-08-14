import type { CustomLayerInterface, Map } from "maplibre-gl";
import { POINT_DIAMETER_PX } from "../../lib/db";
import type { MapState } from "../../store"; // adjust to your real type

export function createPointsLayer(
    map: Map,
    mapState: MapState,
    heatmapZoomLevel: number,
    pointAlpha: number,
    onPointSizeChange?: (size: number) => void
): CustomLayerInterface {
    let pointSize = 1;

    const layer: CustomLayerInterface = {
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
            self.pixelCoords = [];
        },

        render() {
            const self = this as any;
            if (!self.program || !self.buffer || self.aPos < 0) return;

            const zoom = map.getZoom();
            pointSize = Math.max(
                POINT_DIAMETER_PX / 4,
                Math.min(POINT_DIAMETER_PX, POINT_DIAMETER_PX * (zoom / heatmapZoomLevel))
            );
            if (onPointSizeChange) onPointSizeChange(pointSize);

            const gl: WebGLRenderingContext = self.gl;
            gl.useProgram(self.program);

            const canvas = gl.canvas as HTMLCanvasElement;

            const events = mapState.results;
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
            gl.uniform4f(self.uColor, 1 * pointAlpha, 0, 0, pointAlpha);

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

    return layer;
}
