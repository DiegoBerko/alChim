import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Defs, ClipPath, Rect } from 'react-native-svg';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UpdateProvider } from '../context/UpdateContext';
import { SessionProvider, useSession } from '../context/SessionContext';
import { colors } from '../theme';
import HomeScreen from '../screens/HomeScreen';
import ActiveSessionScreen from '../screens/ActiveSessionScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ExercisesScreen from '../screens/ExercisesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PlanSessionScreen from '../screens/PlanSessionScreen';
import SessionDetailScreen from '../screens/SessionDetailScreen';
import type { PlannedSession, WorkoutSession } from '../types';

export type MainTabParamList = {
  Inicio: undefined;
  Sesión: undefined;
  Historial: undefined;
  Ejercicios: undefined;
  Perfil: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  PlanSession: { session?: PlannedSession } | undefined;
  SessionDetail: { session: WorkoutSession };
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Inicio: '🏠',
  Sesión: '⚡',
  Historial: '📋',
  Ejercicios: '🏋️',
  Perfil: '👤',
};

// ─── Animated lightning bolt (SVG + ClipPath shimmer) ────────────────────────

const AnimatedRect = Animated.createAnimatedComponent(Rect);
// Standard lightning bolt path in a 24×24 viewBox
const BOLT_PATH = 'M 13 2 L 3 14 L 12 14 L 11 22 L 21 10 L 12 10 Z';

function LightningIcon({ active, dim }: { active: boolean; dim: boolean }) {
  const shimmerY = useRef(new Animated.Value(-6)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (active) {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerY, {
            toValue: 26,
            duration: 750,
            useNativeDriver: false,
            easing: Easing.linear,
          }),
          Animated.delay(2250),
          Animated.timing(shimmerY, { toValue: -6, duration: 0, useNativeDriver: false }),
        ]),
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      loopRef.current = null;
      shimmerY.setValue(-6);
    }
    return () => { loopRef.current?.stop(); };
  }, [active]);

  return (
    <View style={[tabStyles.lightningWrap, dim && tabStyles.lightningDim]}>
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Defs>
          <ClipPath id="lightning-mask">
            <Path d={BOLT_PATH} />
          </ClipPath>
        </Defs>
        <Path d={BOLT_PATH} fill={active ? '#F5A623' : '#666'} />
        {active && (
          <AnimatedRect
            clipPath="url(#lightning-mask)"
            x={0}
            y={shimmerY}
            width={24}
            height={5}
            fill="rgba(255,255,255,0.85)"
          />
        )}
      </Svg>
    </View>
  );
}

// ─── Custom tab bar ───────────────────────────────────────────────────────────

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { sessionLoaded, sessionActive } = useSession();
  const hasSession = sessionLoaded || sessionActive;

  return (
    <View style={[tabStyles.tabBar, { paddingBottom: insets.bottom || 8 }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const isSession = route.name === 'Sesión';

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
            style={tabStyles.tab}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}>
            {isSession ? (
              <LightningIcon active={hasSession} dim={!isFocused} />
            ) : (
              <Text style={[tabStyles.tabIcon, !isFocused && tabStyles.tabIconDim]}>{icon}</Text>
            )}
            <Text style={[
              tabStyles.tabLabel,
              { color: isFocused ? (isSession && hasSession ? colors.accent : colors.accent) : colors.textSecondary },
            ]}>
              {options.title ?? route.name}
            </Text>
            {isSession && hasSession && !isFocused && (
              <View style={tabStyles.activeDot} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Inicio" component={HomeScreen} />
      <Tab.Screen name="Sesión" component={ActiveSessionScreen} />
      <Tab.Screen name="Historial" component={HistoryScreen} />
      <Tab.Screen name="Ejercicios" component={ExercisesScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <UpdateProvider>
      <SessionProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="PlanSession" component={PlanSessionScreen} />
            <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SessionProvider>
    </UpdateProvider>
  );
}

const tabStyles = StyleSheet.create({
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

  lightningWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightningDim: { opacity: 0.5 },
  activeDot: {
    position: 'absolute',
    top: 2,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
});
