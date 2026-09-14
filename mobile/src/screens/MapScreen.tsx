import React, { useEffect, useState } from "react";
import { Button, StyleSheet, View } from "react-native";
import MapView, { Region } from "react-native-maps";
import { request, type MobileParking } from "../api";
import { ParkingMarker } from "../components/ParkingMarker";
import { useLocation } from "../hooks/useLocation";

const initialRegion: Region = { latitude: 42.6629, longitude: 21.1655, latitudeDelta: 0.08, longitudeDelta: 0.08 };

export function MapScreen({ onSelect }: { onSelect?: (parking: MobileParking) => void }) {
  const [parkings, setParkings] = useState<MobileParking[]>([]);
  const [region, setRegion] = useState(initialRegion);
  const { locate } = useLocation();

  useEffect(() => {
    void request<MobileParking[]>("/parking?page=0").then(setParkings).catch(() => setParkings([]));
  }, []);

  async function centerOnUser() {
    const position = await locate();
    if (!position) return;
    setRegion((current) => ({ ...current, latitude: position.coords.latitude, longitude: position.coords.longitude }));
  }

  return (
    <View style={styles.root}>
      <MapView style={styles.map} region={region} onRegionChangeComplete={setRegion}>
        {parkings.map((parking) => <ParkingMarker parking={parking} key={parking.id} onPress={onSelect} />)}
      </MapView>
      <Button title="Përdor lokacionin tim" onPress={centerOnUser} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 }, map: { flex: 1 } });
