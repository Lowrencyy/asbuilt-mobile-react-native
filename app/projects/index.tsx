import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ProjectStatus = "In Progress" | "Pending" | "Ongoing" | "Priority" | "Queued";

type Project = {
  id: string;
  title: string;
  desc: string;
  status: ProjectStatus;
  assignee: string;
  due: string;
  progress: number;
};

const projects: Project[] = [
  {
    id: "1",
    title: "Project Alpha",
    desc: "Lineman helper task board and assignment overview.",
    status: "In Progress",
    assignee: "Mark Laurence",
    due: "Mar 28",
    progress: 72,
  },
  {
    id: "2",
    title: "Project Beta",
    desc: "Inspection workflow, image capture, and reports.",
    status: "Pending",
    assignee: "Aira Santos",
    due: "Apr 02",
    progress: 34,
  },
  {
    id: "3",
    title: "Project Gamma",
    desc: "Maintenance tracking and equipment monitoring.",
    status: "Ongoing",
    assignee: "Joshua Cruz",
    due: "Mar 30",
    progress: 58,
  },
  {
    id: "4",
    title: "Project Delta",
    desc: "High-priority assigned field tasks and escalations.",
    status: "Priority",
    assignee: "Nico Perez",
    due: "Mar 25",
    progress: 89,
  },
  {
    id: "5",
    title: "Project Epsilon",
    desc: "Deployment queue for the next field release cycle.",
    status: "Queued",
    assignee: "Claire Tan",
    due: "Apr 05",
    progress: 18,
  },
  {
    id: "6",
    title: "Project Zeta",
    desc: "Additional tasks prepared for validation and testing.",
    status: "Queued",
    assignee: "Kevin Ramos",
    due: "Apr 08",
    progress: 24,
  },
];

function getStatusColor(status: ProjectStatus) {
  switch (status) {
    case "Priority":
      return { header: "#7C3AED", pillBg: "#FFE4E6", pillText: "#E11D48" };
    case "In Progress":
      return { header: "#2563EB", pillBg: "#E0E7FF", pillText: "#4338CA" };
    case "Ongoing":
      return { header: "#0EA5E9", pillBg: "#E0F2FE", pillText: "#0369A1" };
    case "Pending":
      return { header: "#F59E0B", pillBg: "#FEF3C7", pillText: "#B45309" };
    case "Queued":
    default:
      return { header: "#64748B", pillBg: "#E2E8F0", pillText: "#475569" };
  }
}

const FLOAT_ABOVE = 30;
const HEADER_H = 110;
const OVERLAP = HEADER_H - FLOAT_ABOVE;

function ProjectCard({ item }: { item: Project }) {
  const colors = getStatusColor(item.status);

  return (
    <View style={styles.cardOuter}>
      {/* Floating colored header — absolute, sticks FLOAT_ABOVE px above the card */}
      <View
        style={[
          styles.cardHeader,
          { backgroundColor: colors.header },
        ]}
      />

      {/* White card body */}
      <View style={styles.card}>
        <View style={styles.projectInfo}>
          {/* Title row */}
          <View style={styles.titleRow}>
            <Text style={styles.projectTitle}>{item.title}</Text>
            <View style={[styles.tag, { backgroundColor: colors.pillBg }]}>
              <Text style={[styles.tagText, { color: colors.pillText }]}>
                {item.status}
              </Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.lighter}>{item.desc}</Text>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{item.assignee}</Text>
            <Text style={styles.metaText}>Due: {item.due}</Text>
          </View>

          {/* Progress */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${item.progress}%` as any,
                  backgroundColor: colors.header,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressLabel, { color: colors.header }]}>
            {item.progress}% complete
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function ProjectsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.screenTitle}>Project Dashboard</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProjectCard item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F8FB" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  backBtn: { width: 60 },
  backText: { fontSize: 14, color: "#0A5C3B", fontWeight: "700" },
  screenTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },

  listContent: {
    paddingHorizontal: 20,
    paddingTop: FLOAT_ABOVE + 16,
    paddingBottom: 40,
  },

  // Each card wrapper needs paddingTop so the absolute header can float above
  cardOuter: {
    paddingTop: FLOAT_ABOVE,
    marginBottom: 28,
  },

  cardHeader: {
    position: "absolute",
    top: 0,
    left: 10,
    right: 10,
    height: HEADER_H,
    borderRadius: 14,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    zIndex: 2,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingTop: OVERLAP,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 1,
  },

  projectInfo: {
    padding: 16,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  projectTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    flex: 1,
    marginRight: 10,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: { fontSize: 11, fontWeight: "700" },

  lighter: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 19,
    marginBottom: 14,
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metaText: { fontSize: 12, color: "#9CA3AF", fontWeight: "600" },

  progressTrack: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: { height: "100%", borderRadius: 3 },
  progressLabel: { fontSize: 11, fontWeight: "700", textAlign: "right" },
});
