import React, { useState } from "react";
import { Button, SafeAreaView, Text, TextInput } from "react-native";
import { authStore } from "../store/authStore";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit() {
    try {
      setError("");
      await authStore.login(email, password);
    } catch (next) {
      setError(next instanceof Error ? next.message : "Hyrja dështoi");
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 36, fontWeight: "900", textAlign: "center" }}>Parko</Text>
      <TextInput placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={{ borderWidth: 1, padding: 12 }} />
      <TextInput placeholder="Fjalëkalimi" secureTextEntry value={password} onChangeText={setPassword} style={{ borderWidth: 1, padding: 12 }} />
      {error && <Text style={{ color: "#b42318" }}>{error}</Text>}
      <Button title="Hyr" onPress={submit} />
    </SafeAreaView>
  );
}
