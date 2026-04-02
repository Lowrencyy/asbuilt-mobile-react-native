import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_MAX_TRANSLATE = SCREEN_HEIGHT * 0.34;
const SHEET_MIN_TRANSLATE = 0;

const deliveryData = {
  driver: {
    name: "Ramon Dela Cruz",
    phone: "+63 917 555 0142",
    rating: "4.9",
    experience: "8 years",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
  },
  truck: {
    type: "Wing Van Truck",
    plate: "NFA 4821",
    capacity: "12 tons",
    color: "White / Blue",
  },
  shipment: {
    bookingId: "DLV-2026-0192",
    eta: "1 hr 28 min",
    distance: "41.6 km",
    freight: "₱18,450",
    pickupLabel: "Warehouse Pickup",
    pickupAddress: "Best Group Buy Hub, Santa Rosa, Laguna",
    dropoffLabel: "Delivery Point",
    dropoffAddress: "North Distribution Yard, Balintawak, Quezon City",
    notes: "Fragile components. Keep upright. No stacking on top layer.",
  },
  cargo: [
    { name: "Hydraulic Pump Assembly", qty: "4 crates" },
    { name: "Control Valve Kits", qty: "12 boxes" },
    { name: "Industrial Hoses", qty: "8 rolls" },
    { name: "Electrical Panel Parts", qty: "3 pallets" },
  ],
};

