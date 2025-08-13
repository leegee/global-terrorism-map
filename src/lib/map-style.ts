export const baseLayerStyle = {
    version: 8 as const,
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
};
