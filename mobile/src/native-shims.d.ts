declare module 'react-native' {
  export const ActivityIndicator: any
  export const Button: any
  export const FlatList: any
  export const SafeAreaView: any
  export const StyleSheet: { create<T extends Record<string, object>>(styles: T): T }
  export const Text: any
  export const TextInput: any
  export const View: any
  export const Platform: { OS: 'android' | 'ios' }
}
