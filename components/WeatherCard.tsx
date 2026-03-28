import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from "react-native";

// ── Background images ──────────────────────────────────────────────────────────
const BG: Record<string, any> = {
  sunny:        require("@/assets/images/weather-image/sunny.jpg"),
  sunny_sunset: require("@/assets/images/weather-image/sunny-sunset.jpg"),
  partly_cloudy:require("@/assets/images/weather-image/partly_cloudy.jpg"),
  cloudy:       require("@/assets/images/weather-image/cloudy.jpg"),
  foggy:        require("@/assets/images/weather-image/foggy.jpg"),
  foggy_night:  require("@/assets/images/weather-image/foggy-night.jpg"),
  rainy:        require("@/assets/images/weather-image/rainy.jpg"),
  rainy_night:  require("@/assets/images/weather-image/rainy-night.jpg"),
  showers:      require("@/assets/images/weather-image/showers.jpg"),
  thunderstorm: require("@/assets/images/weather-image/thunderstorm.jpg"),
  night:        require("@/assets/images/weather-image/night.jpg"),
};

// ── Weather icons ──────────────────────────────────────────────────────────────
const ICON: Record<string, any> = {
  sunny:          require("@/assets/images/weather-icons/sunny.png"),
  cloudy_sunny:   require("@/assets/images/weather-icons/cloudy-sunny.png"),
  cloudy:         require("@/assets/images/weather-icons/cloudy.png"),
  cloudy_night:   require("@/assets/images/weather-icons/cloudy-night.png"),
  cloudy_thunder: require("@/assets/images/weather-icons/cloudy-thunder.png"),
  rainy:          require("@/assets/images/weather-icons/rainy.png"),
  rainy_thunder:  require("@/assets/images/weather-icons/rainy-thunder.png"),
  night:          require("@/assets/images/weather-icons/night.png"),
  windy_night:    require("@/assets/images/weather-icons/windy-night.png"),
};

type WeatherData = {
  temperature: number;
  humidity: number;
  precipProb: number;
  windSpeed: number;
  uvIndex: number;
  weatherCode: number;
  isDay: boolean;
  city: string;
};

function resolveAssets(code: number, isDay: boolean): { bg: any; icon: any; label: string } {
  // Thunderstorm
  if ([95, 96, 99].includes(code))
    return { bg: BG.thunderstorm, icon: ICON.rainy_thunder, label: "Thunderstorm" };
  // Rain / drizzle showers
  if ([80, 81, 82].includes(code))
    return { bg: BG.showers, icon: ICON.rainy, label: "Rain Showers" };
  // Rain / drizzle
  if (code >= 51 && code <= 67)
    return { bg: isDay ? BG.rainy : BG.rainy_night, icon: ICON.rainy, label: "Rainy" };
  // Snow
  if (code >= 71 && code <= 86)
    return { bg: BG.cloudy, icon: ICON.cloudy, label: "Snow / Sleet" };
  // Fog
  if ([45, 48].includes(code))
    return { bg: isDay ? BG.foggy : BG.foggy_night, icon: isDay ? ICON.cloudy : ICON.cloudy_night, label: "Foggy" };
  // Overcast
  if (code === 3)
    return { bg: BG.cloudy, icon: isDay ? ICON.cloudy : ICON.cloudy_night, label: "Overcast" };
  // Partly cloudy
  if (code === 2)
    return { bg: BG.partly_cloudy, icon: isDay ? ICON.cloudy_sunny : ICON.cloudy_night, label: "Partly Cloudy" };
  // Mainly clear
  if (code === 1)
    return { bg: isDay ? BG.sunny : BG.night, icon: isDay ? ICON.cloudy_sunny : ICON.night, label: "Mainly Clear" };
  // Clear sky
  return { bg: isDay ? BG.sunny : BG.night, icon: isDay ? ICON.sunny : ICON.night, label: "Clear Sky" };
}

export default function WeatherCard() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") { setError("Location permission denied"); return; }

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = loc.coords;

        // Reverse geocode for city name
        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
        const city = geo[0]?.city ?? geo[0]?.district ?? geo[0]?.region ?? "Unknown";

        // Open-Meteo (free, no API key)
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
          `&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,uv_index,is_day` +
          `&wind_speed_unit=kmh&timezone=auto`;

        const res = await fetch(url);
        const json = await res.json();
        const c = json.current;

        setWeather({
          temperature: Math.round(c.temperature_2m),
          humidity: c.relative_humidity_2m,
          precipProb: c.precipitation_probability,
          windSpeed: Math.round(c.wind_speed_10m),
          uvIndex: Math.round(c.uv_index ?? 0),
          weatherCode: c.weather_code,
          isDay: c.is_day === 1,
          city,
        });
      } catch {
        setError("Unable to load weather");
      }
    })();
  }, []);

  if (error) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!weather) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color="#0A5C3B" />
        <Text style={styles.loadingText}>Getting weather...</Text>
      </View>
    );
  }

  const { bg, icon, label } = resolveAssets(weather.weatherCode, weather.isDay);

  return (
    <ImageBackground source={bg} style={styles.card} imageStyle={styles.cardImage}>
      {/* Dark overlay */}
      <View style={styles.overlay} />

      {/* Top row: location + icon */}
      <View style={styles.topRow}>
        <View>
          <Text style={styles.city}>{weather.city}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
        <Image source={icon} style={styles.icon} />
      </View>

      {/* Temp */}
      <Text style={styles.temp}>{weather.temperature}°C</Text>

      {/* Stats grid */}
      <View style={styles.statsRow}>
        <Stat icon="💧" label="Rain" value={`${weather.precipProb}%`} />
        <Divider />
        <Stat icon="💨" label="Wind" value={`${weather.windSpeed} km/h`} />
        <Divider />
        <Stat icon="🌡" label="Humidity" value={`${weather.humidity}%`} />
        <Divider />
        <Stat icon="☀️" label="UV" value={`${weather.uvIndex}`} />
      </View>

      {/* Field advisory */}
      <View style={styles.advisory}>
        <Text style={styles.advisoryText}>{getAdvisory(weather)}</Text>
      </View>
    </ImageBackground>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.statDivider} />;
}

function getAdvisory(w: WeatherData): string {
  if (w.precipProb >= 70) return "⚠️ High rain chance — bring rain gear for field work";
  if (w.windSpeed >= 40) return "⚠️ Strong winds — secure equipment on poles";
  if (w.uvIndex >= 8)    return "☀️ High UV — wear sun protection outdoors";
  if ([95, 96, 99].includes(w.weatherCode)) return "⛈️ Thunderstorm — suspend outdoor work";
  return "✅ Conditions OK for field operations";
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    overflow: "hidden",
    height: 200,
    justifyContent: "space-between",
  },
  cardImage: {
    borderRadius: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: 20,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
  },
  city: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  label: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  icon: {
    width: 52,
    height: 52,
  },
  temp: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -2,
    paddingHorizontal: 16,
    lineHeight: 52,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statIcon: {
    fontSize: 14,
  },
  statValue: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  statLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  advisory: {
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  advisoryText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  loadingBox: {
    marginHorizontal: 16,
    marginTop: 12,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#f4f6f9",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  loadingText: {
    color: "#6B7280",
    fontSize: 13,
  },
  errorBox: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#FEF2F2",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
  },
});
