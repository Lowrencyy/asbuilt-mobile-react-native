import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { Stack, router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

type Pole = {
  id: number;
  pole_code: string;
  pole_name: string | null;
  slot: string | null;
  status: string;
  remarks: string | null;
  completed_at: string | null;
  map_latitude: string | null;
  map_longitude: string | null;
};

type Span = {
  id: number;
  pole_span_code: string | null;
  length_meters: number;
  runs: number;
  expected_cable: number;
  expected_node: number;
  expected_amplifier: number;
  expected_extender: number;
  expected_tsc: number;
  expected_powersupply: number;
  expected_powersupply_housing: number;
  status: string;
  from_pole: {
    id: number;
    pole_code: string;
    pole_name: string | null;
    status: string;
  };
  to_pole: {
    id: number;
    pole_code: string;
    pole_name: string | null;
    status: string;
  };
};

type SearchRow = { type: "search"; key: string };
type PoleRow = { type: "pole"; key: string; pole: Pole };
type ListRow = SearchRow | PoleRow;

function getPillStyle(status: string) {
  const normalized = status?.trim().toLowerCase();

  switch (normalized) {
    case "in progress":
    case "ongoing":
      return { bg: "#DBEAFE", text: "#1D4ED8" };
    case "assigned":
      return { bg: "#E0F2FE", text: "#0369A1" };
    case "completed":
    case "done":
    case "finished":
      return { bg: "#DCFCE7", text: "#166534" };
    case "pending":
      return { bg: "#FEF3C7", text: "#B45309" };
    case "cancelled":
    case "canceled":
      return { bg: "#FEE2E2", text: "#B91C1C" };
    default:
      return { bg: "#F3F4F6", text: "#374151" };
  }
}

function getMarkerColor(status: string) {
  const normalized = status?.trim().toLowerCase();

  switch (normalized) {
    case "completed":
    case "done":
    case "finished":
      return "#22C55E";
    case "pending":
      return "#F59E0B";
    case "cancelled":
    case "canceled":
      return "#EF4444";
    case "in progress":
    case "ongoing":
      return "#2563EB";
    case "assigned":
      return "#0891B2";
    default:
      return "#0A5C3B";
  }
}

function getTileLayerScript() {
  return `
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);
  `;
}

function buildSinglePoleMapHtml(lat: number, lng: number, status: string) {
  const markerColor = getMarkerColor(status);

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
html,body,#map{
  margin:0;
  padding:0;
  width:100%;
  height:100%;
  border-radius:22px;
  overflow:hidden;
  background:#f8fafc;
}
.leaflet-container{
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{
  zoomControl:false,
  dragging:false,
  scrollWheelZoom:false,
  doubleClickZoom:false,
  touchZoom:false,
  boxZoom:false,
  keyboard:false
}).setView([${lat},${lng}],17);

${getTileLayerScript()}

L.circleMarker([${lat},${lng}],{
  radius:7,
  color:'${markerColor}',
  fillColor:'${markerColor}',
  fillOpacity:1,
  weight:2
}).addTo(map);

setTimeout(function(){ map.invalidateSize(); }, 100);
</script>
</body>
</html>`;
}

function buildHeroMapHtml(poles: Pole[]) {
  const valid = poles.filter((p) => p.map_latitude && p.map_longitude);

  if (valid.length === 0) {
    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
html,body,#wrap{
  margin:0;
  padding:0;
  width:100%;
  height:100%;
  background:#e5e7eb;
  display:flex;
  align-items:center;
  justify-content:center;
  font-family:sans-serif;
  color:#6b7280;
}
</style>
</head>
<body>
<div id="wrap">No map data available</div>
</body>
</html>`;
  }

  const centerLat =
    valid.reduce((s, p) => s + parseFloat(p.map_latitude!), 0) / valid.length;
  const centerLng =
    valid.reduce((s, p) => s + parseFloat(p.map_longitude!), 0) / valid.length;

  const markerJs = valid
    .map((p) => {
      const lat = parseFloat(p.map_latitude!);
      const lng = parseFloat(p.map_longitude!);
      const color = getMarkerColor(p.status);
      return `L.circleMarker([${lat},${lng}],{radius:6,color:'${color}',fillColor:'${color}',fillOpacity:1,weight:2}).addTo(map);`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
html,body,#map{margin:0;padding:0;width:100%;height:100%;}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{
  zoomControl:false,
  dragging:false,
  scrollWheelZoom:false,
  doubleClickZoom:false,
  touchZoom:false
}).setView([${centerLat},${centerLng}],16);

