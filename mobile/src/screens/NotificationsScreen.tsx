import React, { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { listNotifications, type MobileNotification } from "../api";

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  useEffect(() => {
    void listNotifications().then(setNotifications).catch(() => setNotifications([]));
  }, []);
  return (
    <FlatList
      data={notifications}
      keyExtractor={(item: MobileNotification) => item.id}
      ListEmptyComponent={<Text style={{ padding: 24 }}>Nuk ka njoftime.</Text>}
      renderItem={({ item }: { item: MobileNotification }) => (
        <View style={{ padding: 16, borderBottomWidth: 1, borderColor: "#eee" }}>
          <Text style={{ fontWeight: "700" }}>{item.title}</Text>
          <Text>{item.message}</Text>
        </View>
      )}
    />
  );
}
