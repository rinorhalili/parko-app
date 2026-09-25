import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { io } from "socket.io-client";
import Constants from "expo-constants";
import {
  cancelReservation,
  createReservation,
  getAccessToken,
  listMyReservations,
  listNotifications,
  listPosts,
  login,
  logout,
  register,
  registerPushDevice,
  request,
  restoreToken,
  type MobileNotification,
  type MobileParking,
  type MobilePost,
  type MobileReservation,
} from "./src/api";

const initialRegion: Region = {
  latitude: 42.6629,
  longitude: 21.1655,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const INTRO_KEY = "parko.mobile.intro.v1";
const INTRO_STEPS = [
  {
    title: "Mirë se erdhe në Parko",
    body: "Këtu gjen parkingje në Prishtinë, kontrollon lokacionin dhe zgjedh opsionin më të përshtatshëm.",
    action: "Vazhdo",
  },
  {
    title: "Harta",
    body: "Markerat tregojnë parkingjet. Preke një marker për adresë, status dhe rezervim kur parkingu është i verifikuar.",
    action: "Tjetra",
  },
  {
    title: "Lokacioni im",
    body: "Butoni Përdor lokacionin tim e afron hartën te vendndodhja jote. Nëse GPS nuk punon, kontrollo lejen e lokacionit në telefon.",
    action: "Tjetra",
  },
  {
    title: "Komuniteti",
    body: "Te Komuniteti sheh njoftime dhe postime nga përdoruesit për parkingje, ndryshime dhe probleme në terren.",
    action: "Tjetra",
  },
  {
    title: "Rezervimet dhe Njoftimet",
    body: "Rezervimet ruajnë parkingjet aktive. Njoftimet të lajmërojnë për ndryshime, rezervime dhe aktivitet të rëndësishëm.",
    action: "Përfundo",
  },
] as const;

async function registerForPushNotifications() {
  if (!Device.isDevice) return null;
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted
    ? current
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "Njoftimet Parko",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const projectId =
    Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.easProjectId;
  return (
    await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
  ).data;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [parkings, setParkings] = useState<MobileParking[]>([]);
  const [posts, setPosts] = useState<MobilePost[]>([]);
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [reservations, setReservations] = useState<MobileReservation[]>([]);
  const [selectedParking, setSelectedParking] = useState<MobileParking | null>(
    null,
  );
  const [booking, setBooking] = useState(false);
  const [region, setRegion] = useState(initialRegion);
  const [introReady, setIntroReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const [tab, setTab] = useState<
    "map" | "community" | "reservations" | "notifications"
  >("map");

  const refreshData = () => {
    request<MobileParking[]>("/parking?page=0")
      .then(setParkings)
      .catch((next) => setError(next.message));
    listPosts()
      .then(setPosts)
      .catch((next) => setError(next.message));
    listNotifications()
      .then(setNotifications)
      .catch((next) => setError(next.message));
    listMyReservations()
      .then((next) => setReservations(next.items))
      .catch((next) => setError(next.message));
  };

  useEffect(() => {
    restoreToken().then((token) => {
      setUser(Boolean(token));
      setReady(true);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(INTRO_KEY)
      .then((value) => {
        setShowIntro(value !== "done");
        setIntroReady(true);
      })
      .catch(() => {
        setShowIntro(true);
        setIntroReady(true);
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshData();
    void registerForPushNotifications().then(
      (token) =>
        token && registerPushDevice(token, Platform.OS).catch(() => undefined),
    );
    const subscription = Notifications.addNotificationReceivedListener(() => {
      listNotifications()
        .then(setNotifications)
        .catch(() => undefined);
    });
    const socketUrl = String(
      Constants.expoConfig?.extra?.socketUrl ?? "http://10.0.2.2:4000",
    );
    const socket = io(socketUrl, {
      auth: { token: getAccessToken() },
      transports: ["websocket"],
    });
    socket.on(
      "parking:reported",
      (report: { parkingSpotId: string; status: string }) =>
        setParkings((current) =>
          current.map((item) =>
            item.id === report.parkingSpotId
              ? { ...item, status: report.status }
              : item,
          ),
        ),
    );
    socket.on(
      "parking:updated",
      (update: { parkingSpotId: string; status: string }) =>
        setParkings((current) =>
          current.map((item) =>
            item.id === update.parkingSpotId
              ? { ...item, status: update.status }
              : item,
          ),
        ),
    );
    socket.on("notification:new", () =>
      listNotifications()
        .then(setNotifications)
        .catch(() => undefined),
    );
    return () => {
      subscription.remove();
      socket.disconnect();
    };
  }, [user]);

  async function submit() {
    try {
      setError("");
      const data =
        mode === "login"
          ? await login(email, password)
          : await register({ name, username, email, password });
      setUser(Boolean(data.accessToken));
      const introDone = await AsyncStorage.getItem(INTRO_KEY).catch(() => null);
      if (introDone !== "done") {
        setIntroStep(0);
        setShowIntro(true);
      }
    } catch (next) {
      setError(next instanceof Error ? next.message : "Hyrja dështoi");
    }
  }

  async function locate() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return;
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    setRegion({
      ...region,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
  }

  async function reserve(hours: number) {
    if (!selectedParking) return;
    try {
      setBooking(true);
      setError("");
      const startsAt = new Date(Date.now() + 5 * 60_000);
      const created = await createReservation(
        selectedParking.id,
        startsAt,
        new Date(startsAt.getTime() + hours * 60 * 60_000),
      );
      setReservations((current) => [created, ...current]);
      setSelectedParking(null);
      setTab("reservations");
    } catch (next) {
      setError(next instanceof Error ? next.message : "Rezervimi dështoi");
    } finally {
      setBooking(false);
    }
  }

  async function cancel(id: string) {
    try {
      setError("");
      const updated = await cancelReservation(id);
      setReservations((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (next) {
      setError(next instanceof Error ? next.message : "Anulimi dështoi");
    }
  }

  async function finishIntro() {
    setShowIntro(false);
    setIntroStep(0);
    await AsyncStorage.setItem(INTRO_KEY, "done").catch(() => undefined);
  }

  if (!ready || !introReady)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  if (!user)
    return (
      <SafeAreaView style={styles.auth}>
        <Text style={styles.title}>PARKO</Text>
        <Text style={styles.subtitle}>
          {mode === "login" ? "Hyr në llogari" : "Krijo llogari"}
        </Text>
        {mode === "register" && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Emri"
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Username"
              onChangeText={setUsername}
            />
          </>
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Fjalëkalimi"
          secureTextEntry
          onChangeText={setPassword}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button
          title={mode === "login" ? "Hyr" : "Regjistrohu"}
          onPress={submit}
        />
        <Button
          title={mode === "login" ? "Krijo llogari" : "Kthehu në hyrje"}
          onPress={() => setMode(mode === "login" ? "register" : "login")}
        />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.heading}>Parko</Text>
        <Button
          title="Dil"
          onPress={() => logout().then(() => setUser(false))}
        />
      </View>
      {showIntro && (
        <View style={styles.introOverlay}>
          <View style={styles.introCard}>
            <Text style={styles.introCounter}>
              {introStep + 1} / {INTRO_STEPS.length}
            </Text>
            <Text style={styles.introTitle}>{INTRO_STEPS[introStep].title}</Text>
            <Text style={styles.introBody}>{INTRO_STEPS[introStep].body}</Text>
            <View style={styles.introDots}>
              {INTRO_STEPS.map((step) => (
                <View
                  key={step.title}
                  style={[
                    styles.introDot,
                    step.title === INTRO_STEPS[introStep].title &&
                      styles.introDotActive,
                  ]}
                />
              ))}
            </View>
            <View style={styles.introActions}>
              <Button title="Kalo" onPress={finishIntro} />
              <Button
                title={INTRO_STEPS[introStep].action}
                onPress={() => {
                  if (introStep === INTRO_STEPS.length - 1) {
                    void finishIntro();
                    return;
                  }
                  setIntroStep((current) => current + 1);
                }}
              />
            </View>
          </View>
        </View>
      )}
      {tab === "map" && (
        <>
          <MapView
            style={styles.map}
            region={region}
            onRegionChangeComplete={setRegion}
          >
            {parkings.map((parking) => (
              <Marker
                key={parking.id}
                coordinate={{
                  latitude: parking.latitude,
                  longitude: parking.longitude,
                }}
                title={parking.title}
                description={`${parking.status} • ${parking.address ?? ""}`}
                onPress={() => setSelectedParking(parking)}
              />
            ))}
          </MapView>
          <Button title="Përdor lokacionin tim" onPress={locate} />
          {selectedParking && (
            <View style={styles.booking}>
              <Text style={styles.rowTitle}>{selectedParking.title}</Text>
              <Text>{selectedParking.address ?? "Prishtinë"}</Text>
              <Text style={styles.bookingNote}>
                Rezervimet funksionojnë vetëm për parkingje të verifikuara.
              </Text>
              <View style={styles.buttonRow}>
                <Button
                  title="1 orë"
                  disabled={booking}
                  onPress={() => reserve(1)}
                />
                <Button
                  title="2 orë"
                  disabled={booking}
                  onPress={() => reserve(2)}
                />
                <Button
                  title="4 orë"
                  disabled={booking}
                  onPress={() => reserve(4)}
                />
              </View>
              <Button title="Mbyll" onPress={() => setSelectedParking(null)} />
            </View>
          )}
        </>
      )}
      {tab === "community" && (
        <FlatList
          data={posts}
          keyExtractor={(post: MobilePost) => post.id}
          ListEmptyComponent={<Text style={styles.empty}>Nuk ka postime.</Text>}
          renderItem={({ item }: { item: MobilePost }) => (
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text>{item.content}</Text>
              <Text>
                {item.author?.username ?? "Komuniteti"} ·{" "}
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
          )}
        />
      )}
      {tab === "reservations" && (
        <FlatList
          data={reservations.filter(
            (reservation: MobileReservation) =>
              !reservation.cancelledAt &&
              new Date(reservation.expiresAt) > new Date(),
          )}
          keyExtractor={(reservation: MobileReservation) => reservation.id}
          ListEmptyComponent={
            <Text style={styles.empty}>Nuk ke rezervime aktive.</Text>
          }
          renderItem={({ item }: { item: MobileReservation }) => (
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{item.parkingSpot.title}</Text>
              <Text>
                {new Date(item.startsAt).toLocaleString()} -{" "}
                {new Date(item.expiresAt).toLocaleTimeString()}
              </Text>
              <Button title="Anulo" onPress={() => cancel(item.id)} />
            </View>
          )}
        />
      )}
      {tab === "notifications" && (
        <FlatList
          data={notifications}
          keyExtractor={(notification: MobileNotification) => notification.id}
          ListEmptyComponent={
            <Text style={styles.empty}>Nuk ka njoftime.</Text>
          }
          renderItem={({ item }: { item: MobileNotification }) => (
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text>{item.message}</Text>
            </View>
          )}
        />
      )}
      <View style={styles.nav}>
        <Button title="Harta" onPress={() => setTab("map")} />
        <Button title="Komuniteti" onPress={() => setTab("community")} />
        <Button title="Rezervimet" onPress={() => setTab("reservations")} />
        <Button
          title={`Njoftimet${notifications.some((notification) => !notification.readAt) ? " •" : ""}`}
          onPress={() => setTab("notifications")}
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  auth: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: {
    fontSize: 40,
    fontWeight: "800",
    color: "#18324b",
    textAlign: "center",
  },
  subtitle: { fontSize: 18, textAlign: "center", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ccd5df",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  error: { color: "#b42318", padding: 8 },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  heading: { fontSize: 26, fontWeight: "800" },
  map: { flex: 1 },
  nav: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 8,
    borderTopWidth: 1,
    borderColor: "#ddd",
  },
  row: { padding: 16, borderBottomWidth: 1, borderColor: "#eee", gap: 6 },
  rowTitle: { fontWeight: "700", fontSize: 16 },
  empty: { padding: 24, textAlign: "center" },
  booking: { padding: 16, borderTopWidth: 1, borderColor: "#d7e1ec", gap: 8 },
  bookingNote: { color: "#52667a" },
  buttonRow: { flexDirection: "row", justifyContent: "space-between" },
  introOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    justifyContent: "center",
    padding: 24,
  },
  introCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    gap: 12,
  },
  introCounter: {
    color: "#246bfd",
    fontWeight: "700",
    textAlign: "right",
  },
  introTitle: {
    color: "#18324b",
    fontSize: 24,
    fontWeight: "800",
  },
  introBody: {
    color: "#3f5368",
    fontSize: 16,
    lineHeight: 23,
  },
  introDots: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 4,
  },
  introDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#d7e1ec",
  },
  introDotActive: {
    width: 22,
    backgroundColor: "#246bfd",
  },
  introActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
});
