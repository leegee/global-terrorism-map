import { onMount, onCleanup } from "solid-js";
import maplibregl, { CustomLayerInterface } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function MapComponent() {
    let mapContainer: HTMLDivElement | undefined;
    let map: maplibregl.Map | undefined;

    const customLayer: CustomLayerInterface = {
        id: "custom_gl_layer",
        type: "custom",
        renderingMode: "2d",
        onAdd(mapInstance, gl) {
            this.map = mapInstance;
            this.gl = gl;

            // Vertex shader
            const vertexSource = `
        attribute vec2 a_pos;
        void main() {
          gl_PointSize = 40.0;
          gl_Position = vec4(a_pos, 0.0, 1.0);
        }
      `;

            // Fragment shader
            const fragmentSource = `
        void main() {
          gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // red
        }
      `;

            const compileShader = (type: number, source: string) => {
                const shader = gl.createShader(type)!;
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                    throw new Error(gl.getShaderInfoLog(shader) || "Shader compile failed");
                }
                return shader;
            };

            const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
            const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);

            const program = gl.createProgram()!;
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error(gl.getProgramInfoLog(program) || "Program link failed");
            }

            this.program = program;
            this.aPos = gl.getAttribLocation(program, "a_pos");

            // Project London to clip space
            const canvas = mapInstance.getCanvas();
            const projected = mapInstance.project([-0.1276, 51.5074]); // London
            const xClip = (projected.x / canvas.width) * 2 - 1;
            const yClip = -((projected.y / canvas.height) * 2 - 1);

            const coords = new Float32Array([xClip, yClip]);

            this.buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, coords, gl.STATIC_DRAW);
        },

        render() {
            if (!this.program || !this.buffer || this.aPos < 0) return;

            const gl = this.gl!;
            gl.useProgram(this.program);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
            gl.enableVertexAttribArray(this.aPos);
            gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.POINTS, 0, 1);

            gl.disableVertexAttribArray(this.aPos);

            this.map!.triggerRepaint();
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
            style: "https://demotiles.maplibre.org/style.json",
            center: [-0.1276, 51.5074],
            zoom: 5,
        });

        map.on("load", () => {
            map.addLayer(customLayer);
            console.log("Custom GL layer added");
        });
    });

    onCleanup(() => {
        if (map) map.remove();
    });

    return <div style={{ width: "100vw", height: "100vh" }} ref={mapContainer} />;
}