const waypoints = {
  pickup: { lat: 14.3113, lng: 121.1114 },
  dropoff: { lat: 14.6577, lng: 121.0036 },
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildMapHtml() {
  const truckLabel = escapeHtml(deliveryData.truck.type);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #eef3fb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .leaflet-control-attribution,
    .leaflet-control-zoom { display: none !important; }
    .pin-wrap {
      width: 20px;
      height: 20px;
      border-radius: 999px;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 18px rgba(15,23,42,0.18);
    }
    .pin-core {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      background: #f59e0b;
    }
    .truck-wrap {
      min-width: 90px;
      height: 36px;
      border-radius: 999px;
      background: #0b1f78;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 0 12px;
      box-shadow: 0 12px 24px rgba(11,31,120,0.26);
      border: 2px solid rgba(255,255,255,0.95);
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .truck-icon {
      font-size: 16px;
      line-height: 1;
    }
    .route-badge {
      position: absolute;
      top: 110px;
      right: 16px;
      z-index: 99999;
      background: rgba(255,255,255,0.96);
      color: #0f172a;
      border-radius: 18px;
      padding: 10px 12px;
      box-shadow: 0 10px 25px rgba(15,23,42,0.08);
      font-size: 12px;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="route-badge">Highway-preferred route</div>

  <script>
    const pickup = [${waypoints.pickup.lat}, ${waypoints.pickup.lng}];
    const dropoff = [${waypoints.dropoff.lat}, ${waypoints.dropoff.lng}];

    const map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const pickupIcon = L.divIcon({
      className: '',
      html: '<div class="pin-wrap"><div class="pin-core"></div></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const dropoffIcon = L.divIcon({
      className: '',
      html: '<div class="pin-wrap"><div class="pin-core"></div></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const truckIcon = L.divIcon({
      className: '',
      html: '<div class="truck-wrap"><span class="truck-icon">🚚</span><span>${truckLabel}</span></div>',
      iconSize: [112, 36],
      iconAnchor: [56, 18],
    });

    L.marker(pickup, { icon: pickupIcon }).addTo(map);
    L.marker(dropoff, { icon: dropoffIcon }).addTo(map);

    let routeLine;
    let truckMarker;

    async function drawRoute() {
      try {
        const url = 'https://router.project-osrm.org/route/v1/driving/' +
          pickup[1] + ',' + pickup[0] + ';' + dropoff[1] + ',' + dropoff[0] +
          '?overview=full&geometries=geojson';

        const response = await fetch(url);
        const data = await response.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates || [];

        if (!coords.length) throw new Error('No route');

        const latlngs = coords.map(function(c) { return [c[1], c[0]]; });

        routeLine = L.polyline(latlngs, {
          color: '#f59e0b',
          weight: 6,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        const mid = latlngs[Math.floor(latlngs.length * 0.52)] || latlngs[0];
        truckMarker = L.marker(mid, { icon: truckIcon }).addTo(map);

        map.fitBounds(routeLine.getBounds(), { padding: [70, 70] });
      } catch (error) {
        const fallback = [pickup, [14.387, 121.044], [14.505, 121.02], dropoff];
        routeLine = L.polyline(fallback, {
          color: '#f59e0b',
          weight: 6,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
        truckMarker = L.marker([14.505, 121.02], { icon: truckIcon }).addTo(map);
        map.fitBounds(routeLine.getBounds(), { padding: [70, 70] });
      }
    }

    drawRoute();
  </script>
</body>
</html>`;
}

function HeaderOverlay() {
  return (
    <View style={styles.topBar}>
      <Pressable style={styles.iconButton}>
        <Ionicons name="menu" size={22} color="#1e293b" />
      </Pressable>

      <View style={styles.tripStatePill}>
        <Text style={styles.tripStateText}>In Transit</Text>
      </View>

      <View style={styles.truckStatusPill}>
        <MaterialCommunityIcons
          name="truck-delivery-outline"
          size={18}
          color="#fff"
        />
      </View>
    </View>
  );
}

function RouteInfoFloat() {
  return (
    <View style={styles.routeFloatCard}>
      <View style={styles.routeStat}>
        <Text style={styles.routeStatLabel}>ETA</Text>
        <Text style={styles.routeStatValue}>{deliveryData.shipment.eta}</Text>
      </View>
      <View style={styles.routeDivider} />
      <View style={styles.routeStat}>
        <Text style={styles.routeStatLabel}>Distance</Text>
        <Text style={styles.routeStatValue}>
          {deliveryData.shipment.distance}
        </Text>
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function CargoItem({ name, qty }: { name: string; qty: string }) {
  return (
    <View style={styles.cargoItem}>
      <View style={styles.cargoIconWrap}>
        <MaterialCommunityIcons
          name="package-variant-closed"
          size={18}
          color="#0b1f78"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cargoName}>{name}</Text>
        <Text style={styles.cargoQty}>{qty}</Text>
      </View>
    </View>
  );
}

function DeliverySheet() {
  const translateY = useRef(new Animated.Value(SHEET_MAX_TRANSLATE)).current;
  const lastValue = useRef(SHEET_MAX_TRANSLATE);
  const [expanded, setExpanded] = useState(false);

  const animateTo = (value: number) => {
    lastValue.current = value;
    setExpanded(value === SHEET_MIN_TRANSLATE);
    Animated.spring(translateY, {
      toValue: value,
      useNativeDriver: true,
      damping: 20,
      stiffness: 180,
      mass: 0.8,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
        onPanResponderMove: (_, gesture) => {
          const next = Math.min(
            SHEET_MAX_TRANSLATE,
            Math.max(SHEET_MIN_TRANSLATE, lastValue.current + gesture.dy),
          );
          translateY.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldExpand =
            gesture.dy < -40 ||
            lastValue.current + gesture.dy < SHEET_MAX_TRANSLATE / 1.5;
          animateTo(shouldExpand ? SHEET_MIN_TRANSLATE : SHEET_MAX_TRANSLATE);
        },
      }),
    [translateY],
  );

  useEffect(() => {
    animateTo(SHEET_MAX_TRANSLATE);
  }, []);

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        onPress={() =>
          animateTo(expanded ? SHEET_MAX_TRANSLATE : SHEET_MIN_TRANSLATE)
        }
      >
        <View style={styles.sheetHandleWrap} {...panResponder.panHandlers}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Delivery Details</Text>
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-up"}
            size={18}
            color="#64748b"
          />
        </View>
      </Pressable>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.sheetScrollContent}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroKicker}>Live delivery</Text>
              <Text style={styles.heroTitle}>
                {deliveryData.shipment.bookingId}
              </Text>
            </View>
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>
                {deliveryData.shipment.freight}
              </Text>
            </View>
          </View>

          <View style={styles.driverRow}>
            <Image
              source={{ uri: deliveryData.driver.avatar }}
              style={styles.avatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{deliveryData.driver.name}</Text>
              <Text style={styles.driverMeta}>
                {deliveryData.driver.phone} • {deliveryData.driver.experience}
              </Text>
            </View>
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text style={styles.ratingText}>
                {deliveryData.driver.rating}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Route</Text>
          <View style={styles.timelineRow}>
            <View style={styles.timelineIconBlue}>
              <Ionicons name="navigate" size={14} color="#0b1f78" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pointLabel}>
                {deliveryData.shipment.pickupLabel}
              </Text>
              <Text style={styles.pointValue}>
                {deliveryData.shipment.pickupAddress}
              </Text>
            </View>
          </View>

          <View style={styles.timelineLine} />

          <View style={styles.timelineRow}>
            <View style={styles.timelineIconOrange}>
              <Ionicons name="location" size={15} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pointLabel}>
                {deliveryData.shipment.dropoffLabel}
              </Text>
              <Text style={styles.pointValue}>
                {deliveryData.shipment.dropoffAddress}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Truck Details</Text>
          <DetailRow label="Truck type" value={deliveryData.truck.type} />
          <DetailRow label="Plate number" value={deliveryData.truck.plate} />
          <DetailRow label="Capacity" value={deliveryData.truck.capacity} />
          <DetailRow label="Truck color" value={deliveryData.truck.color} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Cargo Components</Text>
          {deliveryData.cargo.map((item) => (
            <CargoItem key={item.name} name={item.name} qty={item.qty} />
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Handling Notes</Text>
          <Text style={styles.notesText}>{deliveryData.shipment.notes}</Text>
        </View>

        <View style={styles.actionBar}>
          <Pressable style={styles.secondaryButton}>
            <Ionicons name="call-outline" size={18} color="#334155" />
            <Text style={styles.secondaryButtonText}>Call Driver</Text>
          </Pressable>
          <Pressable style={styles.primaryButton}>
            <MaterialCommunityIcons
              name="truck-fast-outline"
              size={18}
              color="#fff"
            />
            <Text style={styles.primaryButtonText}>Track Shipment</Text>
          </Pressable>
        </View>
      </Animated.ScrollView>
    </Animated.View>
  );
}

function DeliveryMapCard() {
  const mapHtml = useMemo(() => buildMapHtml(), []);

  return (
    <View style={styles.mapShell}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: mapHtml }}
        style={StyleSheet.absoluteFill}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
      />
      <HeaderOverlay />
      <RouteInfoFloat />
      <DeliverySheet />
    </View>
  );
}

export default function DriverHomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <DeliveryMapCard />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#d8e6ff",
    padding: 14,
  },
  mapShell: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 34,
    backgroundColor: "#eef2f7",
  },
  topBar: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  tripStatePill: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.97)",
  },
  tripStateText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  truckStatusPill: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: "#0b1f78",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0b1f78",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  routeFloatCard: {
    position: "absolute",
    top: 82,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 20,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  routeStat: {
    gap: 2,
  },
  routeStatLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  routeStatValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  routeDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 14,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -SHEET_MAX_TRANSLATE,
    height: SCREEN_HEIGHT * 0.78,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    zIndex: 30,
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -10 },
    elevation: 18,
  },
  sheetHandleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sheetHandle: {
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  sheetScrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  heroCard: {
    backgroundColor: "#f8fbff",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e7eef8",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  heroKicker: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
  },
  priceBadge: {
    borderRadius: 18,
    backgroundColor: "#0b1f78",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  priceBadgeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
  },
  driverName: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0f172a",
  },
  driverMeta: {
    marginTop: 3,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: "#fff7ed",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#9a3412",
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#edf2f7",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 14,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  timelineIconBlue: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#0b1f78",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  timelineIconOrange: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  timelineLine: {
    width: 2,
    height: 20,
    backgroundColor: "#dbe4f0",
    marginLeft: 14,
    marginVertical: 8,
  },
  pointLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pointValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  detailLabel: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "700",
  },
  detailValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "800",
    maxWidth: "52%",
    textAlign: "right",
  },
  cargoItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  cargoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#eef4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  cargoName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  cargoQty: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  notesText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#334155",
    fontWeight: "600",
  },
  actionBar: {
    flexDirection: "row",
    gap: 12,
    marginTop: 2,
  },
  secondaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: "#334155",
    fontSize: 15,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1.15,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#0b1f78",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
