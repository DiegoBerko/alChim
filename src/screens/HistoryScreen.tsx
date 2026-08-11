import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { storage } from '../services/storage';
import type { WorkoutSession } from '../types';
import type { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';

type HistoryNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Historial'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ─── Session row ──────────────────────────────────────────────────────────────

function SessionRow({
  session,
  onPress,
  onDelete,
}: {
  session: WorkoutSession;
  onPress: () => void;
  onDelete: (id: string) => void;
}) {
  const date = new Date(session.startTime ?? session.date);
  const dateStr = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeStr = session.startTime
    ? date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : '';

  let durationMin: number | null = null;
  if (session.startTime && session.endTime) {
    durationMin = Math.round(
      (new Date(session.endTime).getTime() - date.getTime()) / 60000,
    );
  }

  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  const exPreview = session.exercises
    .slice(0, 3)
    .map(ex => ex.exerciseName)
    .join(' · ');

  function confirmDelete() {
    Alert.alert('Eliminar sesión', '¿Estás seguro? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(session.id) },
    ]);
  }

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowDate}>{dateStr}</Text>
        {timeStr ? <Text style={styles.rowTime}>{timeStr}</Text> : null}
        <Text style={styles.rowStats}>
          {session.exercises.length} ejercicio{session.exercises.length !== 1 ? 's' : ''}
          {'  ·  '}
          {totalSets} serie{totalSets !== 1 ? 's' : ''}
          {durationMin !== null ? `  ·  ${durationMin} min` : ''}
          {session.estimatedKcal !== undefined ? `  ·  ${session.estimatedKcal} kcal` : ''}
        </Text>
        {exPreview ? <Text style={styles.rowPreview}>{exPreview}{session.exercises.length > 3 ? '...' : ''}</Text> : null}
        {session.notes ? <Text style={styles.rowNotes}>"{session.notes}"</Text> : null}
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowChevron}>›</Text>
        <TouchableOpacity onPress={confirmDelete} hitSlop={12} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Compact session row (used in calendar day view) ──────────────────────────

