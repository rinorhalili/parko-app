import React from "react";
import { Button, SafeAreaView, Text } from "react-native";
import type { MobileParking } from "../api";

export function ParkingDetailsScreen({ parking, onReserve }: { parking: MobileParking; onReserve?: (parking: MobileParking) => void }) {
  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>{parking.title}</Text>
      <Text>{parking.address ?? "Prishtinë"}</Text>
      <Text>Statusi: {parking.status}</Text>
      <Button title="Rezervo" onPress={() => onReserve?.(parking)} />
    </SafeAreaView>
  );
}
