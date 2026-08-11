import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { colors } from '../theme';
import { storage } from '../services/storage';
import type { Exercise, ExerciseCategory, PlannedExercise, PlannedSession, PlannedSet, SessionTemplate, SetMode } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';

const BLOCKS = ['Entrada en calor', 'Bloque Principal', 'Bloque Accesorio'];

function normalizeExercise(ex: PlannedExercise): PlannedExercise {
  if (ex.setTargets && ex.setTargets.length > 0) return ex;
  const count = ex.targetSets ?? 3;
  const mode: SetMode = ex.mode ?? 'reps';
  return {
    ...ex,
    setTargets: Array.from({ length: count }, () => ({
      targetReps: ex.targetReps ?? '',
      targetWeight: ex.targetWeight,
      mode,
    })),
  };
}

function shortBlock(bloque?: string): string {
  if (!bloque) return '·';
  if (bloque === 'Entrada en calor') return 'Calor';
  return bloque.replace('Bloque ', '');
}

type PlanSessionNavProp = NativeStackNavigationProp<RootStackParamList, 'PlanSession'>;
type PlanSessionRouteProp = RouteProp<RootStackParamList, 'PlanSession'>;

function plannedSessionToTemplate(session: PlannedSession): SessionTemplate {
  return {
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
      mode: e.mode,
    })),
  };
}

// ─── PlannedSetRow ─────────────────────────────────────────────────────────────

