import React, { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { listPosts, type MobilePost } from "../api";

export function CommunityScreen() {
  const [posts, setPosts] = useState<MobilePost[]>([]);
  useEffect(() => {
    void listPosts().then(setPosts).catch(() => setPosts([]));
  }, []);
  return (
    <FlatList
      data={posts}
      keyExtractor={(item: MobilePost) => item.id}
      ListEmptyComponent={<Text style={{ padding: 24 }}>Nuk ka postime.</Text>}
      renderItem={({ item }: { item: MobilePost }) => (
        <View style={{ padding: 16, borderBottomWidth: 1, borderColor: "#eee" }}>
          <Text style={{ fontWeight: "700" }}>{item.title}</Text>
          <Text>{item.content}</Text>
        </View>
      )}
    />
  );
}
