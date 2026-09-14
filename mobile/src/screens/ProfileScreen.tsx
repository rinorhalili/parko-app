import React from "react";
import { Button, SafeAreaView, Text } from "react-native";
import { authStore } from "../store/authStore";

export function ProfileScreen() {
  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>Profili</Text>
      <Text>Menaxho llogarinë dhe reputacionin tënd në Parko.</Text>
      <Button title="Dil" onPress={() => void authStore.logout()} />
    </SafeAreaView>
  );
}
