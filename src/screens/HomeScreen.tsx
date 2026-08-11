import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  FlatList,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';
import { storage } from '../services/storage';
import { useUpdate } from '../context/UpdateContext';
import { useSession } from '../context/SessionContext';
import { downloadAndInstall } from '../services/updater';
import type { WorkoutSession, PlannedSession } from '../types';
import type { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Inicio'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({ sessions }: { sessions: WorkoutSession[] }) {
  const sessionDates = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach(s => set.add(s.date));
    return set;
  }, [sessions]);

  // Build a 5-week grid ending today, Mon-Sun
  const today = new Date();
  // Find last Monday (or today if Monday)
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - daysToLastMonday);
  lastMonday.setHours(0, 0, 0, 0);

  // Go back 4 more weeks
  const startDate = new Date(lastMonday);
  startDate.setDate(lastMonday.getDate() - 28); // 4 weeks back → 5 weeks total

  const weeks: Date[][] = [];
  const cursor = new Date(startDate);
  for (let w = 0; w < 5; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  function toYMD(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  const todayStr = toYMD(today);
  const totalWorkouts = sessionDates.size;
  // Current streak: count consecutive days back from today with at least one session
  let streak = 0;
  const c = new Date(today);
  while (sessionDates.has(toYMD(c))) {
    streak++;
    c.setDate(c.getDate() - 1);
  }

  return (
    <View style={calStyles.container}>
      <View style={calStyles.header}>
        <Text style={calStyles.title}>Actividad</Text>
        <View style={calStyles.statsRow}>
          <View style={calStyles.statChip}>
            <Text style={calStyles.statVal}>{totalWorkouts}</Text>
            <Text style={calStyles.statLbl}>sesiones</Text>
          </View>
          {streak > 0 && (
            <View style={calStyles.statChip}>
              <Text style={[calStyles.statVal, { color: colors.accent }]}>{streak}</Text>
              <Text style={calStyles.statLbl}>días seguidos</Text>
            </View>
          )}
        </View>
      </View>

      {/* Day labels */}
      <View style={calStyles.dayLabels}>
        {DAY_LABELS.map(l => (
          <Text key={l} style={calStyles.dayLabel}>{l}</Text>
        ))}
      </View>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={calStyles.week}>
          {week.map((d, di) => {
            const dStr = toYMD(d);
            const isToday = dStr === todayStr;
            const hasSession = sessionDates.has(dStr);
            const isFuture = d > today;
            return (
              <View
                key={di}
                style={[
                  calStyles.dot,
                  hasSession && calStyles.dotActive,
                  isToday && !hasSession && calStyles.dotToday,
                  isFuture && calStyles.dotFuture,
                ]}>
                {isToday && !hasSession && <View style={calStyles.todayInner} />}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statChip: { alignItems: 'flex-end' },
  statVal: { color: colors.text, fontSize: 16, fontWeight: '800' },
  statLbl: { color: colors.textSecondary, fontSize: 10 },

  dayLabels: { flexDirection: 'row', paddingHorizontal: 2 },
  dayLabel: { flex: 1, textAlign: 'center', color: colors.textSecondary, fontSize: 10, fontWeight: '700' },

  week: { flexDirection: 'row', gap: 3 },
  dot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { backgroundColor: colors.accent },
  dotToday: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.accent },
  dotFuture: { opacity: 0.3 },
  todayInner: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
});

// ─── Exercise Progress Chart ───────────────────────────────────────────────────

interface ExerciseDataPoint {
  date: string;
  seriesCount: number;
  avgReps: number | null;
  avgWeight: number | null;
  maxWeight: number | null;
}

function buildExerciseData(sessions: WorkoutSession[], exerciseName: string): ExerciseDataPoint[] {
  const points: ExerciseDataPoint[] = [];
  // Sort sessions oldest-first for chart
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sorted) {
    const ex = s.exercises.find(e => e.exerciseName === exerciseName);
    if (!ex) continue;
    const sets = ex.sets.filter(s => s.reps > 0);
    if (sets.length === 0) continue;
    const weights = sets.map(s => s.weight).filter((w): w is number => w !== undefined);
    points.push({
      date: s.date,
      seriesCount: sets.length,
      avgReps: sets.length > 0 ? Math.round(sets.reduce((a, s) => a + s.reps, 0) / sets.length) : null,
      avgWeight: weights.length > 0 ? Math.round((weights.reduce((a, w) => a + w, 0) / weights.length) * 10) / 10 : null,
      maxWeight: weights.length > 0 ? Math.max(...weights) : null,
    });
  }
  return points.slice(-15); // Last 15 sessions
}

const LINE_COLORS = {
  series: '#64B5F6',
  avgReps: '#81C784',
  avgWeight: '#FFD54F',
  maxWeight: colors.accent,
};

function ProgressChart({ sessions }: { sessions: WorkoutSession[] }) {
  const [chartWidth, setChartWidth] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [showExPicker, setShowExPicker] = useState(false);

  const allExerciseNames = useMemo(() => {
    const names = new Set<string>();
    sessions.forEach(s => s.exercises.forEach(ex => names.add(ex.exerciseName)));
    return Array.from(names).sort();
  }, [sessions]);

  const data = useMemo(() => {
    if (!selectedExercise) return [];
    return buildExerciseData(sessions, selectedExercise);
  }, [sessions, selectedExercise]);

  const CHART_H = 140;
  const PADDING = { left: 0, right: 0, top: 10, bottom: 0 };

  function normalize(values: (number | null)[], chartHeight: number): (number | null)[] {
    const nums = values.filter((v): v is number => v !== null);
    if (nums.length === 0) return values.map(() => null);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min || 1;
    return values.map(v => v === null ? null : chartHeight - PADDING.top - ((v - min) / range) * (chartHeight - PADDING.top - PADDING.bottom));
  }

  function buildPath(xs: number[], ys: (number | null)[]): string {
    let d = '';
    let started = false;
    for (let i = 0; i < xs.length; i++) {
      if (ys[i] === null) { started = false; continue; }
      if (!started) { d += `M ${xs[i]} ${ys[i]} `; started = true; }
      else { d += `L ${xs[i]} ${ys[i]} `; }
    }
    return d;
  }

  const hasData = data.length >= 2;

  let seriesPath = '', avgRepsPath = '', avgWeightPath = '', maxWeightPath = '';
  let seriesPoints: { x: number; y: number }[] = [];
  let avgWeightPoints: { x: number; y: number }[] = [];
  let avgRepsPoints: { x: number; y: number }[] = [];
  let maxWeightPoints: { x: number; y: number }[] = [];

  if (hasData && chartWidth > 0) {
    const n = data.length;
    const xs = data.map((_, i) => PADDING.left + (i / (n - 1)) * (chartWidth - PADDING.left - PADDING.right));
    const nyS = normalize(data.map(d => d.seriesCount), CHART_H);
    const nyAR = normalize(data.map(d => d.avgReps), CHART_H);
    const nyAW = normalize(data.map(d => d.avgWeight), CHART_H);
    const nyMW = normalize(data.map(d => d.maxWeight), CHART_H);

    seriesPath = buildPath(xs, nyS);
    avgRepsPath = buildPath(xs, nyAR);
    avgWeightPath = buildPath(xs, nyAW);
    maxWeightPath = buildPath(xs, nyMW);

    seriesPoints = xs.map((x, i) => ({ x, y: nyS[i] ?? -1 })).filter(p => p.y >= 0);
    avgRepsPoints = xs.map((x, i) => ({ x, y: nyAR[i] ?? -1 })).filter(p => p.y >= 0);
    avgWeightPoints = xs.map((x, i) => ({ x, y: nyAW[i] ?? -1 })).filter(p => p.y >= 0);
    maxWeightPoints = xs.map((x, i) => ({ x, y: nyMW[i] ?? -1 })).filter(p => p.y >= 0);
  }

  // Last data point values for legend
  const last = data[data.length - 1];

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.header}>
        <Text style={chartStyles.title}>Progreso</Text>
        <TouchableOpacity
          style={chartStyles.exSelector}
          onPress={() => setShowExPicker(true)}
          activeOpacity={0.7}>
          <Text style={chartStyles.exSelectorText} numberOfLines={1}>
            {selectedExercise ?? 'Elegir ejercicio'}
          </Text>
          <Text style={chartStyles.exSelectorChevron}>›</Text>
        </TouchableOpacity>
      </View>

      {!selectedExercise ? (
        <View style={chartStyles.emptyState}>
          <Text style={chartStyles.emptyText}>Seleccioná un ejercicio para ver su progreso</Text>
        </View>
      ) : !hasData ? (
        <View style={chartStyles.emptyState}>
          <Text style={chartStyles.emptyText}>No hay suficientes datos aún para {selectedExercise}</Text>
        </View>
      ) : (
        <>
          {/* Legend */}
          <View style={chartStyles.legend}>
            <View style={chartStyles.legendItem}>
              <View style={[chartStyles.legendDot, { backgroundColor: LINE_COLORS.series }]} />
              <Text style={chartStyles.legendLabel}>Series{last ? ` (${last.seriesCount})` : ''}</Text>
            </View>
            <View style={chartStyles.legendItem}>
              <View style={[chartStyles.legendDot, { backgroundColor: LINE_COLORS.avgReps }]} />
              <Text style={chartStyles.legendLabel}>Rep prom{last?.avgReps ? ` (${last.avgReps})` : ''}</Text>
            </View>
            {last?.avgWeight !== null && (
              <View style={chartStyles.legendItem}>
                <View style={[chartStyles.legendDot, { backgroundColor: LINE_COLORS.avgWeight }]} />
                <Text style={chartStyles.legendLabel}>Peso prom{last?.avgWeight ? ` (${last.avgWeight}kg)` : ''}</Text>
              </View>
            )}
            {last?.maxWeight !== null && (
              <View style={chartStyles.legendItem}>
                <View style={[chartStyles.legendDot, { backgroundColor: LINE_COLORS.maxWeight }]} />
                <Text style={chartStyles.legendLabel}>Peso máx{last?.maxWeight ? ` (${last.maxWeight}kg)` : ''}</Text>
              </View>
            )}
          </View>

          {/* Chart */}
          <View
            style={[chartStyles.chartArea, { height: CHART_H }]}
            onLayout={(e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width)}>
            {chartWidth > 0 && (
              <Svg width={chartWidth} height={CHART_H}>
                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map(f => (
                  <Line
                    key={f}
                    x1={0} y1={CHART_H * f}
                    x2={chartWidth} y2={CHART_H * f}
                    stroke={colors.border}
                    strokeWidth={0.5}
                    strokeDasharray="3,3"
                  />
                ))}

                {/* Lines */}
                {seriesPath ? <Path d={seriesPath} stroke={LINE_COLORS.series} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
                {avgRepsPath ? <Path d={avgRepsPath} stroke={LINE_COLORS.avgReps} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
                {avgWeightPath ? <Path d={avgWeightPath} stroke={LINE_COLORS.avgWeight} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
                {maxWeightPath ? <Path d={maxWeightPath} stroke={LINE_COLORS.maxWeight} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}

                {/* Dots - only max weight (most important) */}
                {maxWeightPoints.map((p, i) => (
                  <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={LINE_COLORS.maxWeight} />
                ))}
              </Svg>
            )}
          </View>

          {/* X axis labels: first and last date */}
          {data.length >= 2 && (
            <View style={chartStyles.xAxis}>
              <Text style={chartStyles.xLabel}>{data[0].date.slice(5).replace('-', '/')}</Text>
              <Text style={chartStyles.xLabelRight}>{data[data.length - 1].date.slice(5).replace('-', '/')}</Text>
            </View>
          )}
        </>
      )}

      {/* Exercise picker modal */}
      <Modal visible={showExPicker} animationType="slide" transparent onRequestClose={() => setShowExPicker(false)}>
        <View style={chartStyles.pickerOverlay}>
          <View style={chartStyles.pickerBox}>
            <Text style={chartStyles.pickerTitle}>Elegir ejercicio</Text>
            <FlatList
              data={allExerciseNames}
              keyExtractor={item => item}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[chartStyles.pickerRow, selectedExercise === item && chartStyles.pickerRowActive]}
                  onPress={() => { setSelectedExercise(item); setShowExPicker(false); }}
                  activeOpacity={0.7}>
                  <Text style={[chartStyles.pickerRowText, selectedExercise === item && chartStyles.pickerRowTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={chartStyles.pickerEmpty}>Sin ejercicios registrados</Text>}
            />
            <TouchableOpacity style={chartStyles.pickerCancel} onPress={() => setShowExPicker(false)}>
              <Text style={chartStyles.pickerCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  exSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 180,
    gap: 4,
  },
  exSelectorText: { color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 },
  exSelectorChevron: { color: colors.textSecondary, fontSize: 14 },

  emptyState: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: colors.textSecondary, fontSize: 11 },

  chartArea: { width: '100%' },

  xAxis: { flexDirection: 'row', justifyContent: 'space-between' },
  xLabel: { color: colors.textSecondary, fontSize: 10 },
  xLabelRight: { color: colors.textSecondary, fontSize: 10 },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  pickerBox: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  pickerTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 14 },
  pickerRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerRowActive: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 8 },
  pickerRowText: { color: colors.text, fontSize: 14 },
  pickerRowTextActive: { color: colors.accent, fontWeight: '700' },
  pickerEmpty: { color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 },
  pickerCancel: { marginTop: 14, alignItems: 'center', paddingVertical: 12 },
  pickerCancelText: { color: colors.textSecondary, fontSize: 15 },
});

