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
import type { EffortLevel, Exercise, ExerciseSet, SessionExercise, UserProfile } from '../types';

// ─── Local state types (strings for TextInput) ───────────────────────────────

interface ActiveSet {
  reps: string;
  weight: string;
  effort: EffortLevel;
  feedback: string;
  showFeedback: boolean;
}

interface ActiveExercise {
  exerciseId: string;
  exerciseName: string;
  met: number;
  sets: ActiveSet[];
  feedback: string;
  effort?: EffortLevel;
  expanded: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EFFORTS: EffortLevel[] = ['fácil', 'normal', 'intenso', 'muy_intenso'];

const EFFORT_LABELS: Record<EffortLevel, string> = {
  fácil: 'Fácil',
  normal: 'Normal',
  intenso: 'Intenso',
  muy_intenso: 'Muy intenso',
};

const EFFORT_COLORS: Record<EffortLevel, string> = {
  fácil: '#4CAF50',
  normal: colors.accent,
  intenso: '#FF9800',
  muy_intenso: '#F44336',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function newSet(prevWeight?: string): ActiveSet {
  return { reps: '', weight: prevWeight ?? '', effort: 'normal', feedback: '', showFeedback: false };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EffortChips({
  selected,
  onSelect,
  allowDeselect = false,
}: {
  selected?: EffortLevel;
  onSelect: (e: EffortLevel | undefined) => void;
  allowDeselect?: boolean;
}) {
  return (
    <View style={styles.effortRow}>
      {EFFORTS.map(e => {
        const active = selected === e;
        return (
          <TouchableOpacity
            key={e}
            style={[
              styles.effortChip,
              active && { backgroundColor: EFFORT_COLORS[e], borderColor: EFFORT_COLORS[e] },
            ]}
            onPress={() => onSelect(allowDeselect && active ? undefined : e)}
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

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ActiveSessionScreen() {
  const [sessionStarted, setSessionStarted] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      storage.getProfile().then(setProfile);
      storage.getExercises().then(setAllExercises);
    }, []),
  );

  useEffect(() => {
    if (sessionStarted) {
      timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionStarted]);

  // ─── Kcal ──────────────────────────────────────────────────────────────────

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

  // ─── Session control ────────────────────────────────────────────────────────

  async function startSession() {
    const startTime = new Date().toISOString();
    setSessionStartTime(startTime);
    setSessionStarted(true);
    setElapsed(0);
    setSessionNotes('');

    // Check for pending template
    const pendingTemplate = await storage.getPendingTemplate();
    if (pendingTemplate) {
      await storage.setPendingTemplate(null);
      const preloaded: ActiveExercise[] = pendingTemplate.exercises
        .map(te => {
          const libEx = allExercises.find(e => e.id === te.exerciseId);
          if (!libEx) return null;
          const numSets = te.targetSets > 0 ? te.targetSets : 3;
          return {
            exerciseId: libEx.id,
            exerciseName: libEx.name,
            met: libEx.met,
            sets: Array.from({ length: numSets }, () => newSet()),
            feedback: '',
            effort: undefined,
            expanded: false,
          } as ActiveExercise;
        })
        .filter((e): e is ActiveExercise => e !== null);
      if (preloaded.length > 0) {
        preloaded[0] = { ...preloaded[0], expanded: true };
        setExercises(preloaded);
      } else {
        setExercises([]);
      }
    } else {
      setExercises([]);
    }
  }

  function cancelSession() {
    Alert.alert('Abandonar sesión', '¿Abandonás? Se perderán todos los datos registrados.', [
      { text: 'Seguir entrenando', style: 'cancel' },
      {
        text: 'Abandonar',
        style: 'destructive',
        onPress: () => { setSessionStarted(false); setExercises([]); setElapsed(0); },
      },
    ]);
  }

  // ─── Exercise actions ───────────────────────────────────────────────────────

  function addExercise(ex: Exercise) {
    setExercises(prev => [
      ...prev.map(e => ({ ...e, expanded: false })),
      { exerciseId: ex.id, exerciseName: ex.name, met: ex.met, sets: [newSet()], feedback: '', effort: undefined, expanded: true },
    ]);
    setShowPicker(false);
    setPickerFilter('');
  }

  function removeExercise(idx: number) {
    Alert.alert('Eliminar ejercicio', '¿Eliminar este ejercicio de la sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => setExercises(prev => prev.filter((_, i) => i !== idx)) },
    ]);
  }

  function toggleExpanded(idx: number) {
    setExercises(prev => prev.map((e, i) => ({ ...e, expanded: i === idx ? !e.expanded : e.expanded })));
  }

  function updateExercise(idx: number, update: Partial<ActiveExercise>) {
    setExercises(prev => prev.map((e, i) => (i === idx ? { ...e, ...update } : e)));
  }

  // ─── Set actions ────────────────────────────────────────────────────────────

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
        const lastWeight = ex.sets[ex.sets.length - 1]?.weight;
        return { ...ex, sets: [...ex.sets, newSet(lastWeight)] };
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

  // ─── Finish ─────────────────────────────────────────────────────────────────

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
            reps: parseInt(s.reps) || 0,
            weight: s.weight ? parseFloat(s.weight) : undefined,
            effort: s.effort,
            feedback: s.feedback || undefined,
          })),
        feedback: ex.feedback || undefined,
        effort: ex.effort,
      }));

