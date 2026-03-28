import api from "@/lib/api";
import { cacheSet } from "@/lib/cache";
import { queuePush } from "@/lib/sync-queue";
import { tokenStore } from "@/lib/token";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

type PhotoFile = { uri: string; name: string; type: string } | null;

function sanitize(s?: string) {
  return (s ?? "").toLowerCase().trim().replace(/[^a-z0-9_-]/g, "_");
}

const STEPS = [
  { key: "cable",      label: "Cable",      icon: "🔌" },
  { key: "components", label: "Components", icon: "📦" },
];

// ─── Step dot ────────────────────────────────────────────────────────────────

function StepDot({ index, current }: { index: number; current: number }) {
  const done   = index < current;
  const active = index === current;
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <View
        style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: done ? "#10b981" : active ? "#0d47c9" : "#e5e7eb",
          alignItems: "center", justifyContent: "center",
        }}
      >
        {done ? (
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>✓</Text>
        ) : (
          <Text style={{ color: active ? "#fff" : "#9ca3af", fontSize: 12, fontWeight: "700" }}>
            {index + 1}
          </Text>
        )}
      </View>
      <Text style={{ fontSize: 9, color: active ? "#0d47c9" : done ? "#10b981" : "#9ca3af", marginTop: 3, fontWeight: "600" }}>
        {STEPS[index].label}
      </Text>
    </View>
  );
}

// ─── Counter ─────────────────────────────────────────────────────────────────