${getTileLayerScript()}
${markerJs}

setTimeout(function(){ map.invalidateSize(); }, 100);
</script>
</body>
</html>`;
}

function buildVicinityMapHtml(poles: Pole[], spans: Span[]) {
  const valid = poles.filter((p) => p.map_latitude && p.map_longitude);

  if (valid.length === 0) {
    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
html,body{
  margin:0;
  padding:0;
  width:100%;
  height:100%;
  background:#f0f4f8;
  display:flex;
  align-items:center;
  justify-content:center;
  font-family:sans-serif;
  color:#6b7280;
  font-size:14px;
  font-weight:600;
}
</style>
</head>
<body>
<div>No GPS data available</div>
</body>
</html>`;
  }

  const gpsMap: Record<string, { lat: number; lng: number }> = {};
  valid.forEach((p) => {
    gpsMap[p.pole_code] = {
      lat: parseFloat(p.map_latitude!),
      lng: parseFloat(p.map_longitude!),
    };
  });

  function normSt(s: string) {
    const v = (s || "").trim().toLowerCase();
    if (["completed", "done", "finished"].includes(v)) return "completed";
    if (["canceled", "cancelled", "cancel"].includes(v)) return "canceled";
    if (["in progress", "ongoing", "assigned"].includes(v)) return "pending";
    return "pending";
  }

  const COLOR: Record<
    string,
    { fill: string; border: string; badge: string; text: string }
  > = {
    completed: {
      fill: "#10b981",
      border: "#059669",
      badge: "background:#d1fae5;color:#065f46",
      text: "#ffffff",
    },
    pending: {
      fill: "#f59e0b",
      border: "#d97706",
      badge: "background:#fef3c7;color:#92400e",
      text: "#ffffff",
    },
    canceled: {
      fill: "#ef4444",
      border: "#dc2626",
      badge: "background:#fee2e2;color:#991b1b",
      text: "#ffffff",
    },
  };

  function safe(s: string) {
    return String(s || "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/"/g, "&quot;");
  }

  const poleSpanMap: Record<string, { total: number; completed: number }> = {};
  spans.forEach((sp) => {
    const spDone = ["completed", "done", "finished"].includes(
      (sp.status || "").trim().toLowerCase(),
    );

    [sp.from_pole?.pole_code, sp.to_pole?.pole_code].forEach((code) => {
      if (!code) return;
      if (!poleSpanMap[code]) {
        poleSpanMap[code] = { total: 0, completed: 0 };
      }
      poleSpanMap[code].total += 1;
      if (spDone) poleSpanMap[code].completed += 1;
    });
  });

  const spanJs = spans
    .map((sp) => {
      const fg = gpsMap[sp.from_pole?.pole_code];
      const tg = gpsMap[sp.to_pole?.pole_code];
      if (!fg || !tg) return "";

      const st = normSt(sp.status);
      const isDone = st === "completed";
      const isCanceled = st === "canceled";
      const c = isDone
        ? COLOR.completed
        : isCanceled
          ? COLOR.canceled
          : COLOR.pending;

      const dash = isCanceled ? "dashArray:'7,5'," : "";
      const op = isCanceled ? 0.48 : 0.95;

      const code = safe(sp.pole_span_code || `Span ${sp.id}`);
      const from = safe(
        sp.from_pole?.pole_name || sp.from_pole?.pole_code || "—",
      );
      const to = safe(sp.to_pole?.pole_name || sp.to_pole?.pole_code || "—");
      const stLabel = isDone
        ? "Completed"
        : isCanceled
          ? "Canceled"
          : "Pending";

      const lenM = Number(sp.length_meters ?? 0);

      const colNode = isDone ? Number(sp.expected_node ?? 0) : 0;
      const colAmp = isDone ? Number(sp.expected_amplifier ?? 0) : 0;
      const colExt = isDone ? Number(sp.expected_extender ?? 0) : 0;
      const colTsc = isDone ? Number(sp.expected_tsc ?? 0) : 0;
      const colPs = isDone ? Number(sp.expected_powersupply ?? 0) : 0;
      const colPsh = isDone ? Number(sp.expected_powersupply_housing ?? 0) : 0;

      const ml = (fg.lat + tg.lat) / 2;
      const mg = (fg.lng + tg.lng) / 2;

      function compRow(label: string, value: number) {
        return (
          `'<div class="tt-row">` +
          `<span class="tt-label">${label}</span>` +
          `<span class="tt-val" style="color:#ffffff">${value ?? 0}</span>` +
          `</div>'+`
        );
      }

      const compRows =
        compRow("Node", colNode) +
        compRow("Amplifier", colAmp) +
        compRow("Extender", colExt) +
        compRow("TSC", colTsc) +
        compRow("Power Supply", colPs) +
        compRow("PS Housing", colPsh);

      return `(function(){
var coords=[[${fg.lat},${fg.lng}],[${tg.lat},${tg.lng}]];

L.polyline(coords,{
  color:'${c.fill}',
  weight:5,
  opacity:${op},
  ${dash}
  interactive:false
}).addTo(spanLayer);

var hitLine=L.polyline(coords,{
  color:'transparent',
  weight:24,
  opacity:0.01
}).addTo(spanLayer);

var tt =
  '<div class="tt">'+
    '<div class="tt-title">📡 ${code}</div>'+
    '<div class="tt-row"><span class="tt-label">Route</span><span class="tt-val">${from} → ${to}</span></div>'+
    '<div class="tt-row"><span class="tt-label">Status</span><span class="tt-val"><span class="badge" style="${c.badge}">${stLabel}</span></span></div>'+
    '<div style="border-top:1px solid rgba(255,255,255,0.08);margin:7px 0 4px"></div>'+
    '<div class="sec">Cable</div>'+
    '<div class="tt-row"><span class="tt-label">Span Length</span><span class="tt-val">${lenM.toFixed(2)} m</span></div>'+
    '<div style="border-top:1px solid rgba(255,255,255,0.08);margin:7px 0 4px"></div>'+
    '<div class="sec">Collected Components</div>'+
    ${compRows}
  '</div>';

hitLine.on('mouseover', function () {
  hitLine.bindTooltip(tt,{
    sticky:true,
    direction:'top',
    opacity:1,
    className:'',
    offset:[0,-4]
  }).openTooltip();
});

hitLine.on('mouseout', function () {
  hitLine.closeTooltip();
});

hitLine.on('click', function () {
  hitLine.closeTooltip();
});

hitLine.on('mousedown', function () {
  hitLine.closeTooltip();
});

hitLine.on('mouseup', function () {
  hitLine.closeTooltip();
});

L.marker([${ml},${mg}],{
  icon:L.divIcon({
    className:'',
    html:'<span style="font:700 11px Inter,sans-serif;color:#111827;background:#fff;padding:3px 9px;border-radius:6px;white-space:nowrap;display:inline-block;box-shadow:0 1px 6px rgba(0,0,0,.18);border:1px solid ${c.fill}44;">${lenM.toFixed(2)} m</span>',
    iconSize:[84,22],
    iconAnchor:[42,11]
  }),
  interactive:false
}).addTo(distanceLayer);
})();`;
    })
    .join("\n");

  const poleJs = valid
    .map((p) => {
      const lat = parseFloat(p.map_latitude!);
      const lng = parseFloat(p.map_longitude!);

      const spanInfo = poleSpanMap[p.pole_code];
      const allSpansDone =
        !!spanInfo &&
        spanInfo.total > 0 &&
        spanInfo.completed === spanInfo.total;

      const c = allSpansDone ? COLOR.completed : COLOR.pending;
      const label = safe(p.pole_name || p.pole_code);
      const short = safe((p.pole_code || "").replace(/^[A-Z0-9]+-/i, ""));
      const statusLabel = allSpansDone ? "Completed" : "Pending";
      const spanSummary = spanInfo
        ? `${spanInfo.completed}/${spanInfo.total} spans completed`
        : "No connected spans";

      return `(function(){
var icon=L.divIcon({
  className:'',
  html:'<div class="pole-circle" style="width:28px;height:28px;background:${c.fill};border-color:${c.border};color:${c.text};font-size:8px;">${short}</div>',
  iconSize:[28,28],
  iconAnchor:[14,14]
});

var tt =
  '<div class="tt">'+
    '<div class="tt-title">🔌 ${label}</div>'+
    '<div class="tt-row"><span class="tt-label">Status</span><span class="tt-val"><span class="badge" style="${c.badge}">${statusLabel}</span></span></div>'+
    '<div class="tt-row"><span class="tt-label">Spans</span><span class="tt-val">${spanSummary}</span></div>'+
    '<div class="tt-row"><span class="tt-label">Coordinates</span><span class="tt-val">${lat.toFixed(6)}, ${lng.toFixed(6)}</span></div>'+
  '</div>';

L.marker([${lat},${lng}],{icon:icon})
  .addTo(poleLayer)
  .bindTooltip(tt,{
    sticky:true,
    direction:'top',
    opacity:1,
    className:'',
    offset:[0,-22]
  });

bounds.push([${lat},${lng}]);
})();`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{
  width:100%;
  height:100vh;
  font-family:'Inter',sans-serif;
  background:#f0f4f8;
}
#map{
  width:100%;
  height:100vh;
  cursor:grab;
}
#map:active{cursor:grabbing;}
.leaflet-div-icon{
  background:none !important;
  border:none !important;
}
.pole-circle{
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius:50%;
  border:3px solid;
  font-family:'Inter',sans-serif;
  font-weight:800;
  box-shadow:0 2px 8px rgba(0,0,0,.22);
  cursor:pointer;
  transition:transform .15s, box-shadow .15s;
}
.pole-circle:hover{
  transform:scale(1.12);
  box-shadow:0 4px 18px rgba(0,0,0,.35);
}
.leaflet-tooltip{
  font-family:'Inter',sans-serif !important;
  padding:0 !important;
  background:none !important;
  border:none !important;
  box-shadow:none !important;
}
.leaflet-tooltip-top:before{display:none;}
.tt{
  background:#1e2433;
  color:#fff;
  border-radius:12px;
  padding:11px 15px;
  min-width:220px;
  font-family:'Inter',sans-serif;
  box-shadow:0 6px 24px rgba(0,0,0,.45);
  pointer-events:none;
}
.tt-title{
  font-size:13px;
  font-weight:800;
  margin-bottom:7px;
  border-bottom:1px solid rgba(255,255,255,.1);
  padding-bottom:6px;
}
.tt-row{
  display:flex;
  justify-content:space-between;
  font-size:11px;
  margin-top:5px;
  gap:12px;
}
.tt-label{
  color:#9ca3af;
  font-weight:600;
}
.tt-val{
  color:#fff;
  font-weight:700;
  text-align:right;
}
.sec{
  font-size:10px;
  color:#6b7280;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:.5px;
  margin-bottom:3px;
}
.badge{
  display:inline-block;
  padding:2px 8px;
  border-radius:99px;
  font-size:10px;
  font-weight:800;
  text-transform:uppercase;
  letter-spacing:.4px;
}
#legend{
  position:fixed;
  bottom:18px;
  left:50%;
  transform:translateX(-50%);
  background:#1e2433;
  color:#fff;
  border-radius:14px;
  padding:10px 22px;
  display:flex;
  gap:20px;
  align-items:center;
  box-shadow:0 4px 20px rgba(0,0,0,.4);
  font-size:11px;
  font-weight:700;
  z-index:9999;
  white-space:nowrap;
}
.ld{
  width:12px;
  height:12px;
  border-radius:50%;
  display:inline-block;
  margin-right:5px;
  vertical-align:middle;
}
#tbar{
  position:fixed;
  top:14px;
  left:50%;
  transform:translateX(-50%);
  z-index:9999;
  display:flex;
  gap:8px;
}
.tb{
  padding:10px 18px;
  border-radius:999px;
  border:none;
  font-size:12px;
  font-weight:800;
  cursor:pointer;
  background:#18233f;
  color:#9ca3af;
  box-shadow:0 2px 8px rgba(0,0,0,.25);
}
.tb.on{
  background:#0a6b4a;
  color:#fff;
}
</style>
</head>
<body>
<div id="map"></div>

