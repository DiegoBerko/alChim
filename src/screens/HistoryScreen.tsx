import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { storage } from '../services/storage';
import type { EffortLevel, ExerciseSet, SessionExercise, WorkoutSession } from '../types';

// ─── Effort helpers (same as ActiveSessionScreen) ─────────────────────────────

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
            style={[
              styles.effortChip,
              active && { backgroundColor: EFFORT_COLORS[e], borderColor: EFFORT_COLORS[e] },
            ]}
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

// ─── Session row ──────────────────────────────────────────────────────────────

function SessionRow({
  session,
  onDelete,
  onEdit,
}: {
  session: WorkoutSession;
  onDelete: (id: string) => void;
  onEdit: (session: WorkoutSession) => void;
}) {
  const date = new Date(session.startTime ?? session.date);
  const dateStr = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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
        {timeStr ? <Text style={styles.rowTime}>{timeStr}</Text> : null}
        <Text style={styles.rowStats}>
          {session.exercises.length} ejercicio{session.exercises.length !== 1 ? 's' : ''}
          {'  ·  '}
          {totalSets} serie{totalSets !== 1 ? 's' : ''}
          {durationMin !== null ? `  ·  ${durationMin} min` : ''}
          {session.estimatedKcal !== undefined ? `  ·  ${session.estimatedKcal} kcal` : ''}
        </Text>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity onPress={() => onEdit(session)} style={styles.editBtn} hitSlop={8}>
          <Text style={styles.editBtnText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn} hitSlop={8}>
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

// Local mutable types for editing
interface EditSet {
  setNumber: number;
  reps: string;
  weight: string;
  effort?: EffortLevel;
  feedback: string;
}

interface EditExercise {
  exerciseId: string;
  exerciseName: string;
  sets: EditSet[];
  feedback: string;
  effort?: EffortLevel;
}

function sessionToEdit(session: WorkoutSession): { notes: string; exercises: EditExercise[] } {
  return {
    notes: session.notes ?? '',
    exercises: session.exercises.map(ex => ({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      feedback: ex.feedback ?? '',
      effort: ex.effort,
      sets: ex.sets.map(s => ({
        setNumber: s.setNumber,
        reps: String(s.reps),
        weight: s.weight !== undefined ? String(s.weight) : '',
        effort: s.effort,
        feedback: s.feedback ?? '',
      })),
    })),
  };
}

function editToSession(
  original: WorkoutSession,
  notes: string,
  exercises: EditExercise[],
): WorkoutSession {
  const sessionExercises: SessionExercise[] = exercises
    .filter(ex => ex.sets.length > 0)
    .map(ex => ({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      feedback: ex.feedback.trim() || undefined,
      effort: ex.effort,
      sets: ex.sets.map((s, i): ExerciseSet => ({
        setNumber: i + 1,
        reps: parseInt(s.reps) || 0,
        weight: s.weight ? parseFloat(s.weight) : undefined,
        effort: s.effort,
        feedback: s.feedback.trim() || undefined,
      })),
    }));

  return {
    ...original,
    notes: notes.trim() || undefined,
    exercises: sessionExercises,
  };
}

function SessionEditModal({
  session,
  onClose,
  onSaved,
}: {
  session: WorkoutSession;
  onClose: () => void;
  onSaved: (updated: WorkoutSession) => void;
}) {
  const initial = sessionToEdit(session);
  const [notes, setNotes] = useState(initial.notes);
  const [exercises, setExercises] = useState<EditExercise[]>(initial.exercises);

  function updateSet(exIdx: number, setIdx: number, update: Partial<EditSet>) {
    setExercises(prev =>
      prev.map((ex, i) =>
        i !== exIdx
          ? ex
          : { ...ex, sets: ex.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...update })) },
      ),
    );
  }

  function addSet(exIdx: number) {
    setExercises(prev =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const lastNum = ex.sets[ex.sets.length - 1]?.setNumber ?? 0;
        const lastWeight = ex.sets[ex.sets.length - 1]?.weight ?? '';
        const newSet: EditSet = { setNumber: lastNum + 1, reps: '', weight: lastWeight, feedback: '' };
        return { ...ex, sets: [...ex.sets, newSet] };
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

  function removeExercise(exIdx: number) {
    setExercises(prev => prev.filter((_, i) => i !== exIdx));
  }

  function updateExercise(exIdx: number, update: Partial<EditExercise>) {
    setExercises(prev => prev.map((ex, i) => (i !== exIdx ? ex : { ...ex, ...update })));
  }

  async function handleSave() {
    const updated = editToSession(session, notes, exercises);
    await storage.saveSession(updated);
    onSaved(updated);
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalBox}>
            {/* Modal header */}
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Editar sesión</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Text style={styles.editModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Notes */}
              <Text style={styles.editSectionLabel}>NOTAS</Text>
              <TextInput
                style={styles.editNotesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Notas de la sesión..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={2}
              />

              {/* Exercises */}
              {exercises.map((ex, exIdx) => (
                <View key={`${ex.exerciseId}-${exIdx}`} style={styles.editExCard}>
                  <View style={styles.editExHeader}>
                    <Text style={styles.editExName}>{ex.exerciseName}</Text>
                    <TouchableOpacity onPress={() => removeExercise(exIdx)} hitSlop={10}>
                      <Text style={styles.removeExText}>✕ Quitar</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Sets */}
                  {ex.sets.map((set, setIdx) => (
                    <View key={setIdx} style={styles.editSetBlock}>
                      <View style={styles.editSetHeader}>
                        <Text style={styles.editSetLabel}>Serie {setIdx + 1}</Text>
                        {ex.sets.length > 1 && (
                          <TouchableOpacity onPress={() => removeSet(exIdx, setIdx)} hitSlop={10}>
                            <Text style={styles.removeSetText}>Eliminar</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <View style={styles.editSetInputRow}>
                        <View style={styles.editSetInputGroup}>
                          <Text style={styles.editSetInputLabel}>REPS</Text>
                          <TextInput
                            style={styles.editSetInput}
                            value={set.reps}
                            onChangeText={t => updateSet(exIdx, setIdx, { reps: t })}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor={colors.textSecondary}
                            returnKeyType="done"
                          />
                        </View>
                        <View style={styles.editSetInputGroup}>
                          <Text style={styles.editSetInputLabel}>PESO (kg)</Text>
                          <TextInput
                            style={styles.editSetInput}
                            value={set.weight}
                            onChangeText={t => updateSet(exIdx, setIdx, { weight: t })}
                            keyboardType="decimal-pad"
                            placeholder="—"
                            placeholderTextColor={colors.textSecondary}
                            returnKeyType="done"
                          />
                        </View>
                      </View>

                      <EffortChips
                        selected={set.effort}
                        onSelect={e => updateSet(exIdx, setIdx, { effort: e })}
                      />

                      <TextInput
                        style={styles.editSetFeedback}
                        value={set.feedback}
                        onChangeText={t => updateSet(exIdx, setIdx, { feedback: t })}
                        placeholder="Nota de la serie..."
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  ))}

                  <TouchableOpacity style={styles.editAddSetBtn} onPress={() => addSet(exIdx)}>
                    <Text style={styles.editAddSetBtnText}>+ Agregar serie</Text>
                  </TouchableOpacity>

                  {/* Exercise-level feedback */}
                  <View style={styles.editDivider} />
                  <Text style={styles.editExLevelLabel}>Esfuerzo general</Text>
                  <EffortChips
                    selected={ex.effort}
                    onSelect={e => updateExercise(exIdx, { effort: e })}
                  />
                  <TextInput
                    style={[styles.editSetFeedback, { marginTop: 8 }]}
                    value={ex.feedback}
                    onChangeText={t => updateExercise(exIdx, { feedback: t })}
                    placeholder="Notas del ejercicio..."
                    placeholderTextColor={colors.textSecondary}
                    multiline
                  />
                </View>
              ))}

              {/* Save button */}
              <TouchableOpacity style={styles.editSaveBtn} onPress={handleSave} activeOpacity={0.8}>
                <Text style={styles.editSaveBtnText}>Guardar cambios</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);

  useFocusEffect(
    useCallback(() => {
      storage.getSessions().then(setSessions);
    }, []),
  );

  async function handleDelete(id: string) {
    await storage.deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
  }

  function handleSaved(updated: WorkoutSession) {
    setSessions(prev => prev.map(s => (s.id === updated.id ? updated : s)));
    setEditingSession(null);
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
            <SessionRow
              session={item}
              onDelete={handleDelete}
              onEdit={setEditingSession}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {editingSession && (
        <SessionEditModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSaved={handleSaved}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
  },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {},
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

  // Effort chips
  effortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  effortChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  effortChipText: { color: colors.textSecondary, fontSize: 11 },
  effortChipTextActive: { color: colors.black, fontWeight: '700' },

  // Edit modal
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  editModalBox: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '92%',
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  editModalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  editModalClose: {
    color: colors.textSecondary,
    fontSize: 18,
  },

  editSectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  editNotesInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    minHeight: 56,
    textAlignVertical: 'top',
    marginBottom: 16,
  },

  editExCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  editExHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  editExName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  removeExText: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  editSetBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  editSetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editSetLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  removeSetText: { color: colors.textSecondary, fontSize: 11 },

  editSetInputRow: { flexDirection: 'row', gap: 10 },
  editSetInputGroup: { flex: 1 },
  editSetInputLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  editSetInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  editSetFeedback: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: colors.text,
    fontSize: 12,
  },

  editAddSetBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    marginTop: 8,
  },
  editAddSetBtnText: { color: colors.accent, fontWeight: '700', fontSize: 12 },

  editDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  editExLevelLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  editSaveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  editSaveBtnText: { color: colors.black, fontWeight: '700', fontSize: 15 },
});
