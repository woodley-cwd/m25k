// Leaflet GPS map — hides itself if geolocation is unavailable

const MapTracker = (() => {
  let map = null;
  let routeLine = null;
  let marker = null;
  let watchId = null;
  let coords = [];
  let available = false;
  let totalDistance = 0; // metres

  function init() {
    if (!navigator.geolocation) {
      hide();
      return;
    }
    // Test permission / availability with a one-shot check
    navigator.geolocation.getCurrentPosition(
      () => { available = true; },
      () => { hide(); },
      { timeout: 5000 }
    );
  }

  function hide() {
    const el = document.getElementById('map-container');
    if (el) el.style.display = 'none';
  }

  function show() {
    const el = document.getElementById('map-container');
    if (el) el.style.display = 'block';
  }

  function start() {
    if (!navigator.geolocation) return;
    coords = [];
    totalDistance = 0;

    if (!map) {
      map = L.map('map', { zoomControl: false, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);
      routeLine = L.polyline([], { color: '#00C853', weight: 4 }).addTo(map);
      marker = L.circleMarker([0, 0], {
        radius: 8,
        fillColor: '#00C853',
        color: '#fff',
        weight: 2,
        fillOpacity: 1,
      }).addTo(map);
    } else {
      routeLine.setLatLngs([]);
    }

    show();

    watchId = navigator.geolocation.watchPosition(
      onPosition,
      () => hide(),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }

  function onPosition(pos) {
    const { latitude: lat, longitude: lng } = pos.coords;
    const point = [lat, lng];

    if (coords.length > 0) {
      const prev = coords[coords.length - 1];
      totalDistance += haversine(prev[0], prev[1], lat, lng);
    }

    coords.push(point);
    routeLine.addLatLng(point);
    marker.setLatLng(point);
    map.setView(point, 16);
  }

  function stop() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  function reset() {
    stop();
    coords = [];
    totalDistance = 0;
    if (routeLine) routeLine.setLatLngs([]);
  }

  function getDistanceKm() {
    return totalDistance / 1000;
  }

  // Haversine formula — distance in metres between two lat/lng points
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  return { init, start, stop, reset, hide, getDistanceKm };
})();