<div id="tbar">
  <button class="tb on" id="bCable" onclick="setViewMode('cable')">With Cable</button>
  <button class="tb" id="bPins" onclick="setViewMode('pins')">Pins Only</button>
</div>

<div id="legend">
  <span><span class="ld" style="background:#10b981"></span>Completed</span>
  <span><span class="ld" style="background:#f59e0b"></span>Pending</span>
  <span><span class="ld" style="background:#ef4444"></span>Canceled</span>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{
  zoomControl:true,
  attributionControl:false,
  scrollWheelZoom:true,
  dragging:true,
  doubleClickZoom:true,
  minZoom:1,
  maxZoom:22
});

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  opacity:0.28,
  maxZoom:22,
  maxNativeZoom:19
}).addTo(map);

var poleLayer=L.layerGroup().addTo(map);
var spanLayer=L.layerGroup().addTo(map);
var distanceLayer=L.layerGroup().addTo(map);
var bounds=[];

${spanJs}
${poleJs}

if(bounds.length){
  map.fitBounds(L.latLngBounds(bounds),{padding:[80,80],maxZoom:17});
}

function setViewMode(mode){
  if(mode === 'pins'){
    if(map.hasLayer(spanLayer)) map.removeLayer(spanLayer);
    if(map.hasLayer(distanceLayer)) map.removeLayer(distanceLayer);
    if(!map.hasLayer(poleLayer)) map.addLayer(poleLayer);
  } else {
    if(!map.hasLayer(poleLayer)) map.addLayer(poleLayer);
    if(!map.hasLayer(spanLayer)) map.addLayer(spanLayer);
    if(!map.hasLayer(distanceLayer)) map.addLayer(distanceLayer);
  }

  document.getElementById('bCable').className = mode === 'cable' ? 'tb on' : 'tb';
  document.getElementById('bPins').className = mode === 'pins' ? 'tb on' : 'tb';
}

