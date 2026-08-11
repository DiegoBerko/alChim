import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { storage } from '../services/storage';
import { estimateKcalForExercise } from '../services/calories';
import { useSession } from '../context/SessionContext';
import type { EffortLevel, Exercise, ExerciseSet, SessionExercise, SetMode, UserProfile } from '../types';

// ─── Local state types ────────────────────────────────────────────────────────

interface ActiveSet {
  reps: string;
  weight: string;
  effort: EffortLevel;
  feedback: string;
  mode: 'reps' | 'seconds';
}

interface ActiveExercise {
  exerciseId: string;
  exerciseName: string;
  met: number;
  sets: ActiveSet[];
  feedback: string;
  effort?: EffortLevel;
  showDetails: boolean;  // exercise-level effort/notes panel
  done: boolean;
  completionOrder?: number;
  bloque?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EFFORTS: EffortLevel[] = ['fácil', 'normal', 'intenso', 'muy_intenso'];
const EFFORT_LABELS: Record<EffortLevel, string> = {
  fácil: 'Fácil', normal: 'Normal', intenso: 'Intenso', muy_intenso: 'Máx',
};
const EFFORT_COLORS: Record<EffortLevel, string> = {
  fácil: '#4CAF50', normal: colors.accent, intenso: '#FF9800', muy_intenso: '#F44336',
};

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function newSet(prevWeight?: string, mode: 'reps' | 'seconds' = 'reps'): ActiveSet {
  return { reps: '', weight: prevWeight ?? '', effort: 'normal', feedback: '', mode };
}

// ─── Compact set row ──────────────────────────────────────────────────────────

function CompactSetRow({
  setIdx,
  set,
  isOnly,
  onUpdate,
  onRemove,
}: {
  setIdx: number;
  set: ActiveSet;
  isOnly: boolean;
  onUpdate: (u: Partial<ActiveSet>) => void;
  onRemove: () => void;
}) {
  function cycleEffort() {
    const idx = EFFORTS.indexOf(set.effort);
    onUpdate({ effort: EFFORTS[(idx + 1) % EFFORTS.length] });
  }

  if (set.mode === 'seconds') {
    return (
      <View style={styles.setRow}>
        <Text style={styles.setNum}>S{setIdx + 1}</Text>
        <TextInput
          style={styles.repsInput}
          value={set.reps}
          onChangeText={t => onUpdate({ reps: t })}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="done"
          selectTextOnFocus
        />
        <Text style={styles.kgLabel}>seg</Text>
        <TouchableOpacity onPress={cycleEffort} style={[styles.effortPill, { borderColor: EFFORT_COLORS[set.effort] }]} activeOpacity={0.7}>
          <Text style={[styles.effortPillText, { color: EFFORT_COLORS[set.effort] }]}>{EFFORT_LABELS[set.effort]}</Text>
        </TouchableOpacity>
        {!isOnly ? (
          <TouchableOpacity onPress={onRemove} hitSlop={10} style={styles.removeSetBtn}>
            <Text style={styles.removeSetIcon}>✕</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.removeSetPlaceholder} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.setRow}>
      <Text style={styles.setNum}>S{setIdx + 1}</Text>

      <TextInput
        style={styles.repsInput}
        value={set.reps}
        onChangeText={t => onUpdate({ reps: t })}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={colors.textSecondary}
        returnKeyType="done"
        selectTextOnFocus
      />

      <Text style={styles.setSep}>×</Text>

      <TextInput
        style={styles.weightInput}
        value={set.weight}
        onChangeText={t => onUpdate({ weight: t })}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.textSecondary}
        returnKeyType="done"
        selectTextOnFocus
      />

      <Text style={styles.kgLabel}>kg</Text>

      <TouchableOpacity
        onPress={cycleEffort}
        style={[styles.effortPill, { borderColor: EFFORT_COLORS[set.effort] }]}
        activeOpacity={0.7}>
        <Text style={[styles.effortPillText, { color: EFFORT_COLORS[set.effort] }]}>
          {EFFORT_LABELS[set.effort]}
        </Text>
      </TouchableOpacity>

      {!isOnly ? (
        <TouchableOpacity onPress={onRemove} hitSlop={10} style={styles.removeSetBtn}>
          <Text style={styles.removeSetIcon}>✕</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.removeSetPlaceholder} />
      )}
    </View>
  );
}