function Counter({
  label, value, expected, onChange,
}: { label: string; value: number; expected: number; onChange: (v: number) => void }) {
  return (
    <View style={{ backgroundColor: "#f8f9ff", borderRadius: 16, padding: 14, flex: 1, marginHorizontal: 4, alignItems: "center" }}>
      <Text style={{ fontSize: 9, color: "#9ca3af", fontWeight: "700", textTransform: "uppercase", marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 10, color: "#6366f1", fontWeight: "600", marginBottom: 8 }}>exp. {expected}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TouchableOpacity
          onPress={() => onChange(Math.max(0, value - 1))}
          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "900", color: "#374151" }}>−</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827", minWidth: 24, textAlign: "center" }}>{value}</Text>
        <TouchableOpacity
          onPress={() => onChange(value + 1)}
          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#0d47c9", alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "900", color: "#fff" }}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function TeardownComponentsScreen() {
  const params = useLocalSearchParams<{
    pole_code: string;
    pole_name: string;
    node_id: string;
    project_id: string;
    project_name: string;
    accent: string;
    span_id: string;
    span_code: string;
    to_pole_id: string;
    to_pole_code: string;
    to_pole_name: string;
    expected_cable: string;
    length_meters: string;
    declared_runs: string;
    expected_node: string;
    expected_amplifier: string;
    expected_extender: string;
    expected_tsc: string;
    expected_powersupply: string;
    expected_powersupply_housing: string;
    to_pole_latitude: string;
    to_pole_longitude: string;
    to_pole_gps_captured_at: string;
    to_pole_gps_accuracy: string;
    destination_slot: string;
    destination_landmark: string;
  }>();

  const projFolder   = sanitize(params.project_name);
  const fromCode     = sanitize(params.pole_code);
  const toCode       = sanitize(params.to_pole_code);
  const draftDir     = `${FileSystem.documentDirectory}teardown_drafts/${projFolder}/${params.node_id}/${params.pole_code}/`;
  const poleDraftDir = `${FileSystem.documentDirectory}pole_drafts/${projFolder}/${params.node_id}/${params.pole_code}/`;
  const expectedCable = Number(params.expected_cable) || 0;
  const declaredRuns  = Number(params.declared_runs)  || 0;
  const lengthMeters  = Number(params.length_meters)  || 0;

  const startedAt = useRef(new Date().toISOString());
  const gpsRef    = useRef<{ lat: number; lng: number; acc: number | null } | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // ── Step ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);

  // ── Photos ────────────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<Record<string, PhotoFile>>({
    from_before: null, from_after: null, from_tag: null,
    to_before: null, to_after: null, to_tag: null,
  });

  // ── Cable ─────────────────────────────────────────────────────────────────
  const [collectedAll, setCollectedAll] = useState<boolean | null>(null);
  const [recoveredCable, setRecoveredCable] = useState("");
  const [actualRuns, setActualRuns] = useState(declaredRuns || 1);
  const [cableReason, setCableReason] = useState("");
  const [cablePhoto, setCablePhoto] = useState<PhotoFile>(null);

  // ── Components ────────────────────────────────────────────────────────────
  const [collectedNode, setCollectedNode] = useState(0);
  const [collectedAmp,  setCollectedAmp]  = useState(0);
  const [collectedExt,  setCollectedExt]  = useState(0);
  const [collectedTsc,  setCollectedTsc]  = useState(0);
  const [collectedPs,   setCollectedPs]   = useState(0);
  const [collectedPsh,  setCollectedPsh]  = useState(0);

  const [submitting, setSubmitting] = useState(false);

  const recoveredNum = parseFloat(recoveredCable) || 0;
  const adjExpected  = declaredRuns > 0 && lengthMeters > 0 ? lengthMeters * actualRuns : expectedCable;
  const unrecovered  = Math.max(0, adjExpected - recoveredNum);

  // ── On mount ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadPhotos();
    captureGps();
  }, []);

  async function loadPhotos() {
    const files: Record<string, string> = {
      from_before: `${fromCode}_before.jpg`,
      from_after:  `${fromCode}_after.jpg`,
      from_tag:    `${fromCode}_poletag.jpg`,
      to_before:   `${toCode}_before.jpg`,
      to_after:    `${toCode}_after.jpg`,
      to_tag:      `${toCode}_poletag.jpg`,
    };
    const result: Record<string, PhotoFile> = {};
    await Promise.all(
      Object.entries(files).map(async ([key, file]) => {
        const path = draftDir + file;
        const info = await FileSystem.getInfoAsync(path);
        result[key] = info.exists ? { uri: info.uri, name: file, type: "image/jpeg" } : null;
      })
    );
    setPhotos(result);

    const cablePath = draftDir + `${fromCode}_cable.jpg`;
    const cableInfo = await FileSystem.getInfoAsync(cablePath);
    if (cableInfo.exists) {
      setCablePhoto({ uri: cableInfo.uri, name: `${fromCode}_cable.jpg`, type: "image/jpeg" });
    }
  }

  async function captureGps() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const last = await Location.getLastKnownPositionAsync({ maxAge: 30000 }).catch(() => null);
      if (last && last.coords.accuracy != null && last.coords.accuracy <= 50) {
        gpsRef.current = { lat: last.coords.latitude, lng: last.coords.longitude, acc: last.coords.accuracy };
        return;
      }
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
        new Promise<null>((res) => setTimeout(() => res(null), 60000)),
      ]);
      if (loc) {
        gpsRef.current = { lat: loc.coords.latitude, lng: loc.coords.longitude, acc: loc.coords.accuracy };
      }
    } catch { /* non-blocking */ }
  }

  async function captureCablePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Please allow camera access."); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.5 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const fileName = `${fromCode}_cable.jpg`;
      await FileSystem.makeDirectoryAsync(draftDir, { intermediates: true });
      await FileSystem.copyAsync({ from: uri, to: draftDir + fileName }).catch(() => {});
      setCablePhoto({ uri: draftDir + fileName, name: fileName, type: "image/jpeg" });
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function canProceed() {
    if (step === 0) return collectedAll !== null;
    // step 1 — all required photos + cable answered
    return !!photos.from_before && !!photos.from_tag &&
           !!photos.to_before && !!photos.to_after && !!photos.to_tag &&
           collectedAll !== null;
  }

  function goNext() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      handleSubmit();
    }
  }

  // ── Build fields (mirrors reference app pattern) ──────────────────────────
  async function buildFields(): Promise<Record<string, string>> {
    const finishedAt = new Date().toISOString();
    const user = await tokenStore.getUser();

    const didCollectComponents =
      collectedNode > 0 || collectedAmp > 0 || collectedExt > 0 ||
      collectedTsc  > 0 || collectedPs  > 0 || collectedPsh > 0 ? "1" : "0";

    const fields: Record<string, string> = {
      did_collect_all_cable:        collectedAll ? "1" : "0",
      collected_cable:              String(collectedAll ? expectedCable : recoveredNum),
      declared_runs:                String(declaredRuns),
      actual_runs:                  String(actualRuns),
      did_collect_components:       didCollectComponents,
      collected_node:               String(collectedNode),
      collected_amplifier:          String(collectedAmp),
      collected_extender:           String(collectedExt),
      collected_tsc:                String(collectedTsc),
      collected_powersupply:        String(collectedPs),
      collected_powersupply_housing:String(collectedPsh),
      expected_cable:               String(expectedCable),
      expected_node:                params.expected_node   || "0",
      expected_amplifier:           params.expected_amplifier || "0",
      expected_extender:            params.expected_extender  || "0",
      expected_tsc:                 params.expected_tsc       || "0",
      started_at:                   startedAt.current,
      finished_at:                  finishedAt,
      submitted_at:                 finishedAt,
    };

    if (!collectedAll) {
      fields.recovered_cable    = String(recoveredNum);
      fields.unrecovered_cable  = String(unrecovered);
      fields.unrecovered_reason = cableReason;
    }

    if (params.span_id)    fields.pole_span_id = params.span_id;
    if (params.node_id && params.node_id !== "undefined")       fields.node_id    = params.node_id;
    if (params.project_id && params.project_id !== "undefined") fields.project_id = params.project_id;
    if (params.to_pole_id && params.to_pole_id !== "undefined") fields.to_pole_id = params.to_pole_id;
    if (params.destination_slot)     fields.destination_slot     = params.destination_slot;
    if (params.destination_landmark) fields.destination_landmark = params.destination_landmark;
    if (user?.name) fields.submitted_by = user.name;
    if (user?.team) fields.team         = user.team;

    const gps = gpsRef.current;
    if (gps) {
      fields.gps_latitude  = String(gps.lat);
      fields.gps_longitude = String(gps.lng);
      if (gps.acc != null) fields.gps_accuracy = gps.acc.toFixed(2);
      fields.from_pole_latitude  = String(gps.lat);
      fields.from_pole_longitude = String(gps.lng);
    }

    if (params.to_pole_latitude) {
      fields.to_pole_latitude  = params.to_pole_latitude;
      fields.to_pole_longitude = params.to_pole_longitude;
      if (params.to_pole_gps_captured_at) fields.to_pole_gps_captured_at = params.to_pole_gps_captured_at;
      if (params.to_pole_gps_accuracy)    fields.to_pole_gps_accuracy    = params.to_pole_gps_accuracy;
    }

    return fields;
  }

  function buildPhotoPaths(): Record<string, string> {
    const paths: Record<string, string> = {};
    if (photos.from_before) paths.from_before = photos.from_before.uri;
    if (photos.from_after)  paths.from_after  = photos.from_after.uri;
    if (photos.from_tag)    paths.from_tag    = photos.from_tag.uri;
    if (photos.to_before)   paths.to_before   = photos.to_before.uri;
    if (photos.to_after)    paths.to_after    = photos.to_after.uri;
    if (photos.to_tag)      paths.to_tag      = photos.to_tag.uri;
    if (cablePhoto)         paths.before_span = cablePhoto.uri;
    return paths;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const missing: string[] = [];
    if (!photos.from_before) missing.push("From Pole — Before photo");
    if (!photos.from_tag)    missing.push("From Pole — Pole Tag photo");
    if (!photos.to_before)   missing.push("Destination Pole — Before photo");
    if (!photos.to_after)    missing.push("Destination Pole — After photo");
    if (!photos.to_tag)      missing.push("Destination Pole — Pole Tag photo");
    if (collectedAll === null) missing.push("Cable collection answer");

    if (missing.length > 0) {
      Alert.alert("Incomplete Teardown", `Cannot submit — the following are missing:\n\n• ${missing.join("\n• ")}`);
      return;
    }

    setSubmitting(true);

    let fields: Record<string, string>;
    let photoPaths: Record<string, string>;
    try {
      fields     = await buildFields();
      photoPaths = buildPhotoPaths();
    } catch {
      Alert.alert("Error", "Could not prepare submission. Please try again.");
      setSubmitting(false);
      return;
    }

    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    for (const [fieldName, uri] of Object.entries(photoPaths)) {
      form.append(fieldName, { uri, name: `${fieldName}.jpg`, type: "image/jpeg" } as any);
    }

    // Navigate immediately — don't make the user wait for upload
    router.replace({
      pathname: "/teardown/teardown-complete" as any,
      params: {
        from_pole_code:   params.pole_code     ?? "",
        from_pole_name:   params.pole_name     ?? "",
        to_pole_code:     params.to_pole_code  ?? "",
        to_pole_name:     params.to_pole_name  ?? "",
        node_id:          params.node_id       ?? "",
        project_id:       params.project_id    ?? "",
        project_name:     params.project_name  ?? "",
        accent:           params.accent        ?? "",
        span_id:          params.span_id       ?? "",
        submitted_at:     new Date().toISOString(),
        cable_collected:  collectedAll ? "1" : "0",
        expected_cable:   String(adjExpected),
        length_meters:    String(lengthMeters),
        node_count:       String(collectedNode),
        amplifier_count:  String(collectedAmp),
        extender_count:   String(collectedExt),
        tsc_count:        String(collectedTsc),
        ps_count:         String(collectedPs),
        ps_housing_count: String(collectedPsh),
      },
    });

    // Submit in background — component unmounts after replace, don't touch state
    api.post("/teardown-logs", form)
      .then(async () => {
        await cacheSet("teardown_logs", null);
        await FileSystem.deleteAsync(draftDir,     { idempotent: true }).catch(() => {});
        await FileSystem.deleteAsync(poleDraftDir, { idempotent: true }).catch(() => {});
      })
      .catch(async (e: any) => {
        const status = e?.response?.status;
        if (status === 409 || status === 422) return; // already submitted or bad data — skip queue
        await queuePush({ fields, photoPaths, draftDir, poleDraftDir }).catch(() => {});
      });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const spanLabel = params.span_code || `Span #${params.span_id}`;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.root} edges={["top"]}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[0]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── [0] Sticky header ── */}
          <View style={styles.stickyHeader}>
            <Pressable onPress={() => (step > 0 ? setStep(step - 1) : router.back())} style={{ marginBottom: 8, alignSelf: "flex-start" }}>
              <Text style={{ color: "#0d47c9", fontSize: 13, fontWeight: "700" }}>
                ← {step > 0 ? "Back" : "Cancel"}
              </Text>
            </Pressable>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#111827" }} numberOfLines={1}>Teardown</Text>
                <Text style={{ fontSize: 11, color: "#6b7280" }} numberOfLines={1}>
                  {spanLabel} · {params.project_name}
                </Text>
              </View>
              <View style={{ backgroundColor: "#fff", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: "#0d47c9", fontSize: 11, fontWeight: "800" }}>
                  Step {step + 1}/{STEPS.length}
                </Text>
              </View>
            </View>

            {/* Step dots */}
            <View style={styles.stepDotsBar}>
              {STEPS.map((_, i) => (
                <StepDot key={i} index={i} current={step} />
              ))}
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 120 }}>
            {/* From → To header */}
            <Animated.View
              entering={FadeInRight.duration(300)}
              style={styles.fromToCard}
            >
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ color: "#9ca3af", fontSize: 9, fontWeight: "700", textTransform: "uppercase", marginBottom: 2 }}>From</Text>
                <Text style={{ color: "#0d47c9", fontSize: 11, fontWeight: "900", textAlign: "center" }} numberOfLines={2}>
                  {params.pole_name || params.pole_code || "—"}
                </Text>
              </View>
              <Text style={{ color: "#9ca3af", fontSize: 18, fontWeight: "900", paddingHorizontal: 12 }}>→</Text>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ color: "#9ca3af", fontSize: 9, fontWeight: "700", textTransform: "uppercase", marginBottom: 2 }}>To</Text>
                <Text style={{ color: "#374151", fontSize: 11, fontWeight: "900", textAlign: "center" }} numberOfLines={2}>
                  {params.to_pole_name || params.to_pole_code || "—"}
                </Text>
              </View>
            </Animated.View>

            {/* ── STEP 0: Cable ── */}
            {step === 0 && (
              <Animated.View entering={FadeInRight.duration(300)}>
                <View style={[styles.stepCard, { elevation: 3 }]}>
                  <View style={{ height: 4, backgroundColor: "#f59e0b" }} />
                  <View style={{ padding: 20 }}>
                    <Text style={styles.cardTitle}>Cable Collection</Text>
                    <Text style={styles.cardSub}>Expected: {expectedCable}m</Text>

                    <Text style={{ color: "#374151", fontSize: 13, fontWeight: "600", marginBottom: 12 }}>
                      Were all cables collected?
                    </Text>

                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                      <TouchableOpacity
                        onPress={() => setCollectedAll(true)}
                        style={[styles.yesNoBtn, collectedAll === true && { backgroundColor: "#10b981" }]}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 22 }}>✅</Text>
                        <Text style={[styles.yesNoBtnText, collectedAll === true && { color: "#fff" }]}>
                          Yes, all collected
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setCollectedAll(false)}
                        style={[styles.yesNoBtn, collectedAll === false && { backgroundColor: "#ef4444" }]}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 22 }}>⚠️</Text>
                        <Text style={[styles.yesNoBtnText, collectedAll === false && { color: "#fff" }]}>
                          Not all collected
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {collectedAll === false && (
                      <Animated.View entering={FadeInDown.duration(250)}>
                        <View style={{ borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 16 }}>

                          {/* Runs discrepancy */}
                          {declaredRuns > 1 && (
                            <View style={styles.warningBox}>
                              <Text style={styles.warningText}>
                                ⚠️  Declared runs: {declaredRuns} — How many did you find?
                              </Text>
                              <View style={{ flexDirection: "row", gap: 8 }}>
                                {Array.from({ length: declaredRuns }, (_, i) => i + 1).map((n) => (
                                  <TouchableOpacity
                                    key={n}
                                    onPress={() => setActualRuns(n)}
                                    style={[styles.runBtn, actualRuns === n && { backgroundColor: "#0d47c9", borderColor: "#0d47c9" }]}
                                  >
                                    <Text style={[styles.runBtnNum, actualRuns === n && { color: "#fff" }]}>{n}</Text>
                                    <Text style={[styles.runBtnLabel, actualRuns === n && { color: "#bfdbfe" }]}>
                                      {n === 1 ? "run" : "runs"}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                              {actualRuns < declaredRuns && (
                                <Text style={{ fontSize: 10, color: "#b45309", fontWeight: "600", marginTop: 8 }}>
                                  Adjusted expected: {lengthMeters * actualRuns}m  (was {expectedCable}m)
                                </Text>
                              )}
                            </View>
                          )}

                          <Text style={styles.fieldLabel}>Recovered cable (meters)</Text>
                          <TextInput
                            onChangeText={setRecoveredCable}
                            value={recoveredCable}
                            keyboardType="numeric"
                            placeholder={`Max ${adjExpected}m`}
                            placeholderTextColor="#9ca3af"
                            style={styles.textInput}
                          />

                          {recoveredCable !== "" && (() => {
                            const rec   = Math.min(recoveredNum, adjExpected);
                            const unrec = Math.max(0, adjExpected - rec);
                            return (
                              <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                                {[
                                  { label: "Expected",    value: `${adjExpected}m`, color: "#6366f1" },
                                  { label: "Recovered",   value: `${rec}m`,         color: "#10b981" },
                                  { label: "Unrecovered", value: `${unrec}m`,        color: "#ef4444" },
                                ].map((item) => (
                                  <View key={item.label} style={styles.miniStatBox}>
                                    <Text style={styles.miniStatLabel}>{item.label}</Text>
                                    <Text style={[styles.miniStatValue, { color: item.color }]}>{item.value}</Text>
                                  </View>
                                ))}
                              </View>
                            );
                          })()}

                          <Text style={styles.fieldLabel}>Reason</Text>
                          <TextInput
                            multiline
                            onChangeText={setCableReason}
                            value={cableReason}
                            placeholder="Describe why cable was not fully collected..."
                            placeholderTextColor="#9ca3af"
                            style={[styles.textInput, { minHeight: 80, textAlignVertical: "top" }]}
                          />

                          <Text style={[styles.fieldLabel, { textTransform: "uppercase", fontSize: 10 }]}>
                            Photo (optional)
                          </Text>
                          <TouchableOpacity
                            onPress={captureCablePhoto}
                            activeOpacity={0.8}
                            style={{
                              borderRadius: 16, overflow: "hidden",
                              borderWidth: 2,
                              borderColor: cablePhoto ? "#0d47c9" : "#e5e7eb",
                              borderStyle: cablePhoto ? "solid" : "dashed",
                              backgroundColor: cablePhoto ? "#f0f4ff" : "#f9fafb",
                              aspectRatio: 4 / 3, alignItems: "center", justifyContent: "center",
                            }}
                          >
                            {cablePhoto ? (
                              <Image source={{ uri: cablePhoto.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                            ) : (
                              <View style={{ alignItems: "center" }}>
                                <Text style={{ fontSize: 28 }}>📷</Text>
                                <Text style={{ color: "#9ca3af", fontSize: 11, fontWeight: "600", marginTop: 6 }}>Cable Photo</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>
                      </Animated.View>
                    )}
                  </View>
                </View>
              </Animated.View>
            )}

            {/* ── STEP 1: Components ── */}
            {step === 1 && (
              <Animated.View entering={FadeInRight.duration(300)}>
                {/* Counters */}
                <View style={[styles.stepCard, { elevation: 3 }]}>
                  <View style={{ height: 4, backgroundColor: "#10b981" }} />
                  <View style={{ padding: 20 }}>
                    <Text style={styles.cardTitle}>Component Recovery</Text>
                    <Text style={styles.cardSub}>Enter number of items collected</Text>

                    <View style={{ flexDirection: "row", marginBottom: 12 }}>
                      <Counter label="Node"      value={collectedNode} expected={Number(params.expected_node) || 0}      onChange={setCollectedNode} />
                      <Counter label="Amplifier" value={collectedAmp}  expected={Number(params.expected_amplifier) || 0} onChange={setCollectedAmp} />
                    </View>
                    <View style={{ flexDirection: "row", marginBottom: 12 }}>
                      <Counter label="Extender"  value={collectedExt} expected={Number(params.expected_extender) || 0} onChange={setCollectedExt} />
                      <Counter label="TSC"        value={collectedTsc} expected={Number(params.expected_tsc) || 0}      onChange={setCollectedTsc} />
                    </View>
                    <View style={{ flexDirection: "row" }}>
                      <Counter label="Power Supply" value={collectedPs}  expected={Number(params.expected_powersupply) || 0}         onChange={setCollectedPs} />
                      <Counter label="PS Housing"   value={collectedPsh} expected={Number(params.expected_powersupply_housing) || 0}  onChange={setCollectedPsh} />
                    </View>
                  </View>
                </View>

                {/* Photo review */}
                <View style={[styles.stepCard, { elevation: 2 }]}>
                  <View style={{ padding: 20 }}>
                    <Text style={[styles.cardTitle, { marginBottom: 4 }]}>Photo Review</Text>
                    <Text style={styles.cardSub}>All photos captured before submission</Text>

                    {[
                      { label: "From Before",    photo: photos.from_before,  required: true  },
                      { label: "From After",     photo: photos.from_after,   required: false },
                      { label: "From Tag",       photo: photos.from_tag,     required: true  },
                      { label: "To Before",      photo: photos.to_before,    required: true  },
                      { label: "To After",       photo: photos.to_after,     required: true  },
                      { label: "To Tag",         photo: photos.to_tag,       required: true  },
                      ...(!collectedAll && cablePhoto ? [{ label: "Cable Photo", photo: cablePhoto, required: false }] : []),
                    ].map((item) => (
                      <View key={item.label} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 }}>
                        <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: "#f3f4f6", overflow: "hidden" }}>
                          {item.photo
                            ? <Image source={{ uri: item.photo.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                            : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 18 }}>📷</Text></View>
                          }
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#111827" }}>{item.label}</Text>
                          <Text style={{ fontSize: 10, fontWeight: "600", color: item.photo ? "#10b981" : item.required ? "#ef4444" : "#f59e0b" }}>
                            {item.photo ? "✓ Captured" : item.required ? "✗ Missing — required" : "— Optional"}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Submission summary */}
                <View style={[styles.stepCard, { elevation: 2 }]}>
                  <View style={{ padding: 20 }}>
                    <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Submission Summary</Text>
                    {[
                      { label: "From Pole — Before",    ok: !!photos.from_before, required: true  },
                      { label: "From Pole — Pole Tag",  ok: !!photos.from_tag,    required: true  },
                      { label: "Dest. Pole — Before",   ok: !!photos.to_before,   required: true  },
                      { label: "Dest. Pole — After",    ok: !!photos.to_after,    required: true  },
                      { label: "Dest. Pole — Pole Tag", ok: !!photos.to_tag,      required: true  },
                      { label: "Cable Collection",      ok: collectedAll !== null, required: true  },
                    ].map((row) => (
                      <View key={row.label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ fontSize: 12, color: "#6b7280" }}>{row.label}</Text>
                          {row.required && !row.ok && (
                            <View style={{ backgroundColor: "#fee2e2", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                              <Text style={{ fontSize: 8, color: "#dc2626", fontWeight: "800" }}>REQUIRED</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color: row.ok ? "#10b981" : row.required ? "#ef4444" : "#f59e0b", fontWeight: "700", fontSize: 12 }}>
                          {row.ok ? "✓ Ready" : row.required ? "✗ Missing" : "— Optional"}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Animated.View>
            )}
          </View>
        </ScrollView>

        {/* ── Bottom CTA ── */}
        <View style={styles.cta}>
          <TouchableOpacity
            onPress={goNext}
            disabled={!canProceed() || submitting}
            activeOpacity={0.85}
            style={[styles.ctaBtn, { backgroundColor: canProceed() && !submitting ? "#0d47c9" : "#e5e7eb" }]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.ctaBtnText, { color: canProceed() ? "#fff" : "#9ca3af" }]}>
                {step === STEPS.length - 1
                  ? "Submit Teardown"
                  : `Next: ${STEPS[step + 1].label}  →`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f3f4f6" },

  stickyHeader: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },

  stepDotsBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },

  fromToCard: {
    backgroundColor: "#fff", borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: "row", alignItems: "center",
    marginBottom: 14, marginTop: 4,
    elevation: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },

  stepCard: {
    backgroundColor: "#fff", borderRadius: 24,
    overflow: "hidden", marginBottom: 14,
    shadowColor: "#000", shadowOpacity: 0.07,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },

  cardTitle: { fontSize: 15, fontWeight: "900", color: "#111827", marginBottom: 4 },
  cardSub:   { fontSize: 11, color: "#9ca3af", marginBottom: 16 },

  yesNoBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 16,
    backgroundColor: "#f3f4f6", alignItems: "center", gap: 4,
  },
  yesNoBtnText: { color: "#374151", fontWeight: "700", fontSize: 12 },

  warningBox: {
    backgroundColor: "#fef9c3", borderRadius: 14, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: "#fde68a",
  },
  warningText: { fontSize: 11, fontWeight: "800", color: "#92400e", marginBottom: 10 },

  runBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center",
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb",
  },
  runBtnNum:   { fontSize: 18, fontWeight: "900", color: "#374151" },
  runBtnLabel: { fontSize: 9, fontWeight: "700", color: "#9ca3af", marginTop: 2 },

  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 6, marginTop: 4 },

  textInput: {
    backgroundColor: "#f8f9ff", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb",
    fontSize: 14, color: "#111827", fontWeight: "600",
  },

  miniStatBox: {
    flex: 1, backgroundColor: "#f8f9ff", borderRadius: 12,
    padding: 10, alignItems: "center",
  },
  miniStatLabel: { fontSize: 9, color: "#9ca3af", fontWeight: "700", textTransform: "uppercase", marginBottom: 3 },
  miniStatValue: { fontSize: 13, fontWeight: "900" },

  cta: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", paddingHorizontal: 20,
    paddingTop: 14, paddingBottom: 28,
    elevation: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 12,
  },
  ctaBtn:     { borderRadius: 18, paddingVertical: 16, alignItems: "center" },
  ctaBtnText: { fontWeight: "800", fontSize: 15 },
});
