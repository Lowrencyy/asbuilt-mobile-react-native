import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import * as FileSystem from "expo-file-system/legacy";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

function sanitize(s?: string) {
  return (s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "_");
}

export default function SelectPairScreen() {
  const { pole_id, pole_code, pole_name, node_id, project_id, project_name, accent } =
    useLocalSearchParams<{
      pole_id: string;
      pole_code: string;
      pole_name: string;
      node_id: string;
      project_id: string;
      project_name: string;
      accent: string;
    }>();

  const accentColor = accent || "#334155";

  const [spans, setSpans] = useState<Span[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "empty">(
    "loading",
  );

  // Copy from_pole photos from pole_drafts → teardown_drafts on mount
  useEffect(() => {
    if (!pole_code || !node_id) return;
    (async () => {
      const projFolder = sanitize(project_name);
      const poleSanitized = sanitize(pole_code);
      const srcDir = `${FileSystem.documentDirectory}pole_drafts/${projFolder}/${node_id}/${pole_code}/`;
      const destDir = `${FileSystem.documentDirectory}teardown_drafts/${projFolder}/${node_id}/${pole_code}/`;

      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });

      const srcFiles = [
        {
          src: `pole_${pole_code}_before.jpg`,
          dest: `${poleSanitized}_before.jpg`,
        },
        {
          src: `pole_${pole_code}_after.jpg`,
          dest: `${poleSanitized}_after.jpg`,
        },
        {
          src: `pole_${pole_code}_poletag.jpg`,
          dest: `${poleSanitized}_poletag.jpg`,
        },
      ];

      let beforeCopied = false;
      for (const f of srcFiles) {
        const srcPath = srcDir + f.src;
        const destPath = destDir + f.dest;
        const info = await FileSystem.getInfoAsync(srcPath);
        if (info.exists) {
          const destInfo = await FileSystem.getInfoAsync(destPath);
          if (!destInfo.exists) {
            await FileSystem.copyAsync({ from: srcPath, to: destPath }).catch(
              () => {},
            );
          }
          if (f.dest.includes("_before")) beforeCopied = true;
        }
      }

      if (!beforeCopied) {
        // Check if already copied in a previous session
        const destInfo = await FileSystem.getInfoAsync(
          destDir + `${poleSanitized}_before.jpg`,
        );
        if (!destInfo.exists) {
          Alert.alert(
            "Photos not found",
            "Starting pole photos not found. Please go back and retake them.",
            [{ text: "Go Back", onPress: () => router.back() }],
          );
          return;
        }
      }
    })();
  }, [pole_code]);

  // Fetch spans (stale-while-revalidate)
  useEffect(() => {
    if (!pole_id) return;
    setStatus("loading");
    const CACHE_KEY = `spans_pole_${pole_id}`;

    // Show cached spans immediately
    cacheGet<Span[]>(CACHE_KEY).then((cached) => {
      if (cached?.length) {
        if (cached.length === 1) { navigateToKabila(cached[0]); return; }
        setSpans(cached);
        setStatus("ok");
      }
    });

    // Fetch fresh in background
    api
      .get(`/poles/${pole_id}/spans`)
      .then(({ data }) => {
        const list: Span[] = Array.isArray(data) ? data : (data?.data ?? []);
        cacheSet(CACHE_KEY, list);
        if (list.length === 0) { setStatus("empty"); return; }
        if (list.length === 1) { navigateToKabila(list[0]); return; }
        setSpans(list);
        setStatus("ok");
      })
      .catch(() => {
        cacheGet<Span[]>(CACHE_KEY).then((cached) => {
          if (!cached?.length) setStatus("error");
        });
      });
  }, [pole_code]);

  function navigateToKabila(span: Span) {
    // If the current pole is actually the to_pole of this span (vice versa),
    // flip direction so the teardown always goes from_pole → to_pole
    const isReversed = span.from_pole && span.to_pole.pole_code === pole_code;

    const actualFromCode = isReversed ? span.from_pole.pole_code : pole_code;
    const actualFromName = isReversed
      ? (span.from_pole.pole_name ?? span.from_pole.pole_code)
      : (pole_name ?? pole_code);
    const actualToId = isReversed
      ? String(span.from_pole.id)
      : String(span.to_pole.id);
    const actualToCode = isReversed
      ? span.from_pole.pole_code
      : span.to_pole.pole_code;
    const actualToName = isReversed
      ? (span.from_pole.pole_name ?? span.from_pole.pole_code)
      : (span.to_pole.pole_name ?? span.to_pole.pole_code);

    router.replace({
      pathname: "/teardown/destination-pole" as any,
      params: {
        pole_code: actualFromCode,
        pole_name: actualFromName,
        node_id,
        project_id,
        project_name,
        accent,
        span_id: String(span.id),
        span_code: span.pole_span_code ?? "",
        to_pole_id: actualToId,
        to_pole_code: actualToCode,
        to_pole_name: actualToName,
        expected_cable: String(span.expected_cable),
        length_meters: String(span.length_meters),
        declared_runs: String(span.runs),
        expected_node: String(span.expected_node),
        expected_amplifier: String(span.expected_amplifier),
        expected_extender: String(span.expected_extender),
        expected_tsc: String(span.expected_tsc),
        expected_powersupply: String(span.expected_powersupply),
        expected_powersupply_housing: String(span.expected_powersupply_housing),
      },
    });
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Select Span</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {pole_name || pole_code}
            </Text>
          </View>
        </View>

        {status === "loading" && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={accentColor} />
            <Text style={styles.centerText}>Loading spans…</Text>
          </View>
        )}

        {status === "error" && (
          <View style={styles.center}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.centerText}>Could not load spans.</Text>
            <Text style={styles.centerSub}>
              Check your connection and try again.
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: accentColor }]}
              onPress={() => {
                setStatus("loading");
                const CACHE_KEY = `spans_pole_${pole_id}`;
                api
                  .get(`/poles/${pole_id}/spans`)
                  .then(({ data }) => {
                    const list: Span[] = Array.isArray(data)
                      ? data
                      : (data?.data ?? []);
                    cacheSet(CACHE_KEY, list);
                    if (list.length === 0) { setStatus("empty"); return; }
                    if (list.length === 1) { navigateToKabila(list[0]); return; }
                    setSpans(list);
                    setStatus("ok");
                  })
                  .catch(() => setStatus("error"));
              }}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === "empty" && (
          <View style={styles.center}>
            <Text style={styles.errorIcon}>🔌</Text>
            <Text style={styles.centerText}>No spans found for this pole.</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.retryText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === "ok" && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.questionWrap}>
              <Text style={styles.question}>Select Next Pole</Text>
              <Text style={styles.questionSub}>
                Tap the pole tag you saw on the other end of the span.
              </Text>
            </View>

            <View style={styles.poleGrid}>
              {spans.map((item) => {
                // For incoming spans (current pole is the to_pole), show from_pole as the "other end"
                const isReversed =
                  item.from_pole && item.to_pole.pole_code === pole_code;
                const displayPole = isReversed ? item.from_pole : item.to_pole;
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.85}
                    onPress={() => navigateToKabila(item)}
                    style={[styles.poleBtn, { borderColor: accentColor }]}
                  >
                    <View
                      style={[
                        styles.poleBtnAccent,
                        { backgroundColor: accentColor },
                      ]}
                    />
                    <View style={styles.poleBtnBody}>
                      <Text
                        style={[styles.poleBtnCode, { color: accentColor }]}
                        numberOfLines={2}
                      >
                        {displayPole.pole_code}
                      </Text>
                      {item.pole_span_code ? (
                        <Text style={styles.poleBtnSpan} numberOfLines={1}>
                          {item.pole_span_code}
                        </Text>
                      ) : null}
                      <Text style={styles.poleBtnCable}>
                        {item.expected_cable}m expected
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.poleBtnFooter,
                        { borderTopColor: `${accentColor}22` },
                      ]}
                    >
                      <Text
                        style={[styles.poleBtnAction, { color: accentColor }]}
                      >
                        Select Next Pole ›
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F6F8FB" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  backIcon: {
    fontSize: 28,
    color: "#111827",
    fontWeight: "600",
    marginTop: -2,
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#111827" },
  headerSub: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 2,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  errorIcon: { fontSize: 40 },
  centerText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    textAlign: "center",
  },
  centerSub: { fontSize: 13, color: "#9CA3AF", textAlign: "center" },
  retryBtn: {
    marginTop: 8,
    backgroundColor: "#334155",
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  questionWrap: { paddingHorizontal: 20, paddingBottom: 16 },
  question: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 4,
  },
  questionSub: { fontSize: 13, color: "#6B7280", lineHeight: 18 },

  scrollContent: { paddingBottom: 40 },

  poleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
  },
  poleBtn: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    shadowColor: "#0F172A",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  poleBtnAccent: { height: 4 },
  poleBtnBody: { padding: 14, paddingBottom: 10 },
  poleBtnCode: { fontSize: 18, fontWeight: "900", marginBottom: 4 },
  poleBtnSpan: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: 4,
  },
  poleBtnCable: { fontSize: 11, fontWeight: "600", color: "#6B7280" },
  poleBtnFooter: {
    borderTopWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  poleBtnAction: { fontSize: 12, fontWeight: "800" },
});