setViewMode('cable');

setTimeout(function(){
  map.invalidateSize();
}, 150);

window.addEventListener('load', function(){
  setTimeout(function(){
    map.invalidateSize();
  }, 150);
});
</script>
</body>
</html>`;
}

function PoleCard({
  pole,
  accentColor,
  nodeId,
  projectId,
  projectName,
}: {
  pole: Pole;
  accentColor: string;
  nodeId: string;
  projectId: string;
  projectName: string;
}) {
  const pill = getPillStyle(pole.status);
  const label = pole.pole_name || pole.pole_code;

  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!pole.map_latitude || !pole.map_longitude) return;

    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${pole.map_latitude}&lon=${pole.map_longitude}&format=json`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "TelcoVantage/1.0",
        },
      },
    )
      .then((r) => r.json())
      .then((data) => {
        const a = data?.address;
        if (!a) return;
        const street =
          a.road ??
          a.pedestrian ??
          a.footway ??
          a.street ??
          a.path ??
          a.neighbourhood ??
          a.suburb ??
          a.village ??
          a.city_district ??
          a.quarter ??
          null;
        setAddress(street);
      })
      .catch(() => {});
  }, [pole.map_latitude, pole.map_longitude]);

  const hasCoords = !!pole.map_latitude && !!pole.map_longitude;
  const lat = hasCoords ? parseFloat(pole.map_latitude!) : null;
  const lng = hasCoords ? parseFloat(pole.map_longitude!) : null;

  const openDetail = () =>
    router.push({
      pathname: "/projects/pole-detail",
      params: {
        pole_id: String(pole.id),
        pole_code: pole.pole_code,
        pole_name: pole.pole_name || pole.pole_code,
        node_id: nodeId,
        project_id: projectId,
        project_name: projectName,
        accent: accentColor,
      },
    });

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={openDetail}
      style={styles.cardWrap}
    >
      <View style={styles.siteCard}>
        <View style={[styles.heroStrip, { backgroundColor: accentColor }]}>
          <View style={styles.heroMapShell}>
            {hasCoords && lat !== null && lng !== null ? (
              <WebView
                style={StyleSheet.absoluteFillObject}
                scrollEnabled={false}
                pointerEvents="none"
                originWhitelist={["*"]}
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="always"
                source={{
                  html: buildSinglePoleMapHtml(lat, lng, pole.status),
                  baseUrl: "https://local.telcovantage/",
                }}
              />
            ) : (
              <View style={styles.heroGrid}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <View key={i} style={styles.heroDot} />
                ))}
              </View>
            )}

            <View style={[styles.mapStatusBadge, { backgroundColor: pill.bg }]}>
              <Text style={[styles.mapStatusBadgeText, { color: pill.text }]}>
                {pole.status}
              </Text>
            </View>
          </View>

          <View style={styles.heroTitleWrap}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {label}
            </Text>
            <Text style={styles.heroSubTitle} numberOfLines={1}>
              {pole.status || "Unknown"}
            </Text>
          </View>
        </View>

        <View style={styles.siteMetaBlock}>
          {hasCoords ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <Text style={styles.infoText} numberOfLines={2}>
                {address ?? `${pole.map_latitude}, ${pole.map_longitude}`}
              </Text>
            </View>
          ) : null}

          {pole.slot ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🧩</Text>
              <Text style={styles.infoText} numberOfLines={1}>
                Slot: {pole.slot}
              </Text>
            </View>
          ) : null}

          {pole.remarks ? (
            <View style={styles.remarksPill}>
              <Text style={styles.remarksText} numberOfLines={2}>
                {pole.remarks}
              </Text>
            </View>
          ) : null}

          <View style={styles.bottomActionRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={openDetail}
              style={[styles.startBtn, { backgroundColor: accentColor }]}
            >
              <Text style={styles.startBtnText}>Start Teardown</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function PolesScreen() {
  const { node_id, node_name, node_code, accent, project_id, project_name } =
    useLocalSearchParams<{
      node_id: string;
      node_name: string;
      node_code: string;
      accent: string;
      project_id: string;
      project_name: string;
    }>();

  const accentColor = accent || "#334155";
  const projectId = project_id ?? "";
  const projectName = project_name ?? "";

  const [poles, setPoles] = useState<Pole[]>([]);
  const [allPoles, setAllPoles] = useState<Pole[]>([]);
  const [spans, setSpans] = useState<Span[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [showVicinityMap, setShowVicinityMap] = useState(false);

  function applyFilter(raw: Pole[]) {
    return raw.filter((p) => {
      const s = p.status?.toLowerCase();
      return s !== "completed" && s !== "done" && s !== "finished";
    });
  }

  function loadPoles(forceRefresh = false) {
    const CACHE_KEY = `poles_node_${node_id}`;

    if (!forceRefresh) {
      cacheGet<Pole[]>(CACHE_KEY).then((cached) => {
        if (cached?.length) {
          setAllPoles(cached);
          setPoles(applyFilter(cached));
          setLoading(false);
        }
      });
    }

    api
      .get(`/nodes/${node_id}/poles`)
      .then(({ data }) => {
        const raw: Pole[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        cacheSet(CACHE_KEY, raw);
        setAllPoles(raw);
        setPoles(applyFilter(raw));
        setLoading(false);
        setError(false);
      })
      .catch(() => {
        cacheGet<Pole[]>(CACHE_KEY).then((cached) => {
          if (!cached?.length) setError(true);
          setLoading(false);
        });
      });
  }

  useEffect(() => {
    loadPoles();
  }, [node_id]);

  useEffect(() => {
    if (!node_id) return;
    api
      .get(`/nodes/${node_id}/spans`)
      .then(({ data }) => {
        const raw: Span[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        setSpans(raw);
      })
      .catch(() => {});
  }, [node_id]);

  const filteredPoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return poles;

    return poles.filter((pole) => {
      const haystack = [
        pole.pole_code,
        pole.pole_name,
        pole.slot,
        pole.status,
        pole.remarks,
        pole.map_latitude,
        pole.map_longitude,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [poles, search]);

  const listData = useMemo<ListRow[]>(
    () => [
      { type: "search", key: "search-row" },
      ...filteredPoles.map((pole) => ({
        type: "pole" as const,
        key: String(pole.id),
        pole,
      })),
    ],
    [filteredPoles],
  );

  const vicinityMapHtml = useMemo(
    () => buildVicinityMapHtml(allPoles, spans),
    [allPoles, spans],
  );

  const heroMapHtml = useMemo(() => buildHeroMapHtml(allPoles), [allPoles]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.root} edges={["top"]}>
        <Modal
          visible={showVicinityMap}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowVicinityMap(false)}
        >
          <View style={styles.mapModalRoot}>
            <View style={styles.mapModalHeader}>
              <TouchableOpacity
                onPress={() => setShowVicinityMap(false)}
                style={styles.mapModalCloseBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.mapModalCloseText}>✕</Text>
              </TouchableOpacity>

              <View style={styles.mapModalTitleWrap}>
                <Text style={styles.mapModalTitle}>Vicinity Map</Text>
                <Text style={styles.mapModalSubtitle} numberOfLines={1}>
                  {node_name || node_code || "Node"} • {allPoles.length} pole
                  {allPoles.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>

            <WebView
              key={vicinityMapHtml}
              source={{
                html: vicinityMapHtml,
                baseUrl: "https://local.telcovantage/",
              }}
              style={styles.mapModalMap}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
              cacheEnabled={false}
            />
          </View>
        </Modal>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={accentColor} size="large" />
            <Text style={styles.loadingText}>Loading poles...</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingWrap}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>⚠️</Text>
            <Text
              style={[
                styles.loadingText,
                { color: "#374151", fontWeight: "700" },
              ]}
            >
              Could not load poles.
            </Text>
            <TouchableOpacity
              onPress={() => loadPoles(true)}
              style={{
                marginTop: 12,
                backgroundColor: accentColor,
                borderRadius: 14,
                paddingHorizontal: 28,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => item.key}
            stickyHeaderIndices={[1]}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <>
                <Pressable
                  onPress={() => router.back()}
                  style={styles.floatingBackBtn}
                >
                  <Text style={styles.floatingBackIcon}>‹</Text>
                </Pressable>

                <View style={styles.topHeroCard}>
                  <View
                    style={[styles.topHeroBg, { backgroundColor: accentColor }]}
                  />
                  <View
                    style={[
                      styles.topHeroOverlay,
                      { backgroundColor: accentColor },
                    ]}
                  />
                  <View style={styles.topHeroGrid}>
                    {Array.from({ length: 40 }).map((_, i) => (
                      <View key={i} style={styles.topHeroDot} />
                    ))}
                  </View>
                  <View style={styles.topHeroCurveRight} />
                  <View style={styles.topHeroCurveLeft} />

                  <View style={styles.topHeroContent}>
                    {allPoles.filter((p) => p.map_latitude && p.map_longitude)
                      .length > 0 ? (
                      <View style={styles.heroMapBox}>
                        <WebView
                          style={StyleSheet.absoluteFillObject}
                          scrollEnabled={false}
                          originWhitelist={["*"]}
                          javaScriptEnabled
                          domStorageEnabled
                          mixedContentMode="always"
                          source={{
                            html: heroMapHtml,
                            baseUrl: "https://local.telcovantage/",
                          }}
                          cacheEnabled={false}
                        />
                      </View>
                    ) : null}

                    <Text style={styles.topHeroTitle} numberOfLines={2}>
                      {node_name || node_code || "Poles"}
                    </Text>

                    <Text style={styles.topHeroSub} numberOfLines={1}>
                      {projectName || "Project"}
                    </Text>

                    <View style={styles.topHeroSeparator} />

                    <View style={styles.topHeroStatsRow}>
                      <View style={styles.topHeroStatBox}>
                        <Text style={styles.topHeroStatLabel}>PROJECT</Text>
                        <Text style={styles.topHeroStatValue} numberOfLines={1}>
                          {projectName || "—"}
                        </Text>
                      </View>

                      <View style={styles.topHeroStatDivider} />

                      <View style={styles.topHeroStatBox}>
                        <Text style={styles.topHeroStatLabel}>NODE ID</Text>
                        <Text style={styles.topHeroStatValue} numberOfLines={1}>
                          {node_code || node_id || "—"}
                        </Text>
                      </View>

                      <View style={styles.topHeroStatDivider} />

                      <View style={styles.topHeroStatBox}>
                        <Text style={styles.topHeroStatLabel}>POLES</Text>
                        <Text style={styles.topHeroStatValue}>
                          {filteredPoles.length}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.heroButtonRow}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setShowVicinityMap(true)}
                        style={styles.vicinityBtn}
                      >
                        <Text style={styles.vicinityBtnText}>
                          🗺 Vicinity Map
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() =>
                          router.push({
                            pathname: "/teardown/node-logs" as any,
                            params: {
                              node_id: node_code || node_id,
                              node_name: node_name || node_code || "",
                              project_name: projectName,
                              accent: accentColor,
                            },
                          })
                        }
                        style={styles.vicinityBtn}
                      >
                        <Text style={styles.vicinityBtnText}>
                          📋 Teardown Logs
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </>
            }
            ListEmptyComponent={null}
            renderItem={({ item }) => {
              if (item.type === "search") {
                return (
                  <View style={styles.stickySearchContainer}>
                    <View style={styles.searchWrap}>
                      <Text style={styles.searchIcon}>⌕</Text>
                      <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search pole name, code, slot, status..."
                        placeholderTextColor="#9CA3AF"
                        style={styles.searchInput}
                      />
                      {search.length > 0 ? (
                        <Pressable
                          onPress={() => setSearch("")}
                          style={styles.clearBtn}
                        >
                          <Text style={styles.clearBtnText}>✕</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <Text style={styles.sectionLabel}>
                      {filteredPoles.length} active pole
                      {filteredPoles.length !== 1 ? "s" : ""}
                    </Text>

                    {filteredPoles.length === 0 && (
                      <View style={styles.emptyWrap}>
                        <Text style={styles.emptyIcon}>
                          {search.trim() ? "🔍" : "✅"}
                        </Text>
                        <Text style={styles.emptyText}>
                          {search.trim()
                            ? "No matching poles found."
                            : "All poles in this node are completed."}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              }

              return (
                <PoleCard
                  pole={item.pole}
                  accentColor={accentColor}
                  nodeId={node_id}
                  projectId={projectId}
                  projectName={projectName}
                />
              );
            }}
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F6F8FB",
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 48,
  },

  floatingBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  floatingBackIcon: {
    fontSize: 28,
    color: "#111827",
    fontWeight: "600",
    marginTop: -2,
  },

  topHeroCard: {
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 18,
    minHeight: 260,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    position: "relative",
  },

  topHeroBg: {
    ...StyleSheet.absoluteFillObject,
  },

  topHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    transform: [{ skewY: "-6deg" }, { translateY: -20 }],
  },

  topHeroGrid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    flexWrap: "wrap",
    opacity: 0.08,
    padding: 4,
  },

  topHeroDot: {
    width: "10%",
    height: "20%",
    borderWidth: 0.5,
    borderColor: "#ffffff",
  },

  topHeroCurveRight: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  topHeroCurveLeft: {
    position: "absolute",
    bottom: -36,
    left: -24,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  topHeroContent: {
    position: "relative",
    zIndex: 10,
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },

  topHeroTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 4,
  },

  topHeroSub: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 20,
  },

  topHeroSeparator: {
    width: "80%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 20,
  },

  topHeroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "space-around",
  },

  topHeroStatBox: {
    alignItems: "center",
    flex: 1,
  },

  topHeroStatDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  topHeroStatLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 5,
  },

  topHeroStatValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },

  heroMapBox: {
    width: "100%",
    height: 140,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 14,
  },

  heroButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    width: "100%",
  },

  vicinityBtn: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },

  vicinityBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
  },

  stickySearchContainer: {
    backgroundColor: "#F6F8FB",
    paddingTop: 2,
    paddingBottom: 10,
  },

  searchWrap: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECF3",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  searchIcon: {
    fontSize: 18,
    color: "#94A3B8",
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },

  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  clearBtnText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "800",
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9CA3AF",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },

  cardWrap: {
    marginBottom: 14,
  },

  siteCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    overflow: "hidden",
    position: "relative",
  },

  heroStrip: {
    borderRadius: 24,
    overflow: "hidden",
    padding: 14,
    minHeight: 250,
    justifyContent: "flex-end",
    marginBottom: 14,
  },

  heroMapShell: {
    width: "100%",
    height: 150,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    position: "relative",
  },

  mapStatusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    zIndex: 10,
  },

  mapStatusBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  heroGrid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    flexWrap: "wrap",
    opacity: 0.1,
    padding: 4,
  },

  heroDot: {
    width: "12.5%",
    height: "25%",
    borderWidth: 0.5,
    borderColor: "#fff",
  },

  heroTitleWrap: {
    alignItems: "center",
    justifyContent: "center",
  },

  heroTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: "center",
  },

  heroSubTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.82)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textAlign: "center",
  },

  siteMetaBlock: {
    paddingHorizontal: 2,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },

  infoIcon: {
    fontSize: 14,
    marginRight: 6,
    marginTop: 1,
  },

  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    lineHeight: 20,
  },

  remarksPill: {
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },

  remarksText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    lineHeight: 18,
  },

  bottomActionRow: {
    marginTop: 12,
  },

  startBtn: {
    width: "100%",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },

  startBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  loadingText: {
    fontSize: 13,
    color: "#9CA3AF",
  },

  emptyWrap: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 8,
  },

  emptyIcon: {
    fontSize: 40,
  },

  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "600",
  },

  mapModalRoot: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  mapModalHeader: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  mapModalCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  mapModalCloseText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },

  mapModalTitleWrap: {
    flex: 1,
  },

  mapModalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    letterSpacing: -0.3,
  },

  mapModalSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 2,
  },

  mapModalMap: {
    flex: 1,
    backgroundColor: "#E5E7EB",
  },
});
