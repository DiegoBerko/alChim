import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { colors } from '../theme';
import { storage } from '../services/storage';
import type { EffortLevel, ExerciseSet, PlannedSession, SessionExercise, WorkoutSession } from '../types';
import type { SetMode } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'SessionDetail'>;
type RouteP = RouteProp<RootStackParamList, 'SessionDetail'>;

// ─── Effort helpers ───────────────────────────────────────────────────────────

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
const EFFORT_SHORT: Record<EffortLevel, string> = {
  fácil: 'F', normal: 'N', intenso: 'I', muy_intenso: 'MI',
};

function effortLabel(e?: EffortLevel) {
  return e ? EFFORT_LABELS[e] : null;
}
function effortColor(e?: EffortLevel) {
  return e ? EFFORT_COLORS[e] : colors.textSecondary;
}

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

// ─── Edit types ───────────────────────────────────────────────────────────────

interface EditSet {
  setNumber: number;
  reps: string;
  weight: string;
  effort?: EffortLevel;
  feedback: string;
  mode?: SetMode;
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
        reps: s.mode === 'seconds' ? String(s.seconds ?? s.reps) : String(s.reps),
        weight: s.weight !== undefined ? String(s.weight) : '',
        effort: s.effort,
        feedback: s.feedback ?? '',
        mode: s.mode,
      })),
    })),
  };
}

function editToSession(original: WorkoutSession, notes: string, exercises: EditExercise[], plannedSessionId: string | null): WorkoutSession {
  const sessionExercises: SessionExercise[] = exercises
    .filter(ex => ex.sets.length > 0)
    .map(ex => ({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      feedback: ex.feedback.trim() || undefined,
      effort: ex.effort,
      sets: ex.sets.map((s, i): ExerciseSet => ({
        setNumber: i + 1,
        reps: s.mode === 'seconds' ? 0 : (parseInt(s.reps) || 0),
        seconds: s.mode === 'seconds' ? (parseInt(s.reps) || 0) : undefined,
        weight: s.mode !== 'seconds' && s.weight ? parseFloat(s.weight) : undefined,
        effort: s.effort,
        feedback: s.feedback.trim() || undefined,
        mode: s.mode,
      })),
    }));
  return { ...original, notes: notes.trim() || undefined, exercises: sessionExercises, plannedSessionId: plannedSessionId ?? undefined };
}

// ─── Share formatter ──────────────────────────────────────────────────────────

