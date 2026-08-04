import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UpdateProvider } from '../context/UpdateContext';
import { colors } from '../theme';
import HomeScreen from '../screens/HomeScreen';
import ActiveSessionScreen from '../screens/ActiveSessionScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ExercisesScreen from '../screens/ExercisesScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type MainTabParamList = {
  Inicio: undefined;
  Sesión: undefined;
  Historial: undefined;
  Ejercicios: undefined;
  Perfil: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Inicio: '🏠',
  Sesión: '⚡',
  Historial: '📋',
  Ejercicios: '🏋️',
  Perfil: '👤',
};

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom || 8 }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const icon = TAB_ICONS[route.name as keyof MainTabParamList] ?? '●';

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}>
            <Text style={[styles.tabIcon, !isFocused && styles.tabIconDim]}>{icon}</Text>
            <Text style={[styles.tabLabel, { color: isFocused ? colors.accent : colors.textSecondary }]}>
              {options.title ?? route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AppNavigator() {
  return (
    <UpdateProvider>
      <NavigationContainer>
        <Tab.Navigator
          tabBar={props => <CustomTabBar {...props} />}
          screenOptions={{ headerShown: false }}>
          <Tab.Screen name="Inicio" component={HomeScreen} />
          <Tab.Screen name="Sesión" component={ActiveSessionScreen} />
          <Tab.Screen name="Historial" component={HistoryScreen} />
          <Tab.Screen name="Ejercicios" component={ExercisesScreen} />
          <Tab.Screen name="Perfil" component={ProfileScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </UpdateProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  tabIcon: { fontSize: 20 },
  tabIconDim: { opacity: 0.5 },
  tabLabel: { fontSize: 10, fontWeight: '700' },
});
