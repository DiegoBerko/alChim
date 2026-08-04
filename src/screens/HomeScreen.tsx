import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors } from '../theme';
import { storage } from '../services/storage';
import { useUpdate } from '../context/UpdateContext';
import type { WorkoutSession } from '../types';
import type { MainTabParamList } from '../navigation/AppNavigator';

type HomeNavProp = BottomTabNavigationProp<MainTabParamList, 'Inicio'>;

function SessionCard({ session }: { session: WorkoutSession }) {
  const date = new Date(session.startTime);
  const dateStr = date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  return (
    <View style={styles.card}>
      <Text style={styles.cardDate}>{dateStr}</Text>
      <Text style={styles.cardTitle}>
        {session.exercises.length} ejercicio{session.exercises.length !== 1 ? 's' : ''}
        {'  ·  '}
        {totalSets} serie{totalSets !== 1 ? 's' : ''}
      </Text>
      {session.estimatedKcal !== undefined && (
        <Text style={styles.cardKcal}>{session.estimatedKcal} kcal estimadas</Text>
      )}
      {session.notes ? <Text style={styles.cardNotes}>{session.notes}</Text> : null}
    </View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const { updateInfo, clearUpdate } = useUpdate();

  useFocusEffect(
    useCallback(() => {
      storage.getSessions().then(all => setRecentSessions(all.slice(0, 5)));
    }, []),
  );

  function handleUpdate() {
    if (!updateInfo) return;
    Alert.alert(
      'Nueva versión disponible',
      `¿Descargar la actualización?${updateInfo.changelog ? `\n\n${updateInfo.changelog}` : ''}`,
      [
        { text: 'Ahora no', style: 'cancel', onPress: clearUpdate },
        { text: 'Descargar', onPress: () => { Linking.openURL(updateInfo.url); clearUpdate(); } },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>alChim</Text>
        <Text style={styles.subtitle}>Tu diario de entrenamiento</Text>
      </View>

      {updateInfo && (
        <TouchableOpacity style={styles.updateBanner} onPress={handleUpdate} activeOpacity={0.8}>
          <Text style={styles.updateBannerText}>🔄 Nueva versión disponible — tap para actualizar</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.newSessionBtn}
        onPress={() => navigation.navigate('Sesión')}
        activeOpacity={0.8}>
        <Text style={styles.newSessionBtnText}>+ Nueva sesión</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Sesiones recientes</Text>

      {recentSessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No hay sesiones todavía.</Text>
          <Text style={styles.emptySubText}>
            ¡Empezá tu primera sesión de entrenamiento!
          </Text>
        </View>
      ) : (
        <FlatList
          data={recentSessions}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <SessionCard session={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  title: {
    color: colors.accent,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  updateBanner: {
    backgroundColor: '#1a2a1a',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  updateBannerText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
  },
  newSessionBtn: {
    backgroundColor: colors.accent,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  newSessionBtnText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDate: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  cardKcal: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  cardNotes: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
