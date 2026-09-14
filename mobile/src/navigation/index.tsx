import React, { useSyncExternalStore } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Button } from "react-native";
import type { MobileParking } from "../api";
import { LoginScreen } from "../screens/LoginScreen";
import { MapScreen } from "../screens/MapScreen";
import { CommunityScreen } from "../screens/CommunityScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { ParkingDetailsScreen } from "../screens/ParkingDetailsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ReportScreen } from "../screens/ReportScreen";
import { authStore } from "../store/authStore";

export type RootStackParamList = {
  Login: undefined;
  Map: undefined;
  Community: undefined;
  Report: undefined;
  Profile: undefined;
  Notifications: undefined;
  ParkingDetails: { parking: MobileParking };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const auth = useSyncExternalStore(authStore.subscribe, authStore.getSnapshot, authStore.getSnapshot);
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!auth.authenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen
              name="Map"
              options={({ navigation }) => ({
                title: "Parko",
                headerRight: () => <Button title="Njoftime" onPress={() => navigation.navigate("Notifications")} />,
              })}
            >
              {({ navigation }) => <MapScreen onSelect={(parking) => navigation.navigate("ParkingDetails", { parking })} />}
            </Stack.Screen>
            <Stack.Screen name="Community" component={CommunityScreen} options={{ title: "Komuniteti" }} />
            <Stack.Screen name="Report" component={ReportScreen} options={{ title: "Raporto" }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profili" }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Njoftimet" }} />
            <Stack.Screen name="ParkingDetails" options={{ title: "Detajet" }}>
              {({ route }) => <ParkingDetailsScreen parking={route.params.parking} />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