// ─── Effort chips (for exercise-level panel) ──────────────────────────────────

function EffortChips({
  selected,
  onSelect,
}: {
  selected?: EffortLevel;
  onSelect: (e: EffortLevel | undefined) => void;
}) {
  return (
    <View style={styles.effortRow}>
      {EFFORTS.map(e => {
        const active = selected === e;
        return (
          <TouchableOpacity
            key={e}
            style={[styles.effortChip, active && { backgroundColor: EFFORT_COLORS[e], borderColor: EFFORT_COLORS[e] }]}
            onPress={() => onSelect(active ? undefined : e)}
            activeOpacity={0.7}>
            <Text style={[styles.effortChipText, active && styles.effortChipTextActive]}>
              {EFFORT_LABELS[e]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({
  ex,
  onToggleDone,
  onToggleDetails,
  onRemove,
  onUpdateExercise,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
}: {
  ex: ActiveExercise;
  onToggleDone: () => void;
  onToggleDetails: () => void;
  onRemove: () => void;
  onUpdateExercise: (u: Partial<ActiveExercise>) => void;
  onUpdateSet: (setIdx: number, u: Partial<ActiveSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setIdx: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);

  // Auto-collapse when marked as done
  useEffect(() => {
    if (ex.done) setCollapsed(true);
  }, [ex.done]);

  // Build collapsed summary
  const summaryParts = ex.sets.map(s =>
    s.reps ? (s.mode === 'seconds' ? `${s.reps}s` : (s.weight ? `${s.reps}×${s.weight}` : s.reps)) : '—',
  );
  const hasData = ex.sets.some(s => s.reps);
  const summaryStr = hasData ? summaryParts.join(' / ') : null;

  return (
    <View style={[styles.exCard, ex.done && styles.exCardDone]}>
      {/* Header — tap to collapse/expand */}
      <TouchableOpacity style={styles.exHeader} onPress={() => setCollapsed(v => !v)} activeOpacity={0.7}>
        <View style={styles.exHeaderLeft}>
          {ex.done && <Text style={styles.doneCheck}>✓  </Text>}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.exName, ex.done && styles.exNameDone]} numberOfLines={1}>
              {ex.exerciseName}
            </Text>
            {collapsed && (
              <Text style={styles.setSummaryText} numberOfLines={1}>
                {ex.sets.length} serie{ex.sets.length !== 1 ? 's' : ''}
                {summaryStr ? `  ·  ${summaryStr}` : ''}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.exHeaderRight}>
          <TouchableOpacity
            onPress={onToggleDone}
            hitSlop={8}
            style={[styles.doneBtn, ex.done && styles.doneBtnActive]}>
            <Text style={[styles.doneBtnText, ex.done && styles.doneBtnTextActive]}>
              {ex.done ? '✓' : '○'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemove} hitSlop={10}>
            <Text style={styles.removeExText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.chevron}>{collapsed ? '▼' : '▲'}</Text>
        </View>
      </TouchableOpacity>

      {!collapsed && (
        <>
          {/* Series compactas */}
          <View style={styles.setsContainer}>
            {ex.sets.map((set, setIdx) => (
              <CompactSetRow
                key={setIdx}
                setIdx={setIdx}
                set={set}
                isOnly={ex.sets.length === 1}
                onUpdate={u => onUpdateSet(setIdx, u)}
                onRemove={() => onRemoveSet(setIdx)}
              />
            ))}
          </View>

          {/* Footer */}
          <View style={styles.exFooter}>
            <TouchableOpacity onPress={onAddSet} style={styles.addSetBtn} activeOpacity={0.7}>
              <Text style={styles.addSetBtnText}>+ Serie</Text>
            </TouchableOpacity>
            {!ex.done && (
              <TouchableOpacity onPress={onToggleDetails} style={styles.detailsToggleBtn} activeOpacity={0.7}>
                <Text style={styles.detailsToggleBtnText}>
                  {ex.effort
                    ? `● ${EFFORT_LABELS[ex.effort]}${ex.feedback ? ' · nota' : ''}`
                    : ex.feedback ? 'nota ↓' : 'esfuerzo · notas ›'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Panel de detalles */}
          {ex.showDetails && !ex.done && (
            <View style={styles.detailsPanel}>
              <Text style={styles.detailsPanelLabel}>ESFUERZO GENERAL</Text>
              <EffortChips selected={ex.effort} onSelect={e => onUpdateExercise({ effort: e })} />
              <TextInput
                style={styles.exNotesInput}
                value={ex.feedback}
                onChangeText={t => onUpdateExercise({ feedback: t })}
                placeholder="Notas del ejercicio..."
                placeholderTextColor={colors.textSecondary}
                multiline
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ActiveSessionScreen() {
  const { setSessionLoaded, setSessionActive } = useSession();

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const [exercises, setExercises] = useState<ActiveExercise[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState('');
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimestampRef = useRef<number | null>(null);
  const accumulatedSecondsRef = useRef<number>(0);
  const pendingPlanIdRef = useRef<string | null>(null);
  const doneCounterRef = useRef<number>(0);

  useFocusEffect(
    useCallback(() => {
      storage.getProfile().then(setProfile);
      storage.getExercises().then(async allEx => {
        setAllExercises(allEx);
        if (!sessionReady) {
          const template = await storage.getPendingTemplate();
          if (template) {
            await storage.setPendingTemplate(null);
            pendingPlanIdRef.current = template.id;
            const preloaded: ActiveExercise[] = template.exercises
              .map(te => {
                const libEx = allEx.find(e => e.id === te.exerciseId);
                if (!libEx) return null;
                let sets: ActiveSet[];
                if (te.setTargets && te.setTargets.length > 0) {
                  sets = te.setTargets.map(st => ({
                    reps: st.targetReps,
                    weight: st.targetWeight !== undefined ? String(st.targetWeight) : '',
                    effort: 'normal' as EffortLevel,
                    feedback: '',
                    mode: st.mode ?? 'reps',
                  }));
                } else {
                  const numSets = te.targetSets > 0 ? te.targetSets : 3;
                  const defaultWeight = te.targetWeight !== undefined ? String(te.targetWeight) : undefined;
                  sets = Array.from({ length: numSets }, () => newSet(defaultWeight, 'reps'));
                }
                return {
                  exerciseId: libEx.id,
                  exerciseName: libEx.name,
                  met: libEx.met,
                  sets,
                  feedback: '',
                  effort: undefined,
                  showDetails: false,
                  done: false,
                  bloque: te.bloque,
                } as ActiveExercise;
              })
              .filter((e): e is ActiveExercise => e !== null);
            setExercises(preloaded);
            setSessionReady(true);
            setSessionLoaded(true);
          }
        }
      });
    }, [sessionReady]),
  );

  // Timer — timestamp-based so it keeps ticking even when screen is off
  useEffect(() => {
    if (sessionStarted && !sessionPaused) {
      timerRef.current = setInterval(() => {
        if (resumeTimestampRef.current !== null) {
          const total = accumulatedSecondsRef.current + (Date.now() - resumeTimestampRef.current) / 1000;
          setElapsed(Math.floor(total));
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionStarted, sessionPaused]);

  // ─── Kcal ─────────────────────────────────────────────────────────────────

  function calcTotalKcal(): number {
    if (!profile) return 0;
    return Math.round(
      exercises.reduce((total, ex) => {
        const completedSets = ex.sets.filter(s => parseInt(s.reps) > 0).length;
        return total + estimateKcalForExercise({
          met: ex.met,
          weightKg: profile.weight,
          completedSets,
          effort: ex.effort ?? ex.sets[ex.sets.length - 1]?.effort ?? 'normal',
          bodyFatPct: profile.bodyFatPct,
        });
      }, 0),
    );
  }

  // ─── Session control ───────────────────────────────────────────────────────

  function prepareBlankSession() {
    setExercises([]);
    setSessionReady(true);
    setSessionLoaded(true);
  }

  function startSession() {
    setSessionStartTime(new Date().toISOString());
    resumeTimestampRef.current = Date.now();
    accumulatedSecondsRef.current = 0;
    setElapsed(0);
    setSessionStarted(true);
    setSessionPaused(false);
    setSessionActive(true);
  }

  function pauseSession() {
    if (resumeTimestampRef.current !== null) {
      accumulatedSecondsRef.current += (Date.now() - resumeTimestampRef.current) / 1000;
      resumeTimestampRef.current = null;
    }
    setSessionPaused(true);
  }
  function resumeSession() {
    resumeTimestampRef.current = Date.now();
    setSessionPaused(false);
  }

  function resetSession() {
    resumeTimestampRef.current = null;
    accumulatedSecondsRef.current = 0;
    pendingPlanIdRef.current = null;
    doneCounterRef.current = 0;
    setSessionReady(false);
    setSessionStarted(false);
    setSessionPaused(false);
    setExercises([]);
    setElapsed(0);
    setSessionNotes('');
    setSessionLoaded(false);
    setSessionActive(false);
  }

  function cancelSession() {
    Alert.alert('Abandonar sesión', '¿Abandonás? Se perderán todos los datos registrados.', [
      { text: 'Seguir entrenando', style: 'cancel' },
      { text: 'Abandonar', style: 'destructive', onPress: resetSession },
    ]);
  }

  // ─── Exercise actions ──────────────────────────────────────────────────────

  function addExercise(ex: Exercise) {
    setExercises(prev => [
      ...prev,
      { exerciseId: ex.id, exerciseName: ex.name, met: ex.met, sets: [newSet(undefined, 'reps')], feedback: '', effort: undefined, showDetails: false, done: false },
    ]);
    setShowPicker(false);
    setPickerFilter('');
  }

  function removeExercise(idx: number) {
    Alert.alert('Eliminar ejercicio', '¿Eliminar este ejercicio?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => setExercises(prev => prev.filter((_, i) => i !== idx)) },
    ]);
  }

  function toggleDone(idx: number) {
    setExercises(prev => prev.map((e, i) => {
      if (i !== idx) return e;
      if (e.done) return { ...e, done: false, showDetails: false, completionOrder: undefined };
      return { ...e, done: true, showDetails: false, completionOrder: doneCounterRef.current++ };
    }));
  }

  function toggleDetails(idx: number) {
    setExercises(prev => prev.map((e, i) => (i === idx ? { ...e, showDetails: !e.showDetails } : e)));
  }

  function updateExercise(idx: number, update: Partial<ActiveExercise>) {
    setExercises(prev => prev.map((e, i) => (i === idx ? { ...e, ...update } : e)));
  }

  function updateSet(exIdx: number, setIdx: number, update: Partial<ActiveSet>) {
    setExercises(prev =>
      prev.map((ex, i) =>
        i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...update })) },
      ),
    );
  }

  function addSet(exIdx: number) {
    setExercises(prev =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const lastWeight = lastSet?.weight;
        const lastMode = lastSet?.mode ?? 'reps';
        return { ...ex, sets: [...ex.sets, newSet(lastWeight, lastMode)] };
      }),
    );
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExercises(prev =>
      prev.map((ex, i) => {
        if (i !== exIdx || ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) };
      }),
    );
  }

  // ─── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    const sessionExercises: SessionExercise[] = exercises
      .filter(ex => ex.sets.some(s => parseInt(s.reps) > 0))
      .map(ex => ({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        sets: ex.sets
          .filter(s => parseInt(s.reps) > 0)
          .map((s, i): ExerciseSet => ({
            setNumber: i + 1,
            reps: s.mode === 'seconds' ? 0 : (parseInt(s.reps) || 0),
            seconds: s.mode === 'seconds' ? (parseInt(s.reps) || 0) : undefined,
            weight: s.mode === 'reps' && s.weight ? parseFloat(s.weight) : undefined,
            effort: s.effort,
            feedback: s.feedback || undefined,
            mode: s.mode,
          })),
        feedback: ex.feedback || undefined,
        effort: ex.effort,
        completionOrder: ex.completionOrder,
      }));

    if (sessionExercises.length === 0) {
      Alert.alert('Sin ejercicios', 'Agregá al menos un ejercicio con series completadas.');
      return;
    }

    const kcal = calcTotalKcal();
    const startTime = sessionStarted ? sessionStartTime : new Date().toISOString();
    await storage.saveSession({
      id: `session_${Date.now()}`,
      date: startTime.slice(0, 10),
      startTime,
      endTime: new Date().toISOString(),
      exercises: sessionExercises,
      estimatedKcal: kcal > 0 ? kcal : undefined,
      notes: sessionNotes.trim() || undefined,
      status: 'completed',
      plannedSessionId: pendingPlanIdRef.current ?? undefined,
    });

    setShowFinishModal(false);
    resetSession();
    Alert.alert(
      '¡Sesión guardada!',
      `${sessionExercises.length} ejercicio${sessionExercises.length !== 1 ? 's' : ''}${kcal > 0 ? `\n~${kcal} kcal estimadas` : ''}`,
    );
  }

  const filteredExercises = allExercises.filter(e =>
    e.name.toLowerCase().includes(pickerFilter.toLowerCase()) ||
    e.muscleGroups.some(g => g.toLowerCase().includes(pickerFilter.toLowerCase())),
  );

  const totalKcal = calcTotalKcal();
  const totalSets = exercises.reduce((s, e) => s + e.sets.filter(set => parseInt(set.reps) > 0).length, 0);
  const pendingExercises = exercises.map((ex, idx) => ({ ex, idx })).filter(({ ex }) => !ex.done);
  const doneExercises = exercises.map((ex, idx) => ({ ex, idx })).filter(({ ex }) => ex.done);

  function groupByBloque(items: { ex: ActiveExercise; idx: number }[]) {
    const order: (string | undefined)[] = [];
    const map = new Map<string, { ex: ActiveExercise; idx: number }[]>();
    for (const item of items) {
      const key = item.ex.bloque ?? '__none__';
      if (!map.has(key)) { map.set(key, []); order.push(item.ex.bloque); }
      map.get(key)!.push(item);
    }
    return order.map(b => ({ bloque: b, items: map.get(b ?? '__none__')! }));
  }

  const pendingGroups = groupByBloque(pendingExercises);
  const doneGroups = groupByBloque(doneExercises);

  // ─── Idle state ────────────────────────────────────────────────────────────

  if (!sessionReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.preSession}>
          <Text style={styles.preSessionTitle}>Nueva sesión</Text>
          <Text style={styles.preSessionSub}>
            Registrá ejercicios, series, repeticiones y esfuerzo. El cronómetro empieza cuando vos decidas.
          </Text>
          <TouchableOpacity style={styles.startBtn} onPress={prepareBlankSession} activeOpacity={0.8}>
            <Text style={styles.startBtnText}>Preparar sesión</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Ready / Active session ────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {sessionStarted ? (
            <>
              <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
              <View style={styles.headerMeta}>
                {totalKcal > 0 && <Text style={styles.headerMetaChip}>~{totalKcal} kcal</Text>}
                {totalSets > 0 && <Text style={styles.headerMetaText}>{exercises.length} ej · {totalSets} series</Text>}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.readyTitle}>Preparando sesión</Text>
              <Text style={styles.readySubtitle}>{exercises.length} ejercicio{exercises.length !== 1 ? 's' : ''} · Cronómetro pausado</Text>
            </>
          )}
        </View>

        <View style={styles.headerActions}>
          {!sessionStarted ? (
            <TouchableOpacity style={styles.empezarBtn} onPress={startSession} activeOpacity={0.8}>
              <Text style={styles.empezarBtnText}>▶ Empezar</Text>
            </TouchableOpacity>
          ) : sessionPaused ? (
            <TouchableOpacity style={styles.empezarBtn} onPress={resumeSession} activeOpacity={0.8}>
              <Text style={styles.empezarBtnText}>▶ Reanudar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.pauseBtn} onPress={pauseSession} activeOpacity={0.8}>
              <Text style={styles.pauseBtnText}>⏸ Pausar</Text>
            </TouchableOpacity>
          )}
          {sessionStarted && (
            <TouchableOpacity style={styles.finishBtn} onPress={() => setShowFinishModal(true)} activeOpacity={0.8}>
              <Text style={styles.finishBtnText}>Finalizar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cancelIconBtn} onPress={cancelSession} hitSlop={12}>
            <Text style={styles.cancelIconText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Pending exercises grouped by block */}
        {pendingGroups.map((group, gi) => (
          <View key={gi} style={styles.blockGroup}>
            {group.bloque && (
              <Text style={styles.blockHeader}>{group.bloque.toUpperCase()}</Text>
            )}
            {group.items.map(({ ex, idx }) => (
              <ExerciseCard
                key={`${ex.exerciseId}-${idx}`}
                ex={ex}
                onToggleDone={() => toggleDone(idx)}
                onToggleDetails={() => toggleDetails(idx)}
                onRemove={() => removeExercise(idx)}
                onUpdateExercise={u => updateExercise(idx, u)}
                onUpdateSet={(setIdx, u) => updateSet(idx, setIdx, u)}
                onAddSet={() => addSet(idx)}
                onRemoveSet={setIdx => removeSet(idx, setIdx)}
              />
            ))}
          </View>
        ))}

        <TouchableOpacity style={styles.addExBtn} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
          <Text style={styles.addExBtnText}>+ Agregar ejercicio</Text>
        </TouchableOpacity>

        {/* Completed exercises */}
        {doneExercises.length > 0 && (
          <View style={styles.doneSection}>
            <View style={styles.doneSectionHeader}>
              <Text style={styles.doneSectionTitle}>COMPLETADOS</Text>
              <View style={styles.doneSectionBadge}>
                <Text style={styles.doneSectionBadgeText}>{doneExercises.length}</Text>
              </View>
            </View>
            {doneGroups.map((group, gi) => (
              <View key={gi} style={styles.blockGroup}>
                {group.bloque && (
                  <Text style={styles.blockHeaderDone}>{group.bloque.toUpperCase()}</Text>
                )}
                {group.items.map(({ ex, idx }) => (
                  <ExerciseCard
                    key={`done-${ex.exerciseId}-${idx}`}
                    ex={ex}
                    onToggleDone={() => toggleDone(idx)}
                    onToggleDetails={() => toggleDetails(idx)}
                    onRemove={() => removeExercise(idx)}
                    onUpdateExercise={u => updateExercise(idx, u)}
                    onUpdateSet={(setIdx, u) => updateSet(idx, setIdx, u)}
                    onAddSet={() => addSet(idx)}
                    onRemoveSet={setIdx => removeSet(idx, setIdx)}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Exercise Picker */}
      <Modal visible={showPicker} animationType="slide" transparent onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Elegir ejercicio</Text>
            <TextInput
              style={styles.searchInput}
              value={pickerFilter}
              onChangeText={setPickerFilter}
              placeholder="Buscar por nombre o músculo..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <FlatList
              data={filteredExercises}
              keyExtractor={item => item.id}
              style={styles.pickerList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerRow} onPress={() => addExercise(item)} activeOpacity={0.7}>
                  <Text style={styles.pickerRowName}>{item.name}</Text>
                  <Text style={styles.pickerRowMeta}>{item.muscleGroups.join(', ')}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Sin resultados</Text>}
            />
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowPicker(false); setPickerFilter(''); }}>
              <Text style={styles.modalCancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Finish modal */}
      <Modal visible={showFinishModal} animationType="slide" transparent onRequestClose={() => setShowFinishModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Finalizar sesión</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{formatTime(elapsed)}</Text>
                  <Text style={styles.summaryLabel}>Duración</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{exercises.length}</Text>
                  <Text style={styles.summaryLabel}>Ejercicios</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{totalSets}</Text>
                  <Text style={styles.summaryLabel}>Series</Text>
                </View>
                {totalKcal > 0 && (
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: colors.accent }]}>~{totalKcal}</Text>
                    <Text style={styles.summaryLabel}>Kcal</Text>
                  </View>
                )}
              </View>
              <Text style={styles.inputLabel}>Notas (opcional)</Text>
              <TextInput
                style={styles.notesInput}
                value={sessionNotes}
                onChangeText={setSessionNotes}
                placeholder="¿Cómo fue hoy?"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
              <View style={styles.finishActions}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setShowFinishModal(false)}>
                  <Text style={styles.backBtnText}>Volver</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                  <Text style={styles.saveBtnText}>Guardar sesión</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  preSession: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  preSessionTitle: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 10 },
  preSessionSub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  startBtn: { backgroundColor: colors.accent, paddingHorizontal: 40, paddingVertical: 16, borderRadius: 14 },
  startBtnText: { color: colors.black, fontSize: 17, fontWeight: '700' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  headerLeft: { flex: 1 },
  timerText: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: 1 },
  headerMeta: { flexDirection: 'row', gap: 8, marginTop: 2 },
  headerMetaChip: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  headerMetaText: { color: colors.textSecondary, fontSize: 12 },
  readyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  readySubtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empezarBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  empezarBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  pauseBtn: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  pauseBtnText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  finishBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  finishBtnText: { color: colors.black, fontWeight: '800', fontSize: 13 },
  cancelIconBtn: { padding: 6 },
  cancelIconText: { color: colors.textSecondary, fontSize: 18 },

  scroll: { padding: 14, gap: 10, paddingBottom: 32 },

  blockGroup: { gap: 8 },
  blockHeader: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, paddingHorizontal: 2 },
  blockHeaderDone: { color: '#4a7a4a', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, paddingHorizontal: 2 },

  // ─── Exercise card ──────────────────────────────────────────────────────────
  exCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exCardDone: { borderColor: '#2E5C2E', backgroundColor: '#0f1a0f' },

  exHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, gap: 8 },
  exHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  doneCheck: { color: '#4CAF50', fontSize: 13, fontWeight: '800' },
  exName: { color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  exNameDone: { color: '#7AAF7A' },
  setSummaryText: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  exHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chevron: { color: colors.textSecondary, fontSize: 10 },

  doneBtn: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  doneBtnActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  doneBtnText: { color: colors.textSecondary, fontSize: 12 },
  doneBtnTextActive: { color: '#fff', fontWeight: '800' },
  removeExText: { color: colors.textSecondary, fontSize: 15 },

  // ─── Compact set rows ───────────────────────────────────────────────────────
  setsContainer: { paddingHorizontal: 14, gap: 6 },

  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  setNum: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', width: 20, textTransform: 'uppercase' },

  repsInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    width: 52,
    paddingVertical: 7,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  setSep: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  weightInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    width: 62,
    paddingVertical: 7,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  kgLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginRight: 2 },

  effortPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  effortPillText: { fontSize: 12, fontWeight: '700' },

  removeSetBtn: { padding: 4 },
  removeSetIcon: { color: colors.textSecondary, fontSize: 13 },
  removeSetPlaceholder: { width: 21 },

  // ─── Exercise footer ────────────────────────────────────────────────────────
  exFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  addSetBtn: { paddingVertical: 2 },
  addSetBtnText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  detailsToggleBtn: { flex: 1 },
  detailsToggleBtnText: { color: colors.textSecondary, fontSize: 12, textAlign: 'right' },

  // ─── Details panel ──────────────────────────────────────────────────────────
  detailsPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
  detailsPanelLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  effortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  effortChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  effortChipText: { color: colors.textSecondary, fontSize: 12 },
  effortChipTextActive: { color: colors.black, fontWeight: '700' },
  exNotesInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 13,
    minHeight: 44,
    textAlignVertical: 'top',
  },

  addExBtn: { borderWidth: 1.5, borderColor: colors.accent, borderRadius: 12, borderStyle: 'dashed', paddingVertical: 13, alignItems: 'center' },
  addExBtnText: { color: colors.accent, fontSize: 15, fontWeight: '700' },

  doneSection: { gap: 8 },
  doneSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  doneSectionTitle: { color: '#4CAF50', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  doneSectionBadge: { backgroundColor: '#4CAF50', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  doneSectionBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    marginBottom: 12,
  },
  pickerList: { maxHeight: 340 },
  pickerRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerRowName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  pickerRowMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  emptyText: { color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 },
  modalCancelBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  modalCancelBtnText: { color: colors.textSecondary, fontSize: 15 },

  summaryRow: { flexDirection: 'row', marginBottom: 20, justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { color: colors.text, fontSize: 24, fontWeight: '800' },
  summaryLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 2, textTransform: 'uppercase' },
  inputLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  notesInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  finishActions: { flexDirection: 'row', gap: 12 },
  backBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  backBtnText: { color: colors.text, fontSize: 15 },
  saveBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  saveBtnText: { color: colors.black, fontWeight: '700', fontSize: 15 },
});