    if (sessionExercises.length === 0) {
      Alert.alert('Sin ejercicios', 'Agregá al menos un ejercicio con series completadas.');
      return;
    }

    const kcal = calcTotalKcal();
    await storage.saveSession({
      id: `session_${Date.now()}`,
      date: sessionStartTime.slice(0, 10),
      startTime: sessionStartTime,
      endTime: new Date().toISOString(),
      exercises: sessionExercises,
      estimatedKcal: kcal > 0 ? kcal : undefined,
      notes: sessionNotes.trim() || undefined,
      status: 'completed',
    });

    setSessionStarted(false);
    setExercises([]);
    setElapsed(0);
    setShowFinishModal(false);

    Alert.alert(
      '¡Sesión guardada!',
      `${sessionExercises.length} ejercicio${sessionExercises.length !== 1 ? 's' : ''}${kcal > 0 ? `\n~${kcal} kcal estimadas` : ''}`,
    );
  }

  // ─── Filtered exercises for picker ─────────────────────────────────────────

  const filteredExercises = allExercises.filter(e =>
    e.name.toLowerCase().includes(pickerFilter.toLowerCase()) ||
    e.muscleGroups.some(g => g.toLowerCase().includes(pickerFilter.toLowerCase())),
  );

  const totalKcal = calcTotalKcal();
  const totalSets = exercises.reduce((s, e) => s + e.sets.filter(set => parseInt(set.reps) > 0).length, 0);

  // ─── Pre-session screen ─────────────────────────────────────────────────────

  if (!sessionStarted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.preSession}>
          <Text style={styles.preSessionTitle}>Nueva sesión</Text>
          <Text style={styles.preSessionSub}>
            Registrá ejercicios, series, repeticiones y esfuerzo en tiempo real.
          </Text>
          <TouchableOpacity style={styles.startBtn} onPress={startSession} activeOpacity={0.8}>
            <Text style={styles.startBtnText}>Iniciar sesión</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Active session ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
          {totalKcal > 0 && <Text style={styles.kcalLive}>~{totalKcal} kcal</Text>}
          {totalSets > 0 && (
            <Text style={styles.setsSummary}>
              {exercises.length} ejercicio{exercises.length !== 1 ? 's' : ''}  ·  {totalSets} serie{totalSets !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.finishBtn} onPress={() => setShowFinishModal(true)} activeOpacity={0.8}>
            <Text style={styles.finishBtnText}>Finalizar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelIconBtn} onPress={cancelSession} hitSlop={12}>
            <Text style={styles.cancelIconText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {exercises.map((ex, exIdx) => (
          <View key={`${ex.exerciseId}-${exIdx}`} style={styles.exCard}>
            {/* Exercise header row */}
            <TouchableOpacity style={styles.exHeader} onPress={() => toggleExpanded(exIdx)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exName}>{ex.exerciseName}</Text>
                <Text style={styles.exMeta}>
                  {ex.sets.length} serie{ex.sets.length !== 1 ? 's' : ''}
                  {ex.sets.some(s => s.reps)
                    ? '  ·  ' + ex.sets.filter(s => s.reps).map(s => `${s.reps}${s.weight ? `×${s.weight}kg` : ''}`).join(', ')
                    : ''}
                </Text>
              </View>
              <View style={styles.exHeaderRight}>
                <Text style={styles.expandIcon}>{ex.expanded ? '▲' : '▼'}</Text>
                <TouchableOpacity onPress={() => removeExercise(exIdx)} hitSlop={10} style={styles.removeExBtn}>
                  <Text style={styles.removeExText}>✕</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            {ex.expanded && (
              <View style={styles.exBody}>
                {/* Sets */}
                {ex.sets.map((set, setIdx) => (
                  <View key={setIdx} style={styles.setBlock}>
                    <View style={styles.setHeaderRow}>
                      <Text style={styles.setLabel}>Serie {setIdx + 1}</Text>
                      {ex.sets.length > 1 && (
                        <TouchableOpacity onPress={() => removeSet(exIdx, setIdx)} hitSlop={10}>
                          <Text style={styles.removeSetText}>Eliminar</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Reps + Weight */}
                    <View style={styles.setInputRow}>
                      <View style={styles.setInputGroup}>
                        <Text style={styles.setInputLabel}>REPS</Text>
                        <TextInput
                          style={styles.setInput}
                          value={set.reps}
                          onChangeText={t => updateSet(exIdx, setIdx, { reps: t })}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={colors.textSecondary}
                          returnKeyType="done"
                        />
                      </View>
                      <View style={styles.setInputGroup}>
                        <Text style={styles.setInputLabel}>PESO (kg)</Text>
                        <TextInput
                          style={styles.setInput}
                          value={set.weight}
                          onChangeText={t => updateSet(exIdx, setIdx, { weight: t })}
                          keyboardType="decimal-pad"
                          placeholder="—"
                          placeholderTextColor={colors.textSecondary}
                          returnKeyType="done"
                        />
                      </View>
                    </View>

                    {/* Effort chips */}
                    <EffortChips
                      selected={set.effort}
                      onSelect={e => updateSet(exIdx, setIdx, { effort: e ?? 'normal' })}
                    />

                    {/* Per-set feedback */}
                    <TouchableOpacity
                      style={styles.feedbackToggle}
                      onPress={() => updateSet(exIdx, setIdx, { showFeedback: !set.showFeedback })}>
                      <Text style={styles.feedbackToggleText}>
                        {set.showFeedback ? '▲ Ocultar nota' : '+ Agregar nota de la serie'}
                      </Text>
                    </TouchableOpacity>
                    {set.showFeedback && (
                      <TextInput
                        style={styles.feedbackInput}
                        value={set.feedback}
                        onChangeText={t => updateSet(exIdx, setIdx, { feedback: t })}
                        placeholder="Ej: sentí el hombro, buen rango..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                      />
                    )}
                  </View>
                ))}

                <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exIdx)}>
                  <Text style={styles.addSetBtnText}>+ Agregar serie</Text>
                </TouchableOpacity>

                {/* Exercise-level section */}
                <View style={styles.divider} />
                <Text style={styles.exLevelLabel}>Esfuerzo general del ejercicio</Text>
                <EffortChips
                  selected={ex.effort}
                  onSelect={e => updateExercise(exIdx, { effort: e })}
                  allowDeselect
                />

                <TextInput
                  style={[styles.feedbackInput, { marginTop: 10 }]}
                  value={ex.feedback}
                  onChangeText={t => updateExercise(exIdx, { feedback: t })}
                  placeholder="Notas del ejercicio (opcional)..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                />
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.addExBtn} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
          <Text style={styles.addExBtnText}>+ Agregar ejercicio</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Exercise Picker Modal */}
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

      {/* Finish Session Modal */}
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

              <Text style={styles.inputLabel}>Notas de la sesión (opcional)</Text>
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Pre-session
  preSession: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  preSessionTitle: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 10 },
  preSessionSub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  startBtn: { backgroundColor: colors.accent, paddingHorizontal: 40, paddingVertical: 16, borderRadius: 14 },
  startBtnText: { color: colors.black, fontSize: 17, fontWeight: '700' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timerText: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  kcalLive: { color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 2 },
  setsSummary: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  finishBtn: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  finishBtnText: { color: colors.black, fontWeight: '700', fontSize: 14 },
  cancelIconBtn: { padding: 6 },
  cancelIconText: { color: colors.textSecondary, fontSize: 18 },

  // Scroll
  scroll: { padding: 16, gap: 12, paddingBottom: 32 },

  // Exercise card
  exCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  exHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  exName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  exMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  exHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  expandIcon: { color: colors.textSecondary, fontSize: 12 },
  removeExBtn: {},
  removeExText: { color: colors.textSecondary, fontSize: 16 },

  exBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 0 },

  // Set block
  setBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  setHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  setLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  removeSetText: { color: colors.textSecondary, fontSize: 12 },

  setInputRow: { flexDirection: 'row', gap: 10 },
  setInputGroup: { flex: 1 },
  setInputLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  setInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Effort chips
  effortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  effortChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  effortChipText: { color: colors.textSecondary, fontSize: 12 },
  effortChipTextActive: { color: colors.black, fontWeight: '700' },

  // Feedback
  feedbackToggle: { paddingVertical: 2 },
  feedbackToggleText: { color: colors.textSecondary, fontSize: 12 },
  feedbackInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 13,
    minHeight: 56,
    textAlignVertical: 'top',
  },

  // Add set
  addSetBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  addSetBtnText: { color: colors.accent, fontWeight: '700', fontSize: 13 },

  // Exercise-level
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  exLevelLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  // Add exercise
  addExBtn: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  addExBtnText: { color: colors.accent, fontSize: 15, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '85%',
  },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    marginBottom: 12,
  },
  pickerList: { maxHeight: 340 },
  pickerRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerRowName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  pickerRowMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  emptyText: { color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 },
  modalCancelBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  modalCancelBtnText: { color: colors.textSecondary, fontSize: 15 },

  // Finish modal
  summaryRow: { flexDirection: 'row', gap: 0, marginBottom: 20, justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 2, textTransform: 'uppercase' },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  notesInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
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
