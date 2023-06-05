const hash = window.location.hash.substring(1).split(',');
const opt_ignore_iata = hash.includes('ignore_iata');
const opt_ignore_schedule = hash.includes('ignore_schedule');


let defaultMapState = JSON.parse(localStorage.getItem('lastMapState') ?? '[{"lat":35.6580992222,"lng":139.7413574722},14]');
let lastZoom = -1, lastPos = {};
const map = L.map('map').setView(defaultMapState[0], defaultMapState[1]);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
}).addTo(map);

L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}{r}.{ext}', {
    attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abcd',
    minZoom: 0,
    maxZoom: 20,
    ext: 'png'
}).addTo(map);

const lc = L.control.locate().addTo(map);
lc.start();

const voronoi = d3.geom.voronoi();


let stations = [];

window.onload = () => {
    d3.csv('./a20230601.csv', function (s) {
        stations = s;
        setTimeout(() => {
            updateMarkers();
        }, 0);
    });
};

let mapMarkers = [];
let mapVoronoiPolygons = [];

function updateMarkers() {
    const mapCurrentCenter = map.getCenter();
    const mapCurrentZoom = map.getZoom();

    if (
        mapCurrentZoom == lastZoom &&
        Math.abs(mapCurrentCenter.lat - lastPos.lat) < 0.2 &&
        Math.abs(mapCurrentCenter.lng - lastPos.lng) < 0.2
    ) {
        return;
    }

    const mapBounds = map.getBounds();

    const renderStations = stations.filter((s) => {
        return (
            (opt_ignore_schedule || s.scheduled_service === 'yes') &&
            (opt_ignore_iata || s.iata_code !== '') &&
            s.latitude_deg > mapBounds.getSouthWest().lat - 10 &&
            s.latitude_deg < mapBounds.getNorthEast().lat + 10 &&
            s.longitude_deg > mapBounds.getSouthWest().lng - 10 &&
            s.longitude_deg < mapBounds.getNorthEast().lng + 10
        );
    });

    const displayStations = renderStations.filter((s) => {
        return (
            s.latitude_deg > mapBounds.getSouthWest().lat &&
            s.latitude_deg < mapBounds.getNorthEast().lat &&
            s.longitude_deg > mapBounds.getSouthWest().lng &&
            s.longitude_deg < mapBounds.getNorthEast().lng
        );
    });

    mapMarkers.forEach((m) => {
        map.removeLayer(m.marker);
    });
    mapMarkers = [];

    mapVoronoiPolygons.forEach((p) => {
        map.removeLayer(p);
    });
    mapVoronoiPolygons = [];

    lastPos = mapCurrentCenter;
    lastZoom = mapCurrentZoom;

    localStorage.setItem('lastMapState', JSON.stringify([lastPos, lastZoom]));

    if (displayStations.length < 150) {
        voronoiObjects = voronoi(renderStations.map(function (v) {
            return [v.latitude_deg, v.longitude_deg];
        }));

        renderStations.forEach((s, i) => {
            const popupText = `${s.name}<br />IATA: ${s.iata_code}`;

            //const marker = L.marker([s.lat, s.lon]).addTo(map).bindPopup(s.station_name);
            if (!mapMarkers.some((v) => v.id === s.id)) {
                const marker = L.circleMarker([s.latitude_deg, s.longitude_deg], { radius: 7, fillOpacity: 1, attribution: '<a href="https://ourairports.com/">OurAirports</a>' }).addTo(map);
                marker.bindPopup(popupText);
                mapMarkers.push({ id: s.id, marker: marker });
            }

            if (i in voronoiObjects) {
                const voronoiPaths = voronoiObjects[i].map((v) => {
                    if (Object.keys(v !== 'point'))
                        return [v[0], v[1]];
                });
                const voronoiPolygon = L.polygon(voronoiPaths, { color: 'red', fillOpacity: 0 }).addTo(map);
                voronoiPolygon.bindPopup(popupText);
                mapVoronoiPolygons.push(voronoiPolygon);
            }
        });
    }
}

map.on('moveend', updateMarkers);
map.on('zoomend', updateMarkers);