import React from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import type { MobileParking } from "../api";

export function ParkingCard({ parking, onPress }: { parking: MobileParking; onPress?: (parking: MobileParking) => void }) {
  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.title}>{parking.title}</Text>
        <Text style={styles.meta}>{parking.address ?? "Prishtinë"} • {parking.status}</Text>
      </View>
      {onPress && <Button title="Hap" onPress={() => onPress(parking)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderBottomWidth: 1, borderColor: "#e5eaf0", backgroundColor: "white" },
  title: { fontSize: 16, fontWeight: "700", color: "#18324b" },
  meta: { marginTop: 4, color: "#52667a" },
});
