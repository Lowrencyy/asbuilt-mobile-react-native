/**
 * Admin — Subcon Detail
 * /admin/subcons/:id
 *
 * Features:
 *  • View subcon info
 *  • Add / view Teams under this subcon
 *  • Assign employees to a team
 */
import api from "@/lib/api";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Subcon = { id: number; name: string; email?: string; contact?: string };
type Team   = { id: number; name: string; subcon_id: number };
type Employee = { id: number; name: string; role?: string; team_id?: number | null };

export default function SubconDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [subcon, setSubcon]       = useState<Subcon | null>(null);
  const [teams, setTeams]         = useState<Team[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loadingSub, setLoadingSub]   = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingEmps, setLoadingEmps] = useState(true);

  // ── Add Team modal ──
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [teamName, setTeamName]           = useState("");
  const [savingTeam, setSavingTeam]       = useState(false);

  // ── Assign Employee modal ──
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetTeam, setTargetTeam]           = useState<Team | null>(null);
  const [savingAssign, setSavingAssign]       = useState(false);

  // ── Fetch ──
  useEffect(() => {
    api.get(`/subcons/${id}`)
      .then(({ data }) => setSubcon(data?.data ?? data))
      .catch(() => {})
      .finally(() => setLoadingSub(false));

    api.get(`/subcons/${id}/teams`)
      .then(({ data }) => {
        const raw = Array.isArray(data) ? data : (data?.data ?? []);
        setTeams(raw);
      })
      .catch(() => {})
      .finally(() => setLoadingTeams(false));

    api.get(`/subcons/${id}/employees`)
      .then(({ data }) => {
        const raw = Array.isArray(data) ? data : (data?.data ?? []);
        setEmployees(raw);
      })
      .catch(() => {})
      .finally(() => setLoadingEmps(false));
  }, [id]);

  // ── Add Team ──
  async function handleAddTeam() {
    if (!teamName.trim()) return;
    setSavingTeam(true);
    try {
      const { data } = await api.post("/teams", { name: teamName.trim(), subcon_id: Number(id) });
      const newTeam: Team = data?.data ?? data;
      setTeams((prev) => [...prev, newTeam]);
      setTeamName("");
      setTeamModalOpen(false);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to create team.");
    } finally {
      setSavingTeam(false);
    }
  }

  // ── Assign employee to team ──
  async function handleAssign(employee: Employee) {
    if (!targetTeam) return;
    setSavingAssign(true);
    try {
      await api.post(`/teams/${targetTeam.id}/employees`, { employee_id: employee.id });
      // update local state
      setEmployees((prev) =>
        prev.map((e) => (e.id === employee.id ? { ...e, team_id: targetTeam.id } : e)),
      );
      Alert.alert("Assigned", `${employee.name} → ${targetTeam.name}`);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to assign employee.");
    } finally {
      setSavingAssign(false);
    }
  }

  function openAssignModal(team: Team) {
    setTargetTeam(team);
    setAssignModalOpen(true);
  }

  const unassignedEmployees = employees.filter((e) => !e.team_id);

  return (
    <SafeAreaView style={s.root}>
      {/* ── Nav ── */}
      <View style={s.nav}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <Text style={s.navTitle}>Subcon Admin</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        {/* ── Subcon info card ── */}
        <View style={s.infoCard}>
          {loadingSub ? (
            <ActivityIndicator color="#0A5C3B" />
          ) : (
            <>
              <Text style={s.infoName}>{subcon?.name ?? `Subcon #${id}`}</Text>
              {subcon?.email   && <Text style={s.infoMeta}>📧 {subcon.email}</Text>}
              {subcon?.contact && <Text style={s.infoMeta}>📞 {subcon.contact}</Text>}
            </>
          )}
        </View>

        {/* ── Teams ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Teams</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setTeamModalOpen(true)}>
            <Text style={s.addBtnText}>+ Add Team</Text>
          </TouchableOpacity>
        </View>

        {loadingTeams ? (
          <ActivityIndicator color="#0A5C3B" style={{ marginVertical: 16 }} />
        ) : teams.length === 0 ? (
          <Text style={s.emptyText}>No teams yet. Add one above.</Text>
        ) : (
          teams.map((team) => {
            const members = employees.filter((e) => e.team_id === team.id);
            return (
              <View key={team.id} style={s.teamCard}>
                <View style={s.teamHeader}>
                  <Text style={s.teamName}>{team.name}</Text>
                  <TouchableOpacity
                    style={s.assignBtn}
                    onPress={() => openAssignModal(team)}
                  >
                    <Text style={s.assignBtnText}>+ Employee</Text>
                  </TouchableOpacity>
                </View>

                {members.length === 0 ? (
                  <Text style={s.noMembersText}>No members yet.</Text>
                ) : (
                  members.map((emp) => (
                    <View key={emp.id} style={s.memberRow}>
                      <View style={s.memberAvatar}>
                        <Text style={s.memberAvatarText}>
                          {emp.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={s.memberName}>{emp.name}</Text>
                        {emp.role && <Text style={s.memberRole}>{emp.role}</Text>}
                      </View>
                    </View>
                  ))
                )}
              </View>
            );
          })
        )}

        {/* ── Unassigned employees ── */}
        {!loadingEmps && unassignedEmployees.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { marginTop: 24, marginBottom: 10 }]}>
              Unassigned Employees ({unassignedEmployees.length})
            </Text>
            {unassignedEmployees.map((emp) => (
              <View key={emp.id} style={s.unassignedRow}>
                <View style={s.memberAvatar}>
                  <Text style={s.memberAvatarText}>{emp.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.memberName}>{emp.name}</Text>
                  {emp.role && <Text style={s.memberRole}>{emp.role}</Text>}
                </View>
                <Text style={s.unassignedBadge}>Unassigned</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* ── Add Team Modal ── */}
      <Modal visible={teamModalOpen} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Add New Team</Text>
            <TextInput
              style={s.input}
              placeholder="Team name"
              value={teamName}
              onChangeText={setTeamName}
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => { setTeamModalOpen(false); setTeamName(""); }}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, (!teamName.trim() || savingTeam) && s.saveBtnDisabled]}
                onPress={handleAddTeam}
                disabled={!teamName.trim() || savingTeam}
              >
                {savingTeam
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.saveBtnText}>Create Team</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Assign Employee Modal ── */}
      <Modal visible={assignModalOpen} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Assign to "{targetTeam?.name}"</Text>
            {unassignedEmployees.length === 0 ? (
              <Text style={s.emptyText}>No unassigned employees available.</Text>
            ) : (
              <FlatList
                data={unassignedEmployees}
                keyExtractor={(e) => String(e.id)}
                style={{ maxHeight: 260 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={s.empPickerRow}
                    onPress={() => handleAssign(item)}
                    disabled={savingAssign}
                  >
                    <View style={s.memberAvatar}>
                      <Text style={s.memberAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.memberName}>{item.name}</Text>
                      {item.role && <Text style={s.memberRole}>{item.role}</Text>}
                    </View>
                    <Text style={s.assignArrow}>+</Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              style={[s.cancelBtn, { marginTop: 12 }]}
              onPress={() => setAssignModalOpen(false)}
            >
              <Text style={s.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F6F8FB" },
  nav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EEF2F7",
  },
  backBtn: { width: 70 },
  backText: { fontSize: 14, color: "#0A5C3B", fontWeight: "700" },
  navTitle: { fontSize: 17, fontWeight: "800", color: "#111827" },

  body: { padding: 20, paddingBottom: 60 },

  infoCard: {
    backgroundColor: "#0A5C3B", borderRadius: 18,
    padding: 20, marginBottom: 24,
  },
  infoName: { fontSize: 22, fontWeight: "900", color: "#fff", marginBottom: 6 },
  infoMeta: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 },

  sectionHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  addBtn: {
    backgroundColor: "#0A5C3B", paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 10,
  },
  addBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  emptyText: { fontSize: 13, color: "#9CA3AF", fontWeight: "600", marginBottom: 12 },

  teamCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    marginBottom: 14, shadowColor: "#000",
    shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  teamHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
  },
  teamName: { fontSize: 15, fontWeight: "800", color: "#111827" },
  assignBtn: {
    backgroundColor: "#EEF9F3", paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 8,
  },
  assignBtnText: { fontSize: 12, fontWeight: "700", color: "#0A5C3B" },

  noMembersText: { fontSize: 12, color: "#9CA3AF", fontStyle: "italic" },

  memberRow: {
    flexDirection: "row", alignItems: "center",
    gap: 10, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: "#F3F4F6",
  },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#0A5C3B", alignItems: "center", justifyContent: "center",
  },
  memberAvatarText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  memberName: { fontSize: 13, fontWeight: "700", color: "#111827" },
  memberRole: { fontSize: 11, color: "#9CA3AF" },

  unassignedRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 12, padding: 12,
    marginBottom: 8,
  },
  unassignedBadge: {
    fontSize: 10, fontWeight: "700", color: "#9CA3AF",
    backgroundColor: "#F3F4F6", paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 999,
  },

  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  modal: {
    backgroundColor: "#fff", borderRadius: 20,
    padding: 24, width: "88%", maxWidth: 420,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 16 },
  input: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, marginBottom: 18,
  },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: "#E5E7EB",
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "700", color: "#6B7280" },
  saveBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: "#0A5C3B", alignItems: "center",
  },
  saveBtnDisabled: { backgroundColor: "#9CA3AF" },
  saveBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  empPickerRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  assignArrow: { fontSize: 20, fontWeight: "700", color: "#0A5C3B" },
});