function PlannedSetRow({
  setIdx,
  set,
  isOnly,
  onUpdate,
  onRemove,
}: {
  setIdx: number;
  set: PlannedSet;
  isOnly: boolean;
  onUpdate: (u: Partial<PlannedSet>) => void;
  onRemove: () => void;
}) {
  function confirmRemove() {
    Alert.alert('Eliminar serie', `¿Eliminás la serie ${setIdx + 1}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: onRemove },
    ]);
  }

  const trashBtn = !isOnly ? (
    <TouchableOpacity onPress={confirmRemove} hitSlop={12} style={styles.removeSetBtn}>
      <Text style={styles.removeSetIcon}>🗑️</Text>
    </TouchableOpacity>
  ) : (
    <View style={styles.removeSetPlaceholder} />
  );

  if (set.mode === 'seconds') {
    return (
      <View style={styles.setRow}>
        <Text style={styles.setNum}>S{setIdx + 1}</Text>
        <TextInput
          style={styles.repsInput}
          value={set.targetReps}
          onChangeText={t => onUpdate({ targetReps: t })}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="done"
          selectTextOnFocus
        />
        <Text style={styles.kgLabel}>seg</Text>
        <View style={{ flex: 1 }} />
        {trashBtn}
      </View>
    );
  }

  return (
    <View style={styles.setRow}>
      <Text style={styles.setNum}>S{setIdx + 1}</Text>
      <TextInput
        style={styles.repsInput}
        value={set.targetReps}
        onChangeText={t => onUpdate({ targetReps: t })}
        keyboardType="default"
        placeholder="—"
        placeholderTextColor={colors.textSecondary}
        returnKeyType="done"
        selectTextOnFocus
      />
      <Text style={styles.setSep}>×</Text>
      <TextInput
        style={styles.weightInput}
        value={set.targetWeight !== undefined ? String(set.targetWeight) : ''}
        onChangeText={t => {
          const n = parseFloat(t);
          onUpdate({ targetWeight: isNaN(n) ? undefined : n });
        }}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.textSecondary}
        returnKeyType="done"
        selectTextOnFocus
      />
      <Text style={styles.kgLabel}>kg</Text>
      <View style={{ flex: 1 }} />
      {trashBtn}
    </View>
  );
}

// ─── PlanExerciseCard ──────────────────────────────────────────────────────────

function PlanExerciseCard({
  ex,
  exIdx,
  onRemove,
  onUpdate,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
  onDragStart,
  onDragMove,
  onDragEnd,
  isDraggingThis,
}: {
  ex: PlannedExercise;
  exIdx: number;
  onRemove: () => void;
  onUpdate: (u: Partial<PlannedExercise>) => void;
  onUpdateSet: (setIdx: number, u: Partial<PlannedSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setIdx: number) => void;
  onDragStart: (pageY: number) => void;
  onDragMove: (pageY: number, dy: number) => void;
  onDragEnd: () => void;
  isDraggingThis: boolean;
}) {
  const [collapsed, setCollapsed] = useState(true);

  // Stable refs for drag callbacks
  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);
  useEffect(() => {
    onDragStartRef.current = onDragStart;
    onDragMoveRef.current = onDragMove;
    onDragEndRef.current = onDragEnd;
  }, [onDragStart, onDragMove, onDragEnd]);

  const isDraggingRef = useRef(false);

  const dragPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isDraggingRef.current = false;
      },
      onPanResponderMove: (e, gs) => {
        if (!isDraggingRef.current && (Math.abs(gs.dy) > 6 || Math.abs(gs.dx) > 6)) {
          isDraggingRef.current = true;
          onDragStartRef.current(e.nativeEvent.pageY - gs.dy);
        }
        if (isDraggingRef.current) {
          onDragMoveRef.current(e.nativeEvent.pageY, gs.dy);
        }
      },
      onPanResponderRelease: () => {
        if (isDraggingRef.current) onDragEndRef.current();
        isDraggingRef.current = false;
      },
      onPanResponderTerminate: () => {
        if (isDraggingRef.current) onDragEndRef.current();
        isDraggingRef.current = false;
      },
    }),
  ).current;

  const sets = ex.setTargets ?? [];
  const mode: SetMode = ex.mode ?? 'reps';

  const summaryParts = sets.map(s =>
    s.targetReps
      ? (s.mode === 'seconds' || mode === 'seconds')
        ? `${s.targetReps}s`
        : (s.targetWeight ? `${s.targetReps}×${s.targetWeight}` : s.targetReps)
      : '—',
  );
  const summaryStr = summaryParts.length > 0 ? summaryParts.join(' / ') : null;

  function toggleMode(newMode: SetMode) {
    const updatedSets = sets.map(s => ({ ...s, mode: newMode }));
    onUpdate({ mode: newMode, setTargets: updatedSets });
  }

  function confirmRemove() {
    Alert.alert('Eliminar ejercicio', `¿Eliminás "${ex.exerciseName}" del plan?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: onRemove },
    ]);
  }

  return (
    <View style={[styles.exCard, isDraggingThis && styles.exCardDragging]}>
      {/* Header */}
      <View style={styles.exCardHeader}>
        {/* Drag handle */}
        <View {...dragPanResponder.panHandlers} style={styles.dragHandle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.dragHandleText}>≡</Text>
        </View>

        {/* Collapse area */}
        <TouchableOpacity
          style={styles.exHeaderCollapse}
          onPress={() => setCollapsed(v => !v)}
          activeOpacity={0.7}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.exName} numberOfLines={1}>{ex.exerciseName}</Text>
            {collapsed && (
              <Text style={styles.setSummaryText} numberOfLines={1}>
                {sets.length} serie{sets.length !== 1 ? 's' : ''}
                {summaryStr ? `  ·  ${summaryStr}` : ''}
                {ex.notes ? `  ·  ${ex.notes}` : ''}
              </Text>
            )}
          </View>
          <View style={styles.exHeaderRight}>
            <Text style={styles.sectionBadgeText}>{shortBlock(ex.bloque)}</Text>
            <TouchableOpacity onPress={confirmRemove} hitSlop={10}>
              <Text style={styles.removeExText}>🗑️</Text>
            </TouchableOpacity>
            <Text style={styles.chevron}>{collapsed ? '▼' : '▲'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {!collapsed && (
        <>
          {/* Mode toggle */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeChip, mode === 'reps' && styles.modeChipActive]}
              onPress={() => toggleMode('reps')}
              activeOpacity={0.8}>
              <Text style={[styles.modeChipText, mode === 'reps' && styles.modeChipTextActive]}>Reps</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeChip, mode === 'seconds' && styles.modeChipActive]}
              onPress={() => toggleMode('seconds')}
              activeOpacity={0.8}>
              <Text style={[styles.modeChipText, mode === 'seconds' && styles.modeChipTextActive]}>Seg</Text>
            </TouchableOpacity>
          </View>

          {/* Set rows */}
          <View style={styles.setsContainer}>
            {sets.map((set, setIdx) => (
              <PlannedSetRow
                key={setIdx}
                setIdx={setIdx}
                set={set}
                isOnly={sets.length === 1}
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
          </View>

          {/* Notes */}
          <View style={styles.notesRow}>
            <TextInput
              style={styles.exNotesInput}
              value={ex.notes ?? ''}
              onChangeText={t => onUpdate({ notes: t })}
              placeholder="Notas (ej: elástico potente, c/lado...)"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
            />
          </View>
        </>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PlanSessionScreen() {
  const navigation = useNavigation<PlanSessionNavProp>();
  const route = useRoute<PlanSessionRouteProp>();
  const existing = route.params?.session;
  const insets = useSafeAreaInsets();

  const [sessionName, setSessionName] = useState(existing?.name ?? '');
  const [exercises, setExercises] = useState<PlannedExercise[]>(
    existing?.exercises.map(normalizeExercise) ?? [],
  );
  const exercisesRef = useRef(exercises);
  useEffect(() => { exercisesRef.current = exercises; }, [exercises]);

  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState('');
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickForm, setQuickForm] = useState<{ name: string; category: ExerciseCategory; muscles: string }>({
    name: '', category: 'fuerza', muscles: '',
  });

  const [customBlocks, setCustomBlocks] = useState<string[]>(() => {
    if (!existing) return [];
    const custom = new Set<string>();
    (existing.exercises ?? []).forEach(ex => {
      if (ex.bloque && !BLOCKS.includes(ex.bloque)) custom.add(ex.bloque);
    });
    return Array.from(custom);
  });
  const [showNewSection, setShowNewSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  // ─── Drag state ───────────────────────────────────────────────────────────
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragFloatY, setDragFloatY] = useState(0);
  const [dragFloatTitle, setDragFloatTitle] = useState('');
  const [hoverBlock, setHoverBlock] = useState<string | null>(null);
  const [insertBeforeIdx, setInsertBeforeIdx] = useState<number | null | 'end'>('end');
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const dragDY = useRef(new Animated.Value(0)).current;
  const hoverBlockRef = useRef<string | null>(null);
  const draggingIdxRef = useRef<number | null>(null);
  const insertBeforeIdxRef = useRef<number | null | 'end'>('end');
  const sectionAbsY = useRef<Record<string, number>>({});
  const sectionViewRefs = useRef<Record<string, View | null>>({});
  const cardAbsY = useRef<Record<number, { y: number; height: number }>>({});
  const cardViewRefs = useRef<Record<number, View | null>>({});

  function measureSections() {
    for (const [name, ref] of Object.entries(sectionViewRefs.current)) {
      ref?.measureInWindow((_, y) => { sectionAbsY.current[name] = y; });
    }
    for (const [idxStr, ref] of Object.entries(cardViewRefs.current)) {
      ref?.measureInWindow((_, y, __, h) => {
        cardAbsY.current[parseInt(idxStr)] = { y, height: h };
      });
    }
  }

  function getSectionAtPageY(pageY: number): string | null {
    const entries = Object.entries(sectionAbsY.current).sort((a, b) => a[1] - b[1]);
    let result: string | null = null;
    for (const [name, y] of entries) {
      if (pageY >= y) result = name;
    }
    return result;
  }

  // Returns the exercise index to insert BEFORE, or null = append to end of section
  function getInsertPosition(pageY: number, targetSection: string, sourceIdx: number): number | null {
    const sectionItems = exercisesRef.current
      .map((ex, idx) => ({ ex, idx }))
      .filter(({ ex, idx }) => (ex.bloque || 'Sin sección') === targetSection && idx !== sourceIdx);

    for (const { idx } of sectionItems) {
      const card = cardAbsY.current[idx];
      if (!card) continue;
      if (pageY < card.y + card.height / 2) return idx;
    }
    return null; // append after last card in section
  }

  function handleDragStart(idx: number, pageY: number) {
    measureSections();
    draggingIdxRef.current = idx;
    hoverBlockRef.current = null;
    insertBeforeIdxRef.current = 'end';
    dragDY.setValue(0);
    setDraggingIdx(idx);
    setDragFloatY(pageY - insets.top - 24);
    setDragFloatTitle(exercisesRef.current[idx]?.exerciseName ?? '');
    setHoverBlock(null);
    setInsertBeforeIdx('end');
    setScrollEnabled(false);
  }

  function handleDragMove(pageY: number, dy: number) {
    dragDY.setValue(dy);
    const section = getSectionAtPageY(pageY);
    if (section !== hoverBlockRef.current) {
      hoverBlockRef.current = section;
      setHoverBlock(section);
    }
    if (section !== null && draggingIdxRef.current !== null) {
      const insertBefore = getInsertPosition(pageY, section, draggingIdxRef.current);
      if (insertBefore !== insertBeforeIdxRef.current) {
        insertBeforeIdxRef.current = insertBefore;
        setInsertBeforeIdx(insertBefore);
      }
    }
  }

  function handleDragEnd() {
    const sourceIdx = draggingIdxRef.current;
    const targetSection = hoverBlockRef.current;
    const insertBefore = insertBeforeIdxRef.current;

    if (sourceIdx !== null && targetSection !== null) {
      setExercises(prev => {
        const arr = [...prev];
        const [dragged] = arr.splice(sourceIdx, 1);
        dragged.bloque = targetSection === 'Sin sección' ? undefined : targetSection;

        if (insertBefore !== null && insertBefore !== 'end') {
          // Insert before a specific card; adjust index for the removal
          const insertAt = insertBefore > sourceIdx ? insertBefore - 1 : insertBefore;
          arr.splice(insertAt, 0, dragged);
        } else {
          // Append after last card in target section
          let lastIdx = arr.length;
          for (let i = arr.length - 1; i >= 0; i--) {
            if ((arr[i].bloque || 'Sin sección') === targetSection) {
              lastIdx = i + 1;
              break;
            }
          }
          arr.splice(lastIdx, 0, dragged);
        }
        return arr;
      });
    }

    dragDY.setValue(0);
    setDraggingIdx(null);
    setScrollEnabled(true);
    setHoverBlock(null);
    setInsertBeforeIdx('end');
    hoverBlockRef.current = null;
    draggingIdxRef.current = null;
    insertBeforeIdxRef.current = 'end';
  }

  // ─── Quick create ─────────────────────────────────────────────────────────

  async function handleQuickCreate() {
    const name = quickForm.name.trim() || pickerFilter.trim();
    if (!name) return;
    const ex: Exercise = {
      id: `ex_${Date.now()}`,
      name,
      category: quickForm.category,
      muscleGroups: quickForm.muscles.split(',').map(s => s.trim()).filter(Boolean),
      met: 4,
    };
    await storage.saveExercise(ex);
    setAllExercises(prev => [...prev, ex]);
    setShowQuickCreate(false);
    setQuickForm({ name: '', category: 'fuerza', muscles: '' });
    addExercise(ex);
  }

  useFocusEffect(
    useCallback(() => {
      storage.getExercises().then(setAllExercises);
    }, []),
  );

  const filteredExercises = allExercises.filter(e =>
    e.name.toLowerCase().includes(pickerFilter.toLowerCase()) ||
    e.muscleGroups.some(g => g.toLowerCase().includes(pickerFilter.toLowerCase())),
  );

  // ─── Exercise operations ──────────────────────────────────────────────────

  function addExercise(ex: Exercise) {
    const planned: PlannedExercise = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      targetSets: 3,
      targetReps: '',
      notes: '',
      mode: 'reps',
      setTargets: [
        { targetReps: '', targetWeight: undefined, mode: 'reps' },
        { targetReps: '', targetWeight: undefined, mode: 'reps' },
        { targetReps: '', targetWeight: undefined, mode: 'reps' },
      ],
    };
    setExercises(prev => [...prev, planned]);
    setShowPicker(false);
    setPickerFilter('');
  }

  function removeExercise(idx: number) {
    setExercises(prev => prev.filter((_, i) => i !== idx));
  }

  function updateExercise(idx: number, update: Partial<PlannedExercise>) {
    setExercises(prev => prev.map((e, i) => (i === idx ? { ...e, ...update } : e)));
  }

  function updateSet(exIdx: number, setIdx: number, update: Partial<PlannedSet>) {
    setExercises(prev =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const newTargets = (ex.setTargets ?? []).map((s, j) => (j !== setIdx ? s : { ...s, ...update }));
        return { ...ex, setTargets: newTargets };
      }),
    );
  }

  function addSet(exIdx: number) {
    setExercises(prev =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const exMode: SetMode = ex.mode ?? 'reps';
        const newSet: PlannedSet = { targetReps: '', targetWeight: undefined, mode: exMode };
        return { ...ex, setTargets: [...(ex.setTargets ?? []), newSet] };
      }),
    );
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExercises(prev =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const targets = ex.setTargets ?? [];
        if (targets.length <= 1) return ex;
        return { ...ex, setTargets: targets.filter((_, j) => j !== setIdx) };
      }),
    );
  }

  // ─── Section operations ───────────────────────────────────────────────────

  function handleAddSection() {
    setNewSectionName('');
    setShowNewSection(true);
  }

  function confirmNewSection() {
    const name = newSectionName.trim();
    if (!name) return;
    if (!customBlocks.includes(name)) {
      setCustomBlocks(prev => [...prev, name]);
    }
    setShowNewSection(false);
    setNewSectionName('');
  }

  // ─── Render by block ──────────────────────────────────────────────────────

  function renderExercisesByBlock(exs: PlannedExercise[]) {
    const grouped: Record<string, { ex: PlannedExercise; idx: number }[]> = {};
    exs.forEach((ex, idx) => {
      const key = ex.bloque || 'Sin sección';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ ex, idx });
    });

    const uniqueKeys: string[] = [];
    BLOCKS.forEach(k => { if (grouped[k]) uniqueKeys.push(k); });
    customBlocks.forEach(k => { if (!uniqueKeys.includes(k)) uniqueKeys.push(k); });
    Object.keys(grouped).forEach(k => { if (!uniqueKeys.includes(k)) uniqueKeys.push(k); });

    return uniqueKeys.map(blockName => {
      const items = grouped[blockName] ?? [];
      const isCustom = customBlocks.includes(blockName);
      const isEmpty = items.length === 0;
      const isHovered = hoverBlock === blockName && draggingIdx !== null;

      return (
        <View
          key={blockName}
          style={styles.blockSection}
          ref={ref => { sectionViewRefs.current[blockName] = ref; }}>
          <View style={styles.blockHeaderRow}>
            <Text style={[styles.blockLabel, isHovered && styles.blockLabelHovered]}>
              {blockName.toUpperCase()}
            </Text>
            {isCustom && isEmpty && (
              <TouchableOpacity
                onPress={() => setCustomBlocks(prev => prev.filter(b => b !== blockName))}
                hitSlop={10}
                style={styles.discardBlockBtn}>
                <Text style={styles.discardBlockText}>🗑️ Descartar</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.blockDropZone, isHovered && styles.blockDropZoneHovered]}>
            {isEmpty ? (
              <Text style={styles.emptyBlockText}>Sin ejercicios</Text>
            ) : (
              items.map(({ ex, idx }) => (
                <React.Fragment key={`${ex.exerciseId}-${idx}`}>
                  {/* Insertion indicator BEFORE this card */}
                  {draggingIdx !== null && insertBeforeIdx === idx && (
                    <View style={styles.insertionIndicator} />
                  )}
                  <View
                    ref={ref => { cardViewRefs.current[idx] = ref; }}
                    onLayout={() => {
                      cardViewRefs.current[idx]?.measureInWindow((_, y, __, h) => {
                        cardAbsY.current[idx] = { y, height: h };
                      });
                    }}>
                    <PlanExerciseCard
                      ex={ex}
                      exIdx={idx}
                      onRemove={() => removeExercise(idx)}
                      onUpdate={u => updateExercise(idx, u)}
                      onUpdateSet={(setIdx, u) => updateSet(idx, setIdx, u)}
                      onAddSet={() => addSet(idx)}
                      onRemoveSet={setIdx => removeSet(idx, setIdx)}
                      onDragStart={pageY => handleDragStart(idx, pageY)}
                      onDragMove={(pageY, dy) => handleDragMove(pageY, dy)}
                      onDragEnd={handleDragEnd}
                      isDraggingThis={draggingIdx === idx}
                    />
                  </View>
                </React.Fragment>
              ))
            )}
            {/* Insertion indicator at END of section */}
            {draggingIdx !== null && insertBeforeIdx === null && hoverBlock === blockName && (
              <View style={styles.insertionIndicator} />
            )}
          </View>
        </View>
      );
    });
  }

  // ─── Save / start ─────────────────────────────────────────────────────────

  function buildSession(): PlannedSession {
    const id = existing?.id ?? `plan_${Date.now()}`;
    return {
      id,
      name: sessionName.trim() || undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      exercises: exercises.map(ex => ({
        ...ex,
        targetSets: ex.setTargets?.length ?? ex.targetSets ?? 3,
      })),
    };
  }

  async function handleSave() {
    if (exercises.length === 0) {
      Alert.alert('Sin ejercicios', 'Agregá al menos un ejercicio al plan.');
      return;
    }
    await storage.savePlannedSession(buildSession());
    navigation.goBack();
  }

  async function handleStartNow() {
    if (exercises.length === 0) {
      Alert.alert('Sin ejercicios', 'Agregá al menos un ejercicio al plan.');
      return;
    }
    const session = buildSession();
    await storage.savePlannedSession(session);
    await storage.setPendingTemplate(plannedSessionToTemplate(session));
    navigation.navigate('MainTabs');
  }

  const modalPadBottom = Math.max(24, insets.bottom + 20);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.backBtnText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{existing ? 'Editar plan' : 'Planificar sesión'}</Text>
          <View style={{ width: 70 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollEnabled}>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>NOMBRE (OPCIONAL)</Text>
            <TextInput
              style={styles.nameInput}
              value={sessionName}
              onChangeText={setSessionName}
              placeholder="Ej: Día 1 - Piernas"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
            />
          </View>

          {(exercises.length > 0 || customBlocks.length > 0) && (
            <View style={styles.exercisesSection}>
              {renderExercisesByBlock(exercises)}
            </View>
          )}

          <TouchableOpacity style={styles.addExBtn} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
            <Text style={styles.addExBtnText}>+ Agregar ejercicio</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.addSectionBtn} onPress={handleAddSection} activeOpacity={0.8}>
            <Text style={styles.addSectionBtnText}>+ Nueva sección</Text>
          </TouchableOpacity>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveBtnText}>Guardar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.startNowBtn} onPress={handleStartNow} activeOpacity={0.8}>
              <Text style={styles.startNowBtnText}>Empezar ahora</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating drag card */}
      {draggingIdx !== null && (
        <Animated.View
          pointerEvents="none"
          style={[styles.floatingCard, { top: dragFloatY, transform: [{ translateY: dragDY }] }]}>
          <Text style={styles.floatingCardText} numberOfLines={1}>{dragFloatTitle}</Text>
        </Animated.View>
      )}

      {/* ─── Exercise picker modal ───────────────────────────────────────── */}
      <Modal visible={showPicker} animationType="slide" transparent onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: modalPadBottom }]}>
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
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: 20, gap: 12 }}>
                  <Text style={styles.emptyText}>Sin resultados</Text>
                  {pickerFilter.trim().length > 0 && (
                    <TouchableOpacity
                      style={styles.createInlineBtn}
                      onPress={() => { setQuickForm(f => ({ ...f, name: pickerFilter })); setShowQuickCreate(true); }}
                      activeOpacity={0.8}>
                      <Text style={styles.createInlineBtnText}>+ Crear "{pickerFilter}"</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
              ListFooterComponent={
                filteredExercises.length > 0 ? (
                  <TouchableOpacity
                    style={[styles.createInlineBtn, { marginTop: 8 }]}
                    onPress={() => { setQuickForm(f => ({ ...f, name: pickerFilter })); setShowQuickCreate(true); }}
                    activeOpacity={0.8}>
                    <Text style={styles.createInlineBtnText}>+ Crear nuevo ejercicio</Text>
                  </TouchableOpacity>
                ) : null
              }
            />
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowPicker(false); setPickerFilter(''); }}>
              <Text style={styles.modalCancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Quick create modal ──────────────────────────────────────────── */}
      <Modal visible={showQuickCreate} animationType="slide" transparent onRequestClose={() => setShowQuickCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: modalPadBottom }]}>
            <Text style={styles.modalTitle}>Nuevo ejercicio</Text>
            <Text style={styles.quickLabel}>Nombre</Text>
            <TextInput
              style={styles.quickInput}
              value={quickForm.name}
              onChangeText={t => setQuickForm(f => ({ ...f, name: t }))}
              placeholder="Ej: Press de banca"
              placeholderTextColor={colors.textSecondary}
              autoFocus
              returnKeyType="done"
            />
            <Text style={styles.quickLabel}>Categoría</Text>
            <View style={styles.quickCategoryRow}>
              {(['fuerza', 'cardio', 'peso_corporal'] as ExerciseCategory[]).map(cat => {
                const labels: Record<ExerciseCategory, string> = { fuerza: 'Fuerza', cardio: 'Cardio', peso_corporal: 'Peso corporal' };
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.quickCatChip, quickForm.category === cat && styles.quickCatChipActive]}
                    onPress={() => setQuickForm(f => ({ ...f, category: cat }))}>
                    <Text style={[styles.quickCatChipText, quickForm.category === cat && styles.quickCatChipTextActive]}>
                      {labels[cat]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.quickLabel}>Músculos (separados por coma)</Text>
            <TextInput
              style={styles.quickInput}
              value={quickForm.muscles}
              onChangeText={t => setQuickForm(f => ({ ...f, muscles: t }))}
              placeholder="Ej: pecho, tríceps"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
            />
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickCancelBtn}
                onPress={() => { setShowQuickCreate(false); setQuickForm({ name: '', category: 'fuerza', muscles: '' }); }}>
                <Text style={styles.quickCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickSaveBtn} onPress={handleQuickCreate} activeOpacity={0.8}>
                <Text style={styles.quickSaveBtnText}>Crear y agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Nueva sección modal ─────────────────────────────────────────── */}
      <Modal visible={showNewSection} animationType="fade" transparent onRequestClose={() => setShowNewSection(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: modalPadBottom }]}>
            <Text style={styles.modalTitle}>Nueva sección</Text>
            <TextInput
              style={styles.quickInput}
              value={newSectionName}
              onChangeText={setNewSectionName}
              placeholder="Ej: Cardio final, Movilidad..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmNewSection}
            />
            <View style={[styles.quickActions, { marginTop: 16 }]}>
              <TouchableOpacity style={styles.quickCancelBtn} onPress={() => setShowNewSection(false)}>
                <Text style={styles.quickCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickSaveBtn} onPress={confirmNewSection} activeOpacity={0.8}>
                <Text style={styles.quickSaveBtnText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtnText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },

  scroll: { padding: 20, gap: 16, paddingBottom: 40 },

  fieldGroup: { gap: 8 },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },

  exercisesSection: { gap: 4 },
  blockSection: { gap: 6, marginBottom: 4 },
  blockHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  blockLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  blockLabelHovered: { color: colors.text },
  discardBlockBtn: { paddingVertical: 4 },
  discardBlockText: { color: colors.textSecondary, fontSize: 12, opacity: 0.65 },

  blockDropZone: {
    borderRadius: 12,
    gap: 6,
    padding: 2,
  },
  blockDropZoneHovered: {
    backgroundColor: 'rgba(245,166,35,0.08)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    padding: 6,
  },
  emptyBlockText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 14,
  },
  insertionIndicator: {
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: 1,
    marginVertical: 2,
  },

  // ─── Exercise card ────────────────────────────────────────────────────────
  exCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exCardDragging: {
    opacity: 0.4,
    borderColor: colors.accent,
  },
  exCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  dragHandle: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  dragHandleText: {
    color: colors.textSecondary,
    fontSize: 16,
    opacity: 0.5,
    letterSpacing: 1,
  },
  exHeaderCollapse: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  exName: { color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1, flex: 1 },
  setSummaryText: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  exHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  sectionBadgeText: { color: colors.textSecondary, fontSize: 11, opacity: 0.7 },
  removeExText: { fontSize: 15, opacity: 0.45 },
  chevron: { color: colors.textSecondary, fontSize: 10 },

  // ─── Mode toggle ──────────────────────────────────────────────────────────
  modeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 8 },
  modeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  modeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  modeChipTextActive: { color: colors.black, fontWeight: '700' },

  // ─── Set rows ─────────────────────────────────────────────────────────────
  setsContainer: { paddingHorizontal: 14, gap: 6 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  setNum: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', width: 20 },
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
  kgLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  removeSetBtn: { paddingLeft: 8 },
  removeSetIcon: { fontSize: 14, opacity: 0.45 },
  removeSetPlaceholder: { width: 30 },

  // ─── Exercise footer ──────────────────────────────────────────────────────
  exFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  addSetBtn: { paddingVertical: 2 },
  addSetBtnText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  notesRow: { paddingHorizontal: 14, paddingBottom: 12, paddingTop: 6 },
  exNotesInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 13,
  },

  // ─── Floating drag card ───────────────────────────────────────────────────
  floatingCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 999,
  },
  floatingCardText: { color: colors.text, fontSize: 14, fontWeight: '700' },

  // ─── Bottom buttons ───────────────────────────────────────────────────────
  addExBtn: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
  },
  addExBtnText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  addSectionBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addSectionBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },

  actions: { gap: 10 },
  saveBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  startNowBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startNowBtnText: { color: colors.black, fontSize: 15, fontWeight: '700' },

  // ─── Modals ───────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '90%',
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
  pickerList: { maxHeight: 300 },
  pickerRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerRowName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  pickerRowMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  emptyText: { color: colors.textSecondary, textAlign: 'center' },
  modalCancelBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  modalCancelBtnText: { color: colors.textSecondary, fontSize: 15 },

  createInlineBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'center',
  },
  createInlineBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },

  quickLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  quickInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  quickCategoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickCatChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  quickCatChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  quickCatChipText: { color: colors.textSecondary, fontSize: 13 },
  quickCatChipTextActive: { color: colors.black, fontWeight: '700' },
  quickActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  quickCancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  quickCancelText: { color: colors.text, fontSize: 15 },
  quickSaveBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  quickSaveBtnText: { color: colors.black, fontWeight: '700', fontSize: 15 },
});