function CompactSessionRow({
  session,
  onPress,
}: {
  session: WorkoutSession;
  onPress: () => void;
}) {
  const date = new Date(session.startTime ?? session.date);
  const timeStr = session.startTime
    ? date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : '';
  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  return (
    <TouchableOpacity style={styles.compactRow} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.compactRowLeft}>
        <Text style={styles.compactRowTitle}>
          {session.exercises.length} ejercicio{session.exercises.length !== 1 ? 's' : ''}
          {'  ·  '}
          {totalSets} serie{totalSets !== 1 ? 's' : ''}
          {session.estimatedKcal !== undefined ? `  ·  ${session.estimatedKcal} kcal` : ''}
        </Text>
        {timeStr ? <Text style={styles.compactRowTime}>{timeStr}</Text> : null}
        {session.notes ? <Text style={styles.compactRowNotes}>"{session.notes}"</Text> : null}
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Calendar view ────────────────────────────────────────────────────────────

function CalendarView({
  sessions,
  onSessionPress,
  onDelete,
}: {
  sessions: WorkoutSession[];
  onSessionPress: (s: WorkoutSession) => void;
  onDelete: (id: string) => void;
}) {
  const today = new Date();
  const [calMonth, setCalMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    sessions.forEach(s => {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    });
    return map;
  }, [sessions]);

  const { year, month } = calMonth;
  const firstDay = new Date(year, month, 1);
  // Mon=0 ... Sun=6
  const firstDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build weeks
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  function toYMD(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function prevMonth() {
    setSelectedDay(null);
    setCalMonth(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  }

  function nextMonth() {
    setSelectedDay(null);
    setCalMonth(prev => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  }

  const monthName = firstDay.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  const selectedSessions = selectedDay ? (sessionsByDate.get(selectedDay) ?? []) : [];

  function confirmDelete(id: string) {
    Alert.alert('Eliminar sesión', '¿Estás seguro? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(id) },
    ]);
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={calStyles.scrollContent}>
      {/* Month nav */}
      <View style={calStyles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={calStyles.navBtn} activeOpacity={0.7}>
          <Text style={calStyles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={calStyles.monthTitle}>{monthName.charAt(0).toUpperCase() + monthName.slice(1)}</Text>
        <TouchableOpacity onPress={nextMonth} style={calStyles.navBtn} activeOpacity={0.7}>
          <Text style={calStyles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day labels */}
      <View style={calStyles.dayLabels}>
        {DAY_LABELS.map(l => (
          <Text key={l} style={calStyles.dayLabel}>{l}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <View key={wi} style={calStyles.week}>
          {week.map((d, di) => {
            if (!d) return <View key={di} style={calStyles.emptyCell} />;
            const dStr = toYMD(d);
            const isToday = dStr === todayStr;
            const isSelected = dStr === selectedDay;
            const hasSessions = sessionsByDate.has(dStr);
            return (
              <TouchableOpacity
                key={di}
                style={[
                  calStyles.dayCell,
                  isToday && calStyles.dayCellToday,
                  isSelected && calStyles.dayCellSelected,
                ]}
                onPress={() => setSelectedDay(isSelected ? null : dStr)}
                activeOpacity={0.7}>
                <Text style={[
                  calStyles.dayNumber,
                  isToday && calStyles.dayNumberToday,
                  isSelected && calStyles.dayNumberSelected,
                ]}>
                  {d.getDate()}
                </Text>
                {hasSessions ? (
                  <Text style={calStyles.workoutEmoji}>💪</Text>
                ) : (
                  <View style={calStyles.noWorkoutDot} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Selected day sessions */}
      {selectedDay && (
        <View style={calStyles.dayDetail}>
          <Text style={calStyles.dayDetailTitle}>
            {new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-AR', {
              weekday: 'long', day: 'numeric', month: 'long',
            }).replace(/^\w/, c => c.toUpperCase())}
          </Text>
          {selectedSessions.length === 0 ? (
            <Text style={calStyles.dayDetailEmpty}>Sin entrenamiento este día</Text>
          ) : (
            selectedSessions.map(s => (
              <View key={s.id} style={calStyles.dayDetailRow}>
                <CompactSessionRow session={s} onPress={() => onSessionPress(s)} />
                <TouchableOpacity onPress={() => confirmDelete(s.id)} hitSlop={12} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const calStyles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  navBtn: { padding: 8 },
  navBtnText: { color: colors.text, fontSize: 26, fontWeight: '300' },
  monthTitle: { color: colors.text, fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },

  dayLabels: { flexDirection: 'row', marginBottom: 4 },
  dayLabel: { flex: 1, textAlign: 'center', color: colors.textSecondary, fontSize: 11, fontWeight: '700' },

  week: { flexDirection: 'row', marginBottom: 4 },
  emptyCell: { flex: 1, aspectRatio: 0.85 },
  dayCell: {
    flex: 1,
    aspectRatio: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 4,
    gap: 2,
  },
  dayCellToday: { borderWidth: 1.5, borderColor: colors.accent },
  dayCellSelected: { backgroundColor: colors.accent },
  dayNumber: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  dayNumberToday: { color: colors.accent },
  dayNumberSelected: { color: colors.black, fontWeight: '800' },
  workoutEmoji: { fontSize: 12 },
  noWorkoutDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },

  dayDetail: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  dayDetailTitle: { color: colors.text, fontSize: 14, fontWeight: '700', textTransform: 'capitalize', marginBottom: 4 },
  dayDetailEmpty: { color: colors.textSecondary, fontSize: 13 },
  dayDetailRow: { flexDirection: 'row', alignItems: 'center' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'calendar';

export default function HistoryScreen() {
  const navigation = useNavigation<HistoryNavProp>();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

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
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Historial</Text>
          <Text style={styles.count}>
            {sessions.length} sesión{sessions.length !== 1 ? 'es' : ''}
          </Text>
        </View>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
            activeOpacity={0.7}>
            <Text style={[styles.toggleBtnText, viewMode === 'list' && styles.toggleBtnTextActive]}>≡</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'calendar' && styles.toggleBtnActive]}
            onPress={() => setViewMode('calendar')}
            activeOpacity={0.7}>
            <Text style={[styles.toggleBtnText, viewMode === 'calendar' && styles.toggleBtnTextActive]}>📅</Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'list' ? (
        sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Sin sesiones registradas.</Text>
            <Text style={styles.emptySubText}>Completá tu primera sesión para verla aquí.</Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <SessionRow
                session={item}
                onPress={() => navigation.navigate('SessionDetail', { session: item })}
                onDelete={handleDelete}
              />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        <CalendarView
          sessions={sessions}
          onSessionPress={s => navigation.navigate('SessionDetail', { session: s })}
          onDelete={handleDelete}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  count: { color: colors.textSecondary, fontSize: 14 },

  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 7 },
  toggleBtnActive: { backgroundColor: colors.accent },
  toggleBtnText: { color: colors.textSecondary, fontSize: 16 },
  toggleBtnTextActive: { color: colors.black },

  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },

  row: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLeft: { flex: 1, gap: 3 },
  rowDate: { color: colors.text, fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  rowTime: { color: colors.textSecondary, fontSize: 12 },
  rowStats: { color: colors.accent, fontSize: 12, marginTop: 2 },
  rowPreview: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  rowNotes: { color: colors.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: 2 },

  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8 },
  rowChevron: { color: colors.textSecondary, fontSize: 22, fontWeight: '300' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: colors.textSecondary, fontSize: 16 },

  compactRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 8,
  },
  compactRowLeft: { flex: 1, gap: 2 },
  compactRowTitle: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  compactRowTime: { color: colors.textSecondary, fontSize: 12 },
  compactRowNotes: { color: colors.textSecondary, fontSize: 12, fontStyle: 'italic' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  emptySubText: { color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});
