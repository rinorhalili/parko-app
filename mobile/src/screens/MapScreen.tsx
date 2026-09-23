import React, { useEffect, useState } from "react";
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { request, type MobileParking } from "../api";
import { ParkingMarker } from "../components/ParkingMarker";
import { searchPrishtinaDestinations, type Destination } from "../geocoding";
import { useLocation } from "../hooks/useLocation";

const initialRegion: Region = { latitude: 42.6629, longitude: 21.1655, latitudeDelta: 0.08, longitudeDelta: 0.08 };

export function MapScreen({ onSelect }: { onSelect?: (parking: MobileParking) => void }) {
  const [parkings, setParkings] = useState<MobileParking[]>([]);
  const [region, setRegion] = useState(initialRegion);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Destination[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [searching, setSearching] = useState(false);
  const { locate, loading, error } = useLocation();

  useEffect(() => {
    void request<MobileParking[]>("/parking?page=0").then(setParkings).catch(() => setParkings([]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(Boolean(query.trim()));
      searchPrishtinaDestinations(query, controller.signal)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  async function centerOnUser() {
    const position = await locate();
    if (!position) return;
    setRegion((current) => ({
      ...current,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      latitudeDelta: 0.018,
      longitudeDelta: 0.018,
    }));
  }

  function selectDestination(destination: Destination) {
    setSelectedDestination(destination);
    setQuery(destination.name);
    setResults([]);
    setRegion((current) => ({
      ...current,
      latitude: destination.latitude,
      longitude: destination.longitude,
      latitudeDelta: 0.018,
      longitudeDelta: 0.018,
    }));
  }

  return (
    <View style={styles.root}>
      <MapView style={styles.map} region={region} onRegionChangeComplete={setRegion}>
        {selectedDestination && (
          <Marker
            coordinate={{ latitude: selectedDestination.latitude, longitude: selectedDestination.longitude }}
            title={selectedDestination.name}
            description={selectedDestination.subtitle}
            pinColor="#2563eb"
          />
        )}
        {parkings.map((parking) => <ParkingMarker parking={parking} key={parking.id} onPress={onSelect} />)}
      </MapView>
      <View style={styles.searchPanel}>
        <TextInput
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setQuery}
          placeholder="Kerko lokacion ne Prishtine"
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        {searching && <ActivityIndicator style={styles.searching} />}
        {results.length > 0 && (
          <FlatList
            data={results}
            keyExtractor={(item: Destination) => item.id}
            keyboardShouldPersistTaps="handled"
            style={styles.results}
            renderItem={({ item }: { item: Destination }) => (
              <View style={styles.resultRow}>
                <Text style={styles.resultTitle} onPress={() => selectDestination(item)}>{item.name}</Text>
                <Text style={styles.resultSubtitle} onPress={() => selectDestination(item)}>{item.subtitle}</Text>
              </View>
            )}
          />
        )}
      </View>
      {!!error && <Text style={styles.locationError}>{error}</Text>}
      <View style={styles.locationButton}>
        <Button title={loading ? "Duke kerkuar..." : "Perdor lokacionin tim"} onPress={centerOnUser} disabled={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  searchPanel: {
    position: "absolute",
    top: 52,
    left: 16,
    right: 16,
  },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    color: "#111827",
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  searching: {
    position: "absolute",
    right: 14,
    top: 14,
  },
  results: {
    marginTop: 8,
    maxHeight: 280,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  resultRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  resultTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  resultSubtitle: {
    color: "#4b5563",
    fontSize: 13,
    marginTop: 2,
  },
  locationButton: {
    backgroundColor: "#fff",
  },
  locationError: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: "center",
  },
});
