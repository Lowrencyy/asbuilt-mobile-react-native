import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const currentUser = {
  role: "warehouse", // "warehouse" | "lineman"
};

const deliveries = [
  {
    id: "1",
    nodeId: "NODE-101",
    subcontractor: "UIverse Logistics, Inc.",
    status: "Pending Delivery",
    totalLoads: 2,
    price: "$900",
    time: "3h",
    ratePerMile: "$3.60/mi",
    month: "Jun",
    date: "07",
    day: "Wed",
    pickupCity: "Marlboro, NJ",
    pickupMi: "16 mi",
    dropoffCity: "Mansfield, PA",
    dropoffMi: "157 mi",
    rateCheck: "$950",
    rateCheckPerMile: "$3.80/mi",
    approved: false,
    totalNodes: 12,
    totalCable: "450m",
    totalAmplifier: 3,
    totalTsc: 2,
    totalPowerSupply: 4,
  },
  {
    id: "2",
    nodeId: "NODE-102",
    subcontractor: "Prime Route Cargo",
    status: "Pending Delivery",
    totalLoads: 3,
    price: "$1120",
    time: "5h",
    ratePerMile: "$4.10/mi",
    month: "Jun",
    date: "09",
    day: "Fri",
    pickupCity: "Newark, NJ",
    pickupMi: "8 mi",
    dropoffCity: "Scranton, PA",
    dropoffMi: "182 mi",
    rateCheck: "$1180",
    rateCheckPerMile: "$4.30/mi",
    approved: false,
    totalNodes: 8,
    totalCable: "320m",
    totalAmplifier: 2,
    totalTsc: 1,
    totalPowerSupply: 3,
  },
  {
    id: "3",
    nodeId: "NODE-103",
    subcontractor: "NorthLink Freight",
    status: "Approved",
    totalLoads: 4,
    price: "$1340",
    time: "6h",
    ratePerMile: "$4.50/mi",
    month: "Jun",
    date: "12",
    day: "Mon",
    pickupCity: "Trenton, NJ",
    pickupMi: "22 mi",
    dropoffCity: "Allentown, PA",
    dropoffMi: "210 mi",
    rateCheck: "$1400",
    rateCheckPerMile: "$4.70/mi",
    approved: true,
    totalNodes: 15,
    totalCable: "600m",
    totalAmplifier: 5,
    totalTsc: 3,
    totalPowerSupply: 6,
  },
];

const truckHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100%;
      background: transparent;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .header {
      padding: 16px 20px 0;
      text-align: center;
      flex-shrink: 0;
    }
    .title {
      font-size: 26px;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.5px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .subtitle {
      margin-top: 4px;
      font-size: 14px;
      color: #94A3B8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .scene {
      height: 83px;
      position: relative;
      flex-shrink: 0;
    }

    /* road surface */
    .road {
      position: absolute;
      bottom: 0; left: 0;
      width: 100%; height: 3px;
      background: #282828;
      z-index: 1;
    }

    /* seamless dashed center line */
    .road-dashes {
      position: absolute;
      bottom: 7px; left: 0;
      width: 200%;
      height: 2px;
      background: repeating-linear-gradient(
        to right,
        #555 0px, #555 30px,
        transparent 30px, transparent 60px
      );
      animation: slideDashes 1.8s linear infinite;
    }
    @keyframes slideDashes {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    /* lamp post scrolls right-to-left */
    .lampPost {
      position: absolute;
      bottom: 2px;
      left: 100%;
      height: 80px;
      animation: moveLamp 2.8s linear infinite;
    }
    @keyframes moveLamp {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-120vw); }
    }

    /* truck sits on the road */
    .truckWrapper {
      position: absolute;
      bottom: 2px;
      left: 50%;
      transform: translateX(-50%);
      width: 130px;
      height: 90px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
    }
    .truckBody {
      width: 130px;
      animation: bounce 1s linear infinite;
      position: relative;
      z-index: 2;
      margin-bottom: 2px;
    }
    @keyframes bounce {
      0%   { transform: translateY(0); }
      50%  { transform: translateY(3px); }
      100% { transform: translateY(0); }
    }
    .truckTires {
      width: 130px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 10px 0 15px;
      position: absolute;
      bottom: 0;
      z-index: 2;
    }
    .truckTires svg { width: 22px; height: 22px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">For Delivery</div>
    <div class="subtitle">All pending deliveries from warehouse</div>
  </div>
  <div class="scene">
  <div class="road"></div>
  <div class="road-dashes"></div>

  <svg class="lampPost" xml:space="preserve" viewBox="0 0 453.459 453.459" xmlns="http://www.w3.org/2000/svg" fill="#000000">
    <path d="M252.882,0c-37.781,0-68.686,29.953-70.245,67.358h-6.917v8.954c-26.109,2.163-45.463,10.011-45.463,19.366h9.993c-1.65,5.146-2.507,10.54-2.507,16.017c0,28.956,23.558,52.514,52.514,52.514c28.956,0,52.514-23.558,52.514-52.514c0-5.478-0.856-10.872-2.506-16.017h9.992c0-9.354-19.352-17.204-45.463-19.366v-8.954h-6.149C200.189,38.779,223.924,16,252.882,16c29.952,0,54.32,24.368,54.32,54.32c0,28.774-11.078,37.009-25.105,47.437c-17.444,12.968-37.216,27.667-37.216,78.884v113.914h-0.797c-5.068,0-9.174,4.108-9.174,9.177c0,2.844,1.293,5.383,3.321,7.066c-3.432,27.933-26.851,95.744-8.226,115.459v11.202h45.75v-11.202c18.625-19.715-4.794-87.527-8.227-115.459c2.029-1.683,3.322-4.223,3.322-7.066c0-5.068-4.107-9.177-9.176-9.177h-0.795V196.641c0-43.174,14.942-54.283,30.762-66.043c14.793-10.997,31.559-23.461,31.559-60.277C323.202,31.545,291.656,0,252.882,0z M232.77,111.694c0,23.442-19.071,42.514-42.514,42.514c-23.442,0-42.514-19.072-42.514-42.514c0-5.531,1.078-10.957,3.141-16.017h78.747C231.693,100.736,232.77,106.162,232.77,111.694z"></path>
  </svg>

  <div class="truckWrapper">
    <div class="truckBody">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 198 93">
        <path stroke-width="3" stroke="#282828" fill="#0A5C3B" d="M135 22.5H177.264C178.295 22.5 179.22 23.133 179.594 24.0939L192.33 56.8443C192.442 57.1332 192.5 57.4404 192.5 57.7504V89C192.5 90.3807 191.381 91.5 190 91.5H135C133.619 91.5 132.5 90.3807 132.5 89V25C132.5 23.6193 133.619 22.5 135 22.5Z"></path>
        <path stroke-width="3" stroke="#282828" fill="#FFFFFF" d="M146 33.5H181.741C182.779 33.5 183.709 34.1415 184.078 35.112L190.538 52.112C191.16 53.748 189.951 55.5 188.201 55.5H146C144.619 55.5 143.5 54.3807 143.5 53V36C143.5 34.6193 144.619 33.5 146 33.5Z"></path>
        <path stroke-width="2" stroke="#282828" fill="#282828" d="M150 65C150 65.39 149.763 65.8656 149.127 66.2893C148.499 66.7083 147.573 67 146.5 67C145.427 67 144.501 66.7083 143.873 66.2893C143.237 65.8656 143 65.39 143 65C143 64.61 143.237 64.1344 143.873 63.7107C144.501 63.2917 145.427 63 146.5 63C147.573 63 148.499 63.2917 149.127 63.7107C149.763 64.1344 150 64.61 150 65Z"></path>
        <rect stroke-width="2" stroke="#282828" fill="#FFFCAB" rx="1" height="7" width="5" y="63" x="187"></rect>
        <rect stroke-width="2" stroke="#282828" fill="#282828" rx="1" height="11" width="4" y="81" x="193"></rect>
        <rect stroke-width="3" stroke="#282828" fill="#DFDFDF" rx="2.5" height="90" width="121" y="1.5" x="6.5"></rect>
        <rect stroke-width="2" stroke="#282828" fill="#DFDFDF" rx="2" height="4" width="6" y="84" x="1"></rect>

        <!-- logo + text on cargo box -->
        <svg x="48" y="10" width="40" height="43" viewBox="0 0 300 320">
          <g fill="#0A5C3B">
            <rect x="10" y="20" width="270" height="10" rx="1" />
            <rect x="35" y="50" width="230" height="10" rx="1" />
            <rect x="55" y="80" width="190" height="12" rx="1" />
            <rect x="115" y="92" width="12" height="140" rx="1" />
            <rect x="145" y="92" width="12" height="165" rx="1" />
            <rect x="175" y="92" width="12" height="140" rx="1" />
          </g>
        </svg>
        <text x="65" y="54" text-anchor="middle" font-size="7.5" font-weight="800" fill="#0A5C3B" font-family="Arial, sans-serif" letter-spacing="0.5">TELCOVANTAGE</text>
        <text x="68" y="61" text-anchor="middle" font-size="6.5" font-weight="600" fill="#282828" font-family="Arial, sans-serif" letter-spacing="0.3">PHILIPPINES</text>
      </svg>
    </div>
    <div class="truckTires">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 30 30">
        <circle stroke-width="3" stroke="#282828" fill="#282828" r="13.5" cy="15" cx="15"></circle>
        <circle fill="#DFDFDF" r="7" cy="15" cx="15"></circle>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 30 30">
        <circle stroke-width="3" stroke="#282828" fill="#282828" r="13.5" cy="15" cx="15"></circle>
        <circle fill="#DFDFDF" r="7" cy="15" cx="15"></circle>
      </svg>
    </div>
  </div>
  </div>
</body>
</html>
`;

function getPHT() {
  const now = new Date();
  const phtMs =
    now.getTime() + now.getTimezoneOffset() * 60 * 1000 + 8 * 60 * 60 * 1000;
  return new Date(phtMs);
}
function getPHTDate() {
  const p = getPHT();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${days[p.getDay()]}, ${months[p.getMonth()]} ${p.getDate()}, ${p.getFullYear()}`;
}
function getPHTTime() {
  const p = getPHT();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(p.getHours())}:${pad(p.getMinutes())}:${pad(p.getSeconds())} PHT`;
}

export default function DeliveryScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelected] = useState<(typeof deliveries)[0] | null>(null);
  const [remarks, setRemarks] = useState("");
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [editedQty, setEditedQty] = useState({
    nodes: "",
    cable: "",
    amplifier: "",
    tsc: "",
    powerSupply: "",
  });

  const isWarehouse =
    currentUser.role === "warehouse" || currentUser.role === "pm";

  async function handlePickImage() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera access is needed to attach proof of delivery.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled) {
      setProofImage(result.assets[0].uri);
    }
  }

  function openApproveModal(item: (typeof deliveries)[0]) {
    setSelected(item);
    setRemarks("");
    setProofImage(null);
    setEditedQty({
      nodes: String(item.totalNodes),
      cable: String(item.totalCable),
      amplifier: String(item.totalAmplifier),
      tsc: String(item.totalTsc),
      powerSupply: String(item.totalPowerSupply),
    });
    setModalVisible(true);
  }

  function handleApprove() {
    if (!proofImage) {
      Alert.alert(
        "Proof Required",
        "Please attach an image as proof of delivery.",
      );
      return;
    }
    Alert.alert("Approved!", `${selected?.nodeId} has been approved.`, [
      { text: "OK", onPress: () => setModalVisible(false) },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Approval Modal — slide up sheet */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Delivery Approval</Text>
                  <Text style={styles.modalSubtitle}>
                    {selected?.nodeId} · {selected?.subcontractor}
                  </Text>
                </View>
                <View style={styles.modalBadge}>
                  <Text style={styles.modalBadgeText}>Pending</Text>
                </View>
              </View>

              {/* Info rows */}
              <View style={styles.infoCard}>
                {[
                  { label: "Pickup", value: selected?.pickupCity },
                  { label: "Warehouse", value: selected?.dropoffCity },
                  { label: "Date", value: getPHTDate() },
                  { label: "Time", value: getPHTTime() },
                ].map(({ label, value }, i, arr) => (
                  <View
                    key={label}
                    style={[
                      styles.infoRow,
                      i === arr.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <Text style={styles.infoLabel}>{label}</Text>
                    <Text style={styles.infoValue}>{value}</Text>
                  </View>
                ))}
              </View>

              {/* Components */}
              <Text style={styles.sectionLabel}>Components</Text>
              <View style={styles.infoCard}>
                <View style={[styles.infoRow, styles.tableHead]}>
                  <Text style={[styles.thCell, { flex: 3 }]}>Item</Text>
                  <Text
                    style={[styles.thCell, { flex: 1, textAlign: "center" }]}
                  >
                    Unit
                  </Text>
                  <Text
                    style={[styles.thCell, { flex: 1.2, textAlign: "right" }]}
                  >
                    Qty
                  </Text>
                </View>
                {[
                  { key: "nodes", label: "Node", unit: "pcs", field: "nodes" },
                  { key: "cable", label: "Cable", unit: "m", field: "cable" },
                  {
                    key: "amplifier",
                    label: "Amplifier",
                    unit: "pcs",
                    field: "amplifier",
                  },
                  { key: "tsc", label: "TSC", unit: "pcs", field: "tsc" },
                  {
                    key: "powerSupply",
                    label: "Power Supply",
                    unit: "pcs",
                    field: "powerSupply",
                  },
                ].map((row, i, arr) => (
                  <View
                    key={row.key}
                    style={[
                      styles.infoRow,
                      i === arr.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <Text style={[styles.infoLabel, { flex: 3 }]}>
                      {row.label}
                    </Text>
                    <Text
                      style={[
                        styles.infoMuted,
                        { flex: 1, textAlign: "center" },
                      ]}
                    >
                      {row.unit}
                    </Text>
                    <TextInput
                      style={styles.qtyInput}
                      keyboardType="numeric"
                      value={editedQty[row.field as keyof typeof editedQty]}
                      onChangeText={(v) =>
                        setEditedQty((p) => ({ ...p, [row.field]: v }))
                      }
                    />
                  </View>
                ))}
              </View>

              {/* Proof */}
              <Text style={styles.sectionLabel}>Proof of Delivery</Text>
              <TouchableOpacity
                style={styles.imagePicker}
                onPress={handlePickImage}
                activeOpacity={0.8}
              >
                {proofImage ? (
                  <Image
                    source={{ uri: proofImage }}
                    style={styles.imagePreviewFull}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imageEmpty}>
                    <Text style={styles.imageEmptyIcon}>📷</Text>
                    <Text style={styles.imageEmptyText}>
                      Take a photo or choose from gallery
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Remarks */}
              <Text style={styles.sectionLabel}>
                Remarks <Text style={styles.optionalTag}>optional</Text>
              </Text>
              <TextInput
                style={styles.remarksInput}
                placeholder="Write any notes here..."
                placeholderTextColor="#B0BAC9"
                multiline
                value={remarks}
                onChangeText={setRemarks}
              />

              {/* Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.approveBtn,
                    !proofImage && styles.approveBtnDisabled,
                  ]}
                  onPress={handleApprove}
                >
                  <Text style={styles.approveBtnText}>✓ Approve</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.truckContainer}>
        <WebView
          source={{ html: truckHtml }}
          style={styles.truckWebView}
          scrollEnabled={false}
          pointerEvents="none"
          androidLayerType="hardware"
          backgroundColor="transparent"
        />
      </View>

      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.loadCard,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() =>
              router.push({
                pathname: "/deliveries/[id]",
                params: {
                  id: item.id,
                  nodeId: item.nodeId,
                  subcontractor: item.subcontractor,
                  status: item.status,
                  role: currentUser.role,
                },
              })
            }
          >
            <View style={styles.cardNamePrice}>
              <Text style={styles.loadCardName}>{item.subcontractor}</Text>
            </View>

            <View style={styles.cardInfo}>
              <View style={styles.cardDateWrapper}>
                <Text style={styles.smallMuted}>{item.month}</Text>
                <Text style={styles.cardDate}>{item.date}</Text>
                <Text style={styles.smallMuted}>{item.day}</Text>
              </View>

              <View style={styles.cardCityUnitWrapper}>
                <View style={styles.cityWithMi}>
                  <View style={styles.roundIcon} />
                  <Text style={styles.cityName}>{item.pickupCity}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.cityWithMi}>
                  <View style={styles.squareIcon} />
                  <Text style={styles.cityName}>{item.dropoffCity}</Text>
                </View>
              </View>

              <View style={styles.summaryBox}>
                {[
                  ["NODES", item.totalNodes, "PCS"],
                  ["CABLE", item.totalCable, "meters"],
                  ["AMPLIFIER", item.totalAmplifier, "PCS"],
                  ["TSC", item.totalTsc, "PCS"],
                  ["POWERSUPPLY", item.totalPowerSupply, "PCS"],
                ].map(([label, val, unit]) => (
                  <View key={label} style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      {label} ({unit}):
                    </Text>
                    <Text style={styles.summaryValue}>{val ?? "—"}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.cardFooter}>
              <View
                style={[
                  styles.approvalBadge,
                  item.approved ? styles.approvedBadge : styles.pendingBadge,
                ]}
              >
                <Text
                  style={[
                    styles.approvalText,
                    item.approved ? styles.approvedText : styles.pendingText,
                  ]}
                >
                  {item.approved ? "Approved" : "Awaiting Approval"}
                </Text>
              </View>
              {isWarehouse && !item.approved ? (
                <TouchableOpacity onPress={() => openApproveModal(item)}>
                  <Text style={styles.approveLink}>Approve</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.summaryLink}>Open Deliveries</Text>
              )}
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 0,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
  },
  truckContainer: {
    height: 180,
    width: "100%",
  },
  truckWebView: {
    flex: 1,
    backgroundColor: "transparent",
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },

  loadCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderBottomWidth: 6,
    borderBottomColor: "rgb(228, 247, 232)",
  },
  cardNamePrice: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  loadCardName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#484848",
    paddingRight: 12,
  },
  loadCardPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: "rgb(0, 181, 41)",
  },
  cardTime: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 10,
  },
  smallMuted: { fontSize: 12, color: "#6b7280" },
  cardInfo: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    marginBottom: 12,
  },
  cardDateWrapper: { alignItems: "center", width: 50 },
  cardDate: {
    fontSize: 28,
    fontWeight: "700",
    color: "#484848",
    lineHeight: 32,
  },
  cardCityUnitWrapper: {
    flex: 1,
    position: "relative",
    paddingLeft: 2,
    rowGap: 20,
  },
  routeLine: {
    position: "absolute",
    left: 4,
    top: 12,
    bottom: 12,
    borderLeftWidth: 2,
    borderStyle: "dotted",
    borderColor: "#9ca3af",
  },
  cityWithMi: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    zIndex: 2,
  },
  roundIcon: {
    width: 10,
    height: 10,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: "gray",
    backgroundColor: "#fff",
  },
  squareIcon: {
    width: 10,
    height: 10,
    borderWidth: 2,
    borderColor: "rgb(255, 157, 31)",
    backgroundColor: "#fff",
  },
  cityName: {
    flex: 1,
    fontSize: 14,
    color: "#484848",
    fontWeight: "500",
  },
  summaryBox: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#919191",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 155,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 2,
  },
  summaryLabel: { fontSize: 8, color: "#6b7280", fontWeight: "700" },
  summaryValue: { fontSize: 8, color: "#484848", fontWeight: "700" },
  cardFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  approvalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  approvedBadge: { backgroundColor: "#DCFCE7" },
  pendingBadge: { backgroundColor: "#FEF3C7" },
  approvalText: { fontSize: 12, fontWeight: "800" },
  approvedText: { color: "#166534" },
  pendingText: { color: "#92400E" },
  summaryLink: { fontSize: 14, fontWeight: "800", color: "#0284C7" },
  approveLink: { fontSize: 14, fontWeight: "800", color: "#0A5C3B" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FAFAFA",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 10,
    maxHeight: "92%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#DDE3ED",
    borderRadius: 99,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  modalBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  modalBadgeText: { fontSize: 11, fontWeight: "700", color: "#92400E" },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 3,
  },

  // Info card + rows
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  infoLabel: { fontSize: 13, color: "#64748B", fontWeight: "600", flex: 2 },
  infoValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "700",
    flex: 3,
    textAlign: "right",
  },
  infoMuted: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },

  tableHead: { backgroundColor: "#F8FAFC" },
  thCell: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },

  qtyInput: {
    flex: 1.2,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    backgroundColor: "#FAFAFA",
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  imagePreviewFull: { width: "100%", height: 160, borderRadius: 14 },
  imageEmpty: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  imageEmptyIcon: { fontSize: 28 },
  imageEmptyText: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },
  optionalTag: { fontSize: 11, color: "#B0BAC9", fontWeight: "400" },
  modalSection: {
    marginBottom: 18,
  },
  modalSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  detailLabel: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 13,
    color: "#1E293B",
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 12,
  },

  verifyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: "#0A5C3B",
    borderColor: "#0A5C3B",
  },
  checkmark: { color: "#fff", fontSize: 12, fontWeight: "800" },
  verifyText: { flex: 1, fontSize: 13, color: "#166534", fontWeight: "600" },

  imagePicker: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    backgroundColor: "#fff",
  },
  imagePickerPlaceholder: {
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  imagePickerIcon: { fontSize: 26 },
  imagePickerText: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },
  imagePreview: {
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0FDF4",
    gap: 4,
  },
  imagePreviewText: { fontSize: 14, color: "#166534", fontWeight: "700" },

  remarksInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: "#1E293B",
    minHeight: 80,
    textAlignVertical: "top",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "700", color: "#64748B" },
  approveBtn: {
    flex: 2,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: "#0A5C3B",
    alignItems: "center",
  },
  approveBtnDisabled: { backgroundColor: "#A7C4B5" },
  approveBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },

  modalBackdrop: { flex: 1 },
  optional: { fontSize: 11, fontWeight: "400", color: "#94A3B8" },
  imagePreviewSub: { fontSize: 11, color: "#166534", marginTop: 2 },

  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#0A5C3B",
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
    borderRadius: 4,
  },
  tableRowAlt: { backgroundColor: "#F8FAFC" },
  tableCell: { fontSize: 12 },
  tableCellItem: { flex: 3 },
  tableCellUnit: { flex: 1.5, textAlign: "center" },
  tableCellQty: { flex: 1.5, textAlign: "right" },
  tableCellText: { color: "#374151", fontWeight: "600" },
  tableCellMuted: { color: "#6B7280", textAlign: "center" },
  tableCellInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlign: "center",
    color: "#0F172A",
    fontWeight: "700",
    backgroundColor: "#fff",
  },
});