function formatSessionForShare(
  session: WorkoutSession,
  plannedSession: PlannedSession | null,
  dateStr: string,
  timeStr: string,
): string {
  const totalSets = session.exercises.reduce((s, ex) => s + ex.sets.length, 0);
  let durationMin: number | null = null;
  if (session.startTime && session.endTime) {
    durationMin = Math.round(
      (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000,
    );
  }

  const lines: string[] = [];
  lines.push(`🏋️ *Sesión - ${dateStr}${timeStr ? ', ' + timeStr : ''}*`);
  lines.push('');

  const stats = [
    durationMin ? `⏱ ${durationMin} min` : null,
    `${session.exercises.length} ejercicios`,
    `${totalSets} series`,
    session.estimatedKcal ? `~${session.estimatedKcal} kcal` : null,
  ].filter(Boolean).join('  ·  ');
  lines.push(stats);

  if (plannedSession) {
    lines.push('');
    lines.push(`📋 *Basado en: ${plannedSession.name ?? 'Plan'}*`);
    const planExIds = new Set(plannedSession.exercises.map(e => e.exerciseId));
    const sessionExIds = new Set(session.exercises.map(e => e.exerciseId));
    const skipped = plannedSession.exercises.filter(e => !sessionExIds.has(e.exerciseId));
    const added = session.exercises.filter(e => !planExIds.has(e.exerciseId));
    if (skipped.length === 0 && added.length === 0) {
      lines.push('✓ Seguiste el plan al pie de la letra');
    } else {
      skipped.forEach(e => lines.push(`✕ Omitido: ${e.exerciseName}`));
      added.forEach(e => lines.push(`+ Agregado: ${e.exerciseName}`));
    }
  }

  lines.push('');
  session.exercises.forEach(ex => {
    const effortStr = ex.effort ? `  ·  ${EFFORT_LABELS[ex.effort]}` : '';
    lines.push(`🔸 *${ex.exerciseName}*  ·  ${ex.sets.length} series${effortStr}`);
    ex.sets.forEach((s, i) => {
      const val = (s.mode === 'seconds' || s.seconds !== undefined)
        ? `${s.seconds ?? s.reps} seg`
        : `${s.reps} reps${s.weight !== undefined ? ` × ${s.weight}kg` : ''}`;
      const eff = s.effort ? `  ·  ${EFFORT_LABELS[s.effort]}` : '';
      lines.push(`  S${i + 1} · ${val}${eff}`);
    });
    if (ex.feedback) lines.push(`  _${ex.feedback}_`);
  });

  if (session.notes) {
    lines.push('');
    lines.push(`📝 _${session.notes}_`);
  }

  return lines.join('\n');
}

// ─── Compact set row for edit mode ────────────────────────────────────────────

function EditSetRowCompact({
  setIdx,
  set,
  isOnly,
  onUpdate,
  onRemove,
}: {
  setIdx: number;
  set: EditSet;
  isOnly: boolean;
  onUpdate: (u: Partial<EditSet>) => void;
  onRemove: () => void;
}) {
  function cycleEffort() {
    const current = set.effort ?? 'normal';
    const idx = EFFORTS.indexOf(current);
    onUpdate({ effort: EFFORTS[(idx + 1) % EFFORTS.length] });
  }
  const ec = set.effort ? EFFORT_COLORS[set.effort] : colors.border;

  return (
    <View style={styles.esRow}>
      <Text style={styles.esNum}>S{setIdx + 1}</Text>
      <TextInput
        style={styles.esRepsInput}
        value={set.reps}
        onChangeText={t => onUpdate({ reps: t })}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={colors.textSecondary}
        returnKeyType="done"
        selectTextOnFocus
      />
      <Text style={styles.esUnit}>{set.mode === 'seconds' ? 'seg' : 'reps'}</Text>
      {set.mode !== 'seconds' && (
        <>
          <Text style={styles.esSep}>×</Text>
          <TextInput
            style={styles.esWeightInput}
            value={set.weight}
            onChangeText={t => onUpdate({ weight: t })}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
            selectTextOnFocus
          />
          <Text style={styles.esUnit}>kg</Text>
        </>
      )}
      <TouchableOpacity onPress={cycleEffort} style={[styles.esEffortPill, { borderColor: ec }]} activeOpacity={0.7}>
        <Text style={[styles.esEffortText, { color: ec }]}>
          {set.effort ? EFFORT_SHORT[set.effort] : '·'}
        </Text>
      </TouchableOpacity>
      {!isOnly ? (
        <TouchableOpacity onPress={onRemove} hitSlop={10} style={styles.esRemoveBtn}>
          <Text style={styles.esRemoveIcon}>🗑️</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.esRemovePlaceholder} />
      )}
    </View>
  );
}

// ─── View mode ────────────────────────────────────────────────────────────────

function PlanDeviations({ session, plan }: { session: WorkoutSession; plan: PlannedSession }) {
  const planExMap = new Map(plan.exercises.map(e => [e.exerciseId, e]));
  const sessionExIds = new Set(session.exercises.map(e => e.exerciseId));

  const skipped = plan.exercises.filter(e => !sessionExIds.has(e.exerciseId));
  const added = session.exercises.filter(e => !planExMap.has(e.exerciseId));
  const setDiffs = session.exercises
    .filter(e => planExMap.has(e.exerciseId))
    .flatMap(e => {
      const planned = planExMap.get(e.exerciseId)!;
      const plannedCount = planned.setTargets?.length ?? planned.targetSets ?? 3;
      if (e.sets.length === plannedCount) return [];
      return [{ name: e.exerciseName, actual: e.sets.length, planned: plannedCount }];
    });

  // Completion order: only show if at least one exercise has an order and it differs from plan order
  const done = [...session.exercises]
    .filter(e => e.completionOrder !== undefined)
    .sort((a, b) => (a.completionOrder ?? 0) - (b.completionOrder ?? 0));
  const planIds = plan.exercises.map(e => e.exerciseId);
  const doneIds = done.map(e => e.exerciseId);
  const orderChanged = done.length > 1 && !doneIds.every((id, i) => planIds[i] === id);

  const hasAnyDeviation = skipped.length > 0 || added.length > 0 || setDiffs.length > 0 || orderChanged;

  return (
    <View style={styles.planCard}>
      <Text style={styles.planCardTitle}>Basado en: {plan.name ?? 'Plan'}</Text>
      {!hasAnyDeviation && (
        <Text style={styles.planCardOk}>✓ Seguiste el plan al pie de la letra</Text>
      )}
      {skipped.map(e => (
        <Text key={e.exerciseId} style={styles.planCardSkipped}>✕ Omitido: {e.exerciseName}</Text>
      ))}
      {added.map(e => (
        <Text key={e.exerciseId} style={styles.planCardAdded}>+ Agregado: {e.exerciseName}</Text>
      ))}
      {setDiffs.map(d => (
        <Text key={d.name} style={styles.planCardDiff}>
          △ {d.name}: {d.actual} series (plan: {d.planned})
        </Text>
      ))}
      {orderChanged && (
        <Text style={styles.planCardOrder}>
          Orden: {done.map(e => e.exerciseName.split(' ')[0]).join(' → ')}
        </Text>
      )}
    </View>
  );
}

