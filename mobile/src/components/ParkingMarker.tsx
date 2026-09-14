import React from "react";
import { Text, View } from "react-native";
import { Marker } from "react-native-maps";
import type { MobileParking } from "../api";

export function ParkingMarker({ parking, onPress }: { parking: MobileParking; onPress?: (parking: MobileParking) => void }) {
  const color = parking.status === "AVAILABLE" ? "#16805a" : parking.status === "OCCUPIED" ? "#bd3d46" : "#586779";
  return (
    <Marker
      coordinate={{ latitude: parking.latitude, longitude: parking.longitude }}
      title={parking.title}
      description={parking.address ?? undefined}
      onPress={() => onPress?.(parking)}
    >
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "white", fontWeight: "800" }}>P</Text>
      </View>
    </Marker>
  );
}
