import { Image, StyleSheet, Text, View, Dimensions } from "react-native";

const { width: SW, height: SH } = Dimensions.get("window");
const scale = (size: number) => Math.round((SW / 390) * size);
const vs    = (size: number) => Math.round((SH / 844) * size);

interface Props {
  message?: string;
}

export default function MaintenanceScreen({ message }: Props) {
  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/telco-mainlogo.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.card}>
        <Text style={styles.title}>Under Maintenance</Text>
        <Text style={styles.message}>
          {message ?? "The app is currently under maintenance.\nWe'll be back shortly."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: scale(32),
    gap: vs(32),
  },
  logo: {
    width: scale(220),
    height: vs(130),
  },
  card: {
    alignItems: "center",
    gap: vs(10),
  },
  title: {
    fontSize: scale(20),
    fontWeight: "700",
    color: "#0A5C3B",
    letterSpacing: 0.3,
  },
  message: {
    fontSize: scale(14),
    color: "#555",
    textAlign: "center",
    lineHeight: scale(22),
  },
});
