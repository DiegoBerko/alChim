import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { storage } from '../services/storage';
import type { WorkoutSession } from '../types';

function SessionRow({
  session,
  onDelete,
}: {
  session: WorkoutSession;
  onDelete: (id: string) => void;
}) {
  const date = new Date(session.startTime);
  const dateStr = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  let durationMin: number | null = null;
  if (session.endTime) {
    durationMin = Math.round(
      (new Date(session.endTime).getTime() - date.getTime()) / 60000,
    );
  }

  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  function confirmDelete() {
    Alert.alert('Eliminar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => onDelete(session.id),
      },
    ]);
  }

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowDate}>{dateStr}</Text>
        <Text style={styles.rowTime}>{timeStr}</Text>
        <Text style={styles.rowStats}>
          {session.exercises.length} ejercicio{session.exercises.length !== 1 ? 's' : ''}
          {'  ·  '}
          {totalSets} serie{totalSets !== 1 ? 's' : ''}
          {durationMin !== null ? `  ·  ${durationMin} min` : ''}
          {session.estimatedKcal !== undefined ? `  ·  ${session.estimatedKcal} kcal` : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn} hitSlop={8}>
        <Text style={styles.deleteBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      storage.getSessions().then(setSessions);
    }, []),
  );

  async function handleDelete(id: string) {
    await storage.deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Historial</Text>
        <Text style={styles.count}>
          {sessions.length} sesión{sessions.length !== 1 ? 'es' : ''}
        </Text>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Sin sesiones registradas.</Text>
          <Text style={styles.emptySubText}>
            Completá tu primera sesión para verla aquí.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <SessionRow session={item} onDelete={handleDelete} />
          )}
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
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  count: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 8,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowMain: {
    flex: 1,
  },
  rowDate: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  rowTime: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  rowStats: {
    color: colors.accent,
    fontSize: 12,
    marginTop: 6,
  },
  deleteBtn: {
    paddingLeft: 12,
  },
  deleteBtnText: {
    color: colors.textSecondary,
    fontSize: 16,
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