function ViewMode({ session, plannedSession }: { session: WorkoutSession; plannedSession: PlannedSession | null }) {
  const totalSets = session.exercises.reduce((s, ex) => s + ex.sets.length, 0);
  let durationMin: number | null = null;
  if (session.startTime && session.endTime) {
    durationMin = Math.round(
      (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000,
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.viewScroll} showsVerticalScrollIndicator={false}>
      {/* Stats row */}
      <View style={styles.statsRow}>
        {durationMin !== null && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{durationMin}'</Text>
            <Text style={styles.statLabel}>Duración</Text>
          </View>
        )}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{session.exercises.length}</Text>
          <Text style={styles.statLabel}>Ejercicios</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalSets}</Text>
          <Text style={styles.statLabel}>Series</Text>
        </View>
        {session.estimatedKcal !== undefined && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.accent }]}>~{session.estimatedKcal}</Text>
            <Text style={styles.statLabel}>Kcal</Text>
          </View>
        )}
      </View>

      {/* Plan deviations */}
      {plannedSession && <PlanDeviations session={session} plan={plannedSession} />}

      {/* Notes */}
      {session.notes ? (
        <View style={styles.notesCard}>
          <Text style={styles.notesCardLabel}>NOTAS</Text>
          <Text style={styles.notesCardText}>{session.notes}</Text>
        </View>
      ) : null}

      {/* Exercises */}
      <View style={styles.exerciseList}>
        {session.exercises.map((ex, i) => (
          <View key={`${ex.exerciseId}-${i}`} style={styles.viewExCard}>
            <View style={styles.viewExHeader}>
              <Text style={styles.viewExName}>{ex.exerciseName}</Text>
              <Text style={styles.viewExSeries}>{ex.sets.length} series</Text>
            </View>
            {ex.effort && (
              <Text style={[styles.viewExEffortBadge, { color: effortColor(ex.effort) }]}>
                {effortLabel(ex.effort)}
              </Text>
            )}
            <View style={styles.setsGrid}>
              {ex.sets.map((s, si) => (
                <View key={si} style={styles.setRow}>
                  <Text style={styles.setRowNum}>S{si + 1}</Text>
                  <Text style={styles.setRowMain}>
                    {(s.mode === 'seconds' || s.seconds !== undefined)
                      ? `${s.seconds ?? s.reps} seg`
                      : `${s.reps} rep${s.reps !== 1 ? 's' : ''}${s.weight !== undefined ? ` · ${s.weight}kg` : ''}`}
                  </Text>
                  {s.effort && (
                    <Text style={[styles.setRowEffort, { color: effortColor(s.effort) }]}>
                      {effortLabel(s.effort)}
                    </Text>
                  )}
                  {s.feedback ? <Text style={styles.setRowFeedback}>{s.feedback}</Text> : null}
                </View>
              ))}
            </View>
            {ex.feedback ? (
              <Text style={styles.viewExFeedback}>{ex.feedback}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Edit mode ────────────────────────────────────────────────────────────────

function EditMode({
  session,
  onSaved,
}: {
  session: WorkoutSession;
  onSaved: (updated: WorkoutSession) => void;
}) {
  const initial = sessionToEdit(session);
  const [notes, setNotes] = useState(initial.notes);
  const [exercises, setExercises] = useState<EditExercise[]>(initial.exercises);
  const [planId, setPlanId] = useState<string | null>(session.plannedSessionId ?? null);
  const [allPlans, setAllPlans] = useState<PlannedSession[]>([]);
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  useEffect(() => {
    storage.getPlannedSessions().then(setAllPlans);
  }, []);

  function updateSet(exIdx: number, setIdx: number, update: Partial<EditSet>) {
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
        const lastNum = ex.sets[ex.sets.length - 1]?.setNumber ?? 0;
        const lastWeight = ex.sets[ex.sets.length - 1]?.weight ?? '';
        return { ...ex, sets: [...ex.sets, { setNumber: lastNum + 1, reps: '', weight: lastWeight, feedback: '' }] };
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
    const updated = editToSession(session, notes, exercises, planId);
    await storage.saveSession(updated);
    onSaved(updated);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.editScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Plan origin */}
        <Text style={styles.editLabel}>PLAN DE ORIGEN (opcional)</Text>
        <TouchableOpacity style={styles.planPickerRow} onPress={() => setShowPlanPicker(true)} activeOpacity={0.7}>
          <Text style={styles.planPickerValue}>
            {planId ? (allPlans.find(p => p.id === planId)?.name ?? 'Plan desconocido') : 'Sin plan asociado'}
          </Text>
          <Text style={styles.planPickerChevron}>›</Text>
        </TouchableOpacity>

        {/* Notes */}
        <Text style={styles.editLabel}>NOTAS DE LA SESIÓN</Text>
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

            <View style={styles.esSetsBlock}>
              {ex.sets.map((set, setIdx) => (
                <EditSetRowCompact
                  key={setIdx}
                  setIdx={setIdx}
                  set={set}
                  isOnly={ex.sets.length === 1}
                  onUpdate={u => updateSet(exIdx, setIdx, u)}
                  onRemove={() => removeSet(exIdx, setIdx)}
                />
              ))}
            </View>

            <TouchableOpacity style={styles.editAddSetBtn} onPress={() => addSet(exIdx)}>
              <Text style={styles.editAddSetBtnText}>+ Agregar serie</Text>
            </TouchableOpacity>

            <View style={styles.editDivider} />
            <Text style={styles.editExLevelLabel}>Esfuerzo general</Text>
            <EffortChips selected={ex.effort} onSelect={e => updateExercise(exIdx, { effort: e })} />
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

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <Text style={styles.saveBtnText}>Guardar cambios</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Plan picker modal */}
      <Modal visible={showPlanPicker} transparent animationType="slide" onRequestClose={() => setShowPlanPicker(false)}>
        <TouchableOpacity style={styles.planModalOverlay} activeOpacity={1} onPress={() => setShowPlanPicker(false)}>
          <View style={styles.planModalSheet}>
            <Text style={styles.planModalTitle}>Plan de origen</Text>
            <TouchableOpacity
              style={[styles.planModalItem, !planId && styles.planModalItemSelected]}
              onPress={() => { setPlanId(null); setShowPlanPicker(false); }}>
              <Text style={[styles.planModalItemText, !planId && { color: colors.accent }]}>Sin plan asociado</Text>
            </TouchableOpacity>
            {allPlans.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.planModalItem, planId === p.id && styles.planModalItemSelected]}
                onPress={() => { setPlanId(p.id); setShowPlanPicker(false); }}>
                <Text style={[styles.planModalItemText, planId === p.id && { color: colors.accent }]}>{p.name ?? p.id}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SessionDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteP>();
  const [session, setSession] = useState(route.params.session);
  const [editing, setEditing] = useState(false);
  const [plannedSession, setPlannedSession] = useState<PlannedSession | null>(null);

  useEffect(() => {
    if (session.plannedSessionId) {
      storage.getPlannedSessions().then(plans => {
        setPlannedSession(plans.find(p => p.id === session.plannedSessionId) ?? null);
      });
    }
  }, [session.plannedSessionId]);

  const date = new Date(session.startTime ?? session.date);
  const dateStr = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeStr = session.startTime
    ? date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : '';

  function handleBack() {
    if (editing) {
      Alert.alert('Descartar cambios', '¿Salir sin guardar?', [
        { text: 'Quedarse', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => setEditing(false) },
      ]);
    } else {
      navigation.goBack();
    }
  }

  function handleSaved(updated: WorkoutSession) {
    setSession(updated);
    setEditing(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{editing ? '✕ Cancelar' : '← Volver'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerDate}>{dateStr}</Text>
          {timeStr ? <Text style={styles.headerTime}>{timeStr}</Text> : null}
        </View>
        <View style={styles.headerRight}>
          {!editing && (
            <TouchableOpacity
              hitSlop={12}
              onPress={() => Share.share({ message: formatSessionForShare(session, plannedSession, dateStr, timeStr) })}>
              <Text style={styles.shareBtn}>📤</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setEditing(e => !e)} hitSlop={12}>
            <Text style={styles.editToggleText}>{editing ? 'Ver' : 'Editar'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {editing
        ? <EditMode session={session} onSaved={handleSaved} />
        : <ViewMode session={session} plannedSession={plannedSession} />
      }
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { minWidth: 80 },
  backBtnText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerDate: { color: colors.text, fontSize: 13, fontWeight: '700', textTransform: 'capitalize', textAlign: 'center' },
  headerTime: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 80, justifyContent: 'flex-end' },
  shareBtn: { fontSize: 18 },
  editToggleText: { color: colors.accent, fontSize: 14, fontWeight: '600' },

  // View mode
  viewScroll: { padding: 16, gap: 14, paddingBottom: 32 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },

  notesCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  notesCardLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  notesCardText: { color: colors.text, fontSize: 14, lineHeight: 20 },

  exerciseList: { gap: 10 },
  viewExCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  viewExHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewExName: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  viewExSeries: { color: colors.textSecondary, fontSize: 12 },
  viewExEffortBadge: { fontSize: 11, fontWeight: '600' },
  viewExFeedback: { color: colors.textSecondary, fontSize: 13, fontStyle: 'italic' },

  setsGrid: { gap: 6 },
  setRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  setRowNum: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    width: 22,
    textTransform: 'uppercase',
  },
  setRowMain: { color: colors.text, fontSize: 13, fontWeight: '600' },
  setRowEffort: { fontSize: 11, fontWeight: '600' },
  setRowFeedback: { color: colors.textSecondary, fontSize: 12, width: '100%', paddingLeft: 28 },

  // Edit mode
  editScroll: { padding: 16, gap: 12, paddingBottom: 32 },
  editLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  editNotesInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    minHeight: 56,
    textAlignVertical: 'top',
    marginBottom: 4,
  },
  editExCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 2,
  },
  editExHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  editExName: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  removeExText: { color: colors.textSecondary, fontSize: 12 },

  editSetBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  editSetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editSetLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  removeSetText: { color: colors.textSecondary, fontSize: 11 },
  editSetInputRow: { flexDirection: 'row', gap: 10 },
  editSetInputGroup: { flex: 1 },
  editSetInputLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
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
  editExLevelLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },

  effortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  effortChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  effortChipText: { color: colors.textSecondary, fontSize: 11 },
  effortChipTextActive: { color: colors.black, fontWeight: '700' },

  saveBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: colors.black, fontWeight: '700', fontSize: 15 },

  // Compact edit set rows
  esSetsBlock: { gap: 2, marginVertical: 6 },
  esRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 6 },
  esNum: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', width: 22 },
  esRepsInput: {
    width: 46, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingVertical: 6, color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center',
  },
  esWeightInput: {
    width: 52, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingVertical: 6, color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center',
  },
  esUnit: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  esSep: { color: colors.textSecondary, fontSize: 13 },
  esEffortPill: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginLeft: 2,
  },
  esEffortText: { fontSize: 10, fontWeight: '700' },
  esRemoveBtn: { marginLeft: 'auto' as any },
  esRemovePlaceholder: { width: 22 },
  esRemoveIcon: { fontSize: 14 },

  // Plan origin picker
  planPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 4,
  },
  planPickerValue: { flex: 1, color: colors.text, fontSize: 14 },
  planPickerChevron: { color: colors.textSecondary, fontSize: 20 },
  planModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  planModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 16,
    gap: 2,
  },
  planModalTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  planModalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  planModalItemSelected: { backgroundColor: 'transparent' },
  planModalItemText: { color: colors.text, fontSize: 15 },

  // Plan deviations
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  planCardTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  planCardOk: { color: '#4CAF50', fontSize: 13, fontWeight: '600' },
  planCardSkipped: { color: '#F44336', fontSize: 13 },
  planCardAdded: { color: colors.accent, fontSize: 13 },
  planCardDiff: { color: colors.textSecondary, fontSize: 12 },
  planCardOrder: { color: colors.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: 2 },
});