// ─── Recent session card ───────────────────────────────────────────────────────

function SessionCard({ session, onPress }: { session: WorkoutSession; onPress: () => void }) {
  const date = new Date(session.startTime ?? session.date);
  const dateStr = date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardDate}>{dateStr}</Text>
        <Text style={styles.cardTitle}>
          {session.exercises.length} ejercicio{session.exercises.length !== 1 ? 's' : ''}
          {'  ·  '}
          {totalSets} serie{totalSets !== 1 ? 's' : ''}
        </Text>
        {session.estimatedKcal !== undefined && (
          <Text style={styles.cardKcal}>{session.estimatedKcal} kcal</Text>
        )}
        {session.notes ? <Text style={styles.cardNotes}>"{session.notes}"</Text> : null}
      </View>
      <Text style={styles.cardChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Planned session card ──────────────────────────────────────────────────────

function PlannedSessionCard({
  session,
  onPress,
  onStart,
}: {
  session: PlannedSession;
  onPress: () => void;
  onStart: () => void;
}) {
  const lastUsedStr = session.lastUsed
    ? new Date(session.lastUsed).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    : null;

  return (
    <TouchableOpacity style={styles.plannedCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.plannedCardInfo}>
        <Text style={styles.plannedCardName}>{session.name || 'Sesión sin nombre'}</Text>
        <Text style={styles.plannedCardMeta}>
          {session.exercises.length} ejercicio{session.exercises.length !== 1 ? 's' : ''}
          {session.exercises.length > 0
            ? '  ·  ' + session.exercises.slice(0, 2).map(e => e.exerciseName).join(', ') +
              (session.exercises.length > 2 ? '...' : '')
            : ''}
        </Text>
        {lastUsedStr && (
          <Text style={styles.plannedCardLastUsed}>Último uso: {lastUsedStr}</Text>
        )}
      </View>
      <TouchableOpacity style={styles.plannedStartBtn} onPress={onStart} activeOpacity={0.8}>
        <Text style={styles.plannedStartBtnText}>Empezar</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Plan group card ───────────────────────────────────────────────────────────

function PlanGroupCard({
  groupName,
  days,
  onPressDay,
  onStartDay,
}: {
  groupName: string;
  days: PlannedSession[];
  onPressDay: (s: PlannedSession) => void;
  onStartDay: (s: PlannedSession) => void;
}) {
  const lastUsedAll = days
    .map(d => d.lastUsed)
    .filter(Boolean)
    .sort()
    .reverse()[0];
  const lastUsedStr = lastUsedAll
    ? new Date(lastUsedAll).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    : null;

  return (
    <View style={styles.groupCard}>
      {/* Group header */}
      <View style={styles.groupHeader}>
        <View style={styles.groupHeaderLeft}>
          <View style={styles.groupBadge}>
            <Text style={styles.groupBadgeText}>Plan</Text>
          </View>
          <Text style={styles.groupName}>{groupName}</Text>
        </View>
        {lastUsedStr && (
          <Text style={styles.groupLastUsed}>Último uso: {lastUsedStr}</Text>
        )}
      </View>

      {/* Day rows */}
      {days.map((day, idx) => {
        const dayLastUsed = day.lastUsed
          ? new Date(day.lastUsed).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
          : null;
        return (
          <View key={day.id} style={[styles.groupDayRow, idx < days.length - 1 && styles.groupDayRowBorder]}>
            <TouchableOpacity
              style={styles.groupDayInfo}
              onPress={() => onPressDay(day)}
              activeOpacity={0.7}>
              <Text style={styles.groupDayName}>{day.name || `Día ${idx + 1}`}</Text>
              <Text style={styles.groupDayMeta}>
                {day.exercises.length} ejercicio{day.exercises.length !== 1 ? 's' : ''}
                {day.exercises.length > 0
                  ? '  ·  ' + day.exercises.slice(0, 2).map(e => e.exerciseName).join(', ') +
                    (day.exercises.length > 2 ? '...' : '')
                  : ''}
              </Text>
              {dayLastUsed && (
                <Text style={styles.groupDayLastUsed}>Último: {dayLastUsed}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.plannedStartBtn}
              onPress={() => onStartDay(day)}
              activeOpacity={0.8}>
              <Text style={styles.plannedStartBtnText}>Empezar</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const { sessionLoaded, sessionActive } = useSession();
  const hasSession = sessionLoaded || sessionActive;
  const [allSessions, setAllSessions] = useState<WorkoutSession[]>([]);
  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[]>([]);
  const [showStartModal, setShowStartModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadPct, setDownloadPct] = useState(0);
  const { updateInfo, clearUpdate } = useUpdate();

  const recentSessions = allSessions.slice(0, 5);

  // Split planned sessions into groups (cloud multi-day) and standalones
  const { groups, standalones } = useMemo(() => {
    const groupMap = new Map<string, { name: string; days: PlannedSession[] }>();
    const standaloneList: PlannedSession[] = [];

    for (const s of plannedSessions) {
      if (s.planGroupId && s.planGroupName) {
        if (!groupMap.has(s.planGroupId)) {
          groupMap.set(s.planGroupId, { name: s.planGroupName, days: [] });
        }
        groupMap.get(s.planGroupId)!.days.push(s);
      } else {
        standaloneList.push(s);
      }
    }

    // Sort days within each group by name
    for (const g of groupMap.values()) {
      g.days.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'));
    }

    return {
      groups: Array.from(groupMap.entries()).map(([id, g]) => ({ id, ...g })),
      standalones: standaloneList,
    };
  }, [plannedSessions]);

  useFocusEffect(
    useCallback(() => {
      storage.getSessions().then(setAllSessions);
      storage.getPlannedSessions().then(all => {
        const active = all
          .filter(p => p.active !== false)
          .sort((a, b) => {
            if (a.lastUsed && b.lastUsed) return b.lastUsed.localeCompare(a.lastUsed);
            if (a.lastUsed) return -1;
            if (b.lastUsed) return 1;
            return b.createdAt.localeCompare(a.createdAt);
          });
        setPlannedSessions(active);
      });
    }, []),
  );

  function handleUpdate() {
    if (!updateInfo) return;
    Alert.alert(
      'Nueva versión disponible',
      `¿Descargar la actualización?${updateInfo.changelog ? `\n\n${updateInfo.changelog}` : ''}`,
      [
        { text: 'Ahora no', style: 'cancel', onPress: clearUpdate },
        {
          text: 'Descargar',
          onPress: async () => {
            clearUpdate();
            setDownloadPct(0);
            setDownloading(true);
            try {
              await downloadAndInstall(updateInfo.url, pct => setDownloadPct(pct));
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Error desconocido';
              Alert.alert('Error al descargar', msg);
            } finally {
              setDownloading(false);
            }
          },
        },
      ],
    );
  }

  function handleNewSession() {
    setShowStartModal(true);
  }

  async function startEmpty() {
    setShowStartModal(false);
    await storage.setPendingTemplate(null);
    navigation.navigate('Sesión');
  }

  async function startPlannedSession(session: PlannedSession) {
    setShowStartModal(false);
    await storage.savePlannedSession({ ...session, lastUsed: new Date().toISOString() });
    const template = {
      id: session.id,
      name: session.name || 'Sesión',
      exercises: session.exercises.map(e => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        targetSets: e.setTargets?.length ?? e.targetSets ?? 3,
        targetReps: e.targetReps || '',
        targetWeight: e.targetWeight,
        setTargets: e.setTargets,
        bloque: e.bloque,
      })),
    };
    await storage.setPendingTemplate(template);
    navigation.navigate('Sesión');
  }

  function editPlannedSession(session: PlannedSession) {
    navigation.navigate('PlanSession', { session });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>alChim</Text>
          <Text style={styles.subtitle}>Tu diario de entrenamiento</Text>
        </View>

        {/* Update banner */}
        {updateInfo && (
          <TouchableOpacity style={styles.updateBanner} onPress={handleUpdate} activeOpacity={0.8}>
            <Text style={styles.updateBannerText}>Nueva versión disponible — tap para actualizar</Text>
          </TouchableOpacity>
        )}

        {/* Primary actions */}
        <View style={styles.actions}>
          {hasSession ? (
            <TouchableOpacity style={styles.newSessionBtn} onPress={() => navigation.navigate('Sesión')} activeOpacity={0.8}>
              <Text style={styles.newSessionBtnText}>⚡ Ir a sesión activa</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.newSessionBtn} onPress={handleNewSession} activeOpacity={0.8}>
              <Text style={styles.newSessionBtnText}>+ Nueva sesión</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Planned sessions */}
        {(groups.length > 0 || standalones.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sesiones planificadas</Text>
            <View style={styles.sectionContent}>
              {groups.map(g => (
                <PlanGroupCard
                  key={g.id}
                  groupName={g.name}
                  days={g.days}
                  onPressDay={editPlannedSession}
                  onStartDay={startPlannedSession}
                />
              ))}
              {standalones.map(s => (
                <PlannedSessionCard
                  key={s.id}
                  session={s}
                  onPress={() => editPlannedSession(s)}
                  onStart={() => startPlannedSession(s)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Progress section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progreso</Text>
          <View style={styles.sectionContent}>
            <MiniCalendar sessions={allSessions} />
            <ProgressChart sessions={allSessions} />
          </View>
        </View>

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sesiones recientes</Text>
            <View style={styles.sectionContent}>
              {recentSessions.map(item => (
                <SessionCard
                  key={item.id}
                  session={item}
                  onPress={() => navigation.navigate('SessionDetail', { session: item })}
                />
              ))}
            </View>
          </View>
        )}

        {allSessions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Sin sesiones todavía.</Text>
            <Text style={styles.emptySubText}>¡Empezá tu primera sesión de entrenamiento!</Text>
          </View>
        )}
      </ScrollView>

      {/* Start session modal */}
      <Modal visible={showStartModal} animationType="slide" transparent onRequestClose={() => setShowStartModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nueva sesión</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.startOption} onPress={startEmpty} activeOpacity={0.8}>
                <Text style={styles.startOptionName}>Sesión vacía</Text>
                <Text style={styles.startOptionMeta}>Sin plan previo</Text>
              </TouchableOpacity>

              {/* Plan groups */}
              {groups.map(g => (
                <View key={g.id} style={styles.modalGroup}>
                  <View style={styles.modalGroupHeader}>
                    <View style={styles.groupBadge}>
                      <Text style={styles.groupBadgeText}>Plan</Text>
                    </View>
                    <Text style={styles.modalGroupName}>{g.name}</Text>
                  </View>
                  {g.days.map(day => (
                    <TouchableOpacity
                      key={day.id}
                      style={styles.modalGroupDay}
                      onPress={() => startPlannedSession(day)}
                      activeOpacity={0.8}>
                      <Text style={styles.modalGroupDayName}>{day.name || 'Día'}</Text>
                      <Text style={styles.startOptionMeta}>
                        {day.exercises.length} ejercicio{day.exercises.length !== 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}

              {/* Standalone planned sessions */}
              {standalones.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.startOption, styles.startOptionPlanned]}
                  onPress={() => startPlannedSession(s)}
                  activeOpacity={0.8}>
                  <Text style={styles.startOptionName}>{s.name || 'Sesión sin nombre'}</Text>
                  <Text style={styles.startOptionMeta}>
                    {s.exercises.length} ejercicio{s.exercises.length !== 1 ? 's' : ''}
                    {s.exercises.length > 0
                      ? '  ·  ' + s.exercises.slice(0, 2).map(e => e.exerciseName).join(', ') +
                        (s.exercises.length > 2 ? '...' : '')
                      : ''}
                  </Text>
                </TouchableOpacity>
              ))}

              <View style={styles.modalDivider} />
              <TouchableOpacity
                style={styles.startOptionPlan}
                onPress={() => { setShowStartModal(false); navigation.navigate('PlanSession', undefined); }}
                activeOpacity={0.8}>
                <Text style={styles.startOptionPlanText}>Planificar sesión</Text>
                <Text style={styles.startOptionMeta}>Crear o importar un nuevo plan</Text>
              </TouchableOpacity>
            </ScrollView>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowStartModal(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Download modal */}
      <Modal visible={downloading} transparent animationType="fade">
        <View style={styles.dlOverlay}>
          <View style={styles.dlBox}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.dlTitle}>Descargando actualización...</Text>
            <View style={styles.dlBarBg}>
              <View style={[styles.dlBarFill, { width: `${downloadPct}%` }]} />
            </View>
            <Text style={styles.dlPct}>{downloadPct}%</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 32 },

  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
  title: { color: colors.accent, fontSize: 30, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },

  updateBanner: {
    backgroundColor: '#1a2a1a',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  updateBannerText: { color: colors.success, fontSize: 13, fontWeight: '600' },

  actions: { paddingHorizontal: 20, marginBottom: 28 },
  newSessionBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  newSessionBtnText: { color: colors.black, fontSize: 15, fontWeight: '800' },

  section: { marginBottom: 28 },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionContent: { paddingHorizontal: 20, gap: 10 },

  // Plan group card
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  groupBadge: {
    backgroundColor: colors.accent + '20',
    borderWidth: 1,
    borderColor: colors.accent + '60',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  groupBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  groupLastUsed: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  groupDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  groupDayRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupDayInfo: {
    flex: 1,
  },
  groupDayName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  groupDayMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  groupDayLastUsed: {
    color: colors.accent,
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
  },

  // Modal group styles
  modalGroup: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent + '60',
    marginBottom: 10,
    overflow: 'hidden',
  },
  modalGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalGroupName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  modalGroupDay: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '80',
  },
  modalGroupDayName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

  // Planned
  plannedCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  plannedCardInfo: { flex: 1 },
  plannedCardName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  plannedCardMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  plannedCardLastUsed: { color: colors.accent, fontSize: 11, marginTop: 4, fontWeight: '600' },
  plannedStartBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  plannedStartBtnText: { color: colors.black, fontSize: 13, fontWeight: '700' },

  // Recent sessions
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: { flex: 1, gap: 3 },
  cardDate: { color: colors.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  cardKcal: { color: colors.textSecondary, fontSize: 12 },
  cardNotes: { color: colors.textSecondary, fontSize: 12, fontStyle: 'italic' },
  cardChevron: { color: colors.textSecondary, fontSize: 22, paddingLeft: 8 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 32 },
  emptyText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  emptySubText: { color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center' },

  // Start modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '70%',
  },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  startOption: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  startOptionPlanned: { borderColor: colors.accent },
  startOptionName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  startOptionMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
  modalDivider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  startOptionPlan: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginBottom: 10,
  },
  startOptionPlanText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  modalCancelText: { color: colors.textSecondary, fontSize: 15 },

  // Download modal
  dlOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  dlBox: { backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 28, width: '100%', alignItems: 'center', gap: 16 },
  dlTitle: { color: colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  dlBarBg: { width: '100%', height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  dlBarFill: { height: 8, backgroundColor: colors.accent, borderRadius: 4 },
  dlPct: { color: colors.accent, fontSize: 14, fontWeight: '700' },
});
