import React, { useState } from "react";
import { Button, SafeAreaView, Text, TextInput } from "react-native";
import { request } from "../api";

export function ReportScreen() {
  const [parkingSpotId, setParkingSpotId] = useState("");
  const [message, setMessage] = useState("");
  async function submit() {
    await request("/reports/parking", {
      method: "POST",
      body: JSON.stringify({ parkingSpotId, status: "AVAILABLE", latitude: 42.6629, longitude: 21.1655 }),
    });
    setMessage("Raporti u dërgua.");
  }
  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <TextInput placeholder="Parking ID" value={parkingSpotId} onChangeText={setParkingSpotId} style={{ borderWidth: 1, padding: 12 }} />
      <Button title="Raporto vend të lirë" onPress={submit} />
      {message && <Text>{message}</Text>}
    </SafeAreaView>
  );
}
