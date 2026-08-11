import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  NativeModules,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { colors } from '../theme';
import { storage } from '../services/storage';
import { parseWorkoutPDF } from '../services/groq';
import type { Exercise, ExerciseCategory, PlannedSession, PlannedSet, SetMode } from '../types';
import type { ParsedWorkoutPlan } from '../services/groq';
import type { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';

type ExercisesNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Ejercicios'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  fuerza: 'Fuerza',
  cardio: 'Cardio',
  peso_corporal: 'Peso corporal',
};

// ─── Exercise row ─────────────────────────────────────────────────────────────

function ExerciseRow({
  exercise,
  onDelete,
}: {
  exercise: Exercise;
  onDelete: (id: string) => void;
}) {
  function confirmDelete() {
    Alert.alert('Eliminar ejercicio', `¿Eliminar "${exercise.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(exercise.id) },
    ]);
  }

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>{exercise.name}</Text>
        <Text style={styles.rowMeta}>
          {CATEGORY_LABELS[exercise.category]}
          {'  ·  '}
          {exercise.muscleGroups.join(', ')}
          {'  ·  MET '}
          {exercise.met}
        </Text>
      </View>
      <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn} hitSlop={8}>
        <Text style={styles.deleteBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Plan row ─────────────────────────────────────────────────────────────────

function PlanRow({
  plan,
  onPress,
  onDelete,
  onToggleActive,
}: {
  plan: PlannedSession;
  onPress: () => void;
  onDelete: (id: string) => void;
  onToggleActive: (plan: PlannedSession) => void;
}) {
  const isActive = plan.active !== false;

  function confirmDelete() {
    Alert.alert('Eliminar plan', `¿Eliminar "${plan.name || 'Sesión sin nombre'}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(plan.id) },
    ]);
  }

  const preview = plan.exercises
    .slice(0, 3)
    .map(e => e.exerciseName)
    .join(', ') + (plan.exercises.length > 3 ? '...' : '');

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} onLongPress={confirmDelete} activeOpacity={0.75}>
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>{plan.name || 'Sesión sin nombre'}</Text>
        <Text style={styles.rowMeta}>
          {plan.exercises.length} ejercicio{plan.exercises.length !== 1 ? 's' : ''}
        </Text>
        {preview ? <Text style={styles.rowPreview}>{preview}</Text> : null}
      </View>
      <TouchableOpacity
        style={[styles.toggleBtn, !isActive && styles.toggleBtnInactive]}
        onPress={() => onToggleActive(plan)}
        hitSlop={8}>
        <Text style={[styles.toggleBtnText, !isActive && styles.toggleBtnTextInactive]}>
          {isActive ? 'Activo' : 'Inactivo'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.rowChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── New exercise form ────────────────────────────────────────────────────────

interface NewExerciseForm {
  name: string;
  category: ExerciseCategory;
  muscleGroups: string;
  met: string;
}

const EMPTY_FORM: NewExerciseForm = {
  name: '',
  category: 'fuerza',
  muscleGroups: '',
  met: '4',
};

// ─── Main screen ──────────────────────────────────────────────────────────────

type Tab = 'ejercicios' | 'planes';

export default function ExercisesScreen() {
  const navigation = useNavigation<ExercisesNavProp>();
  const [activeTab, setActiveTab] = useState<Tab>('ejercicios');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<PlannedSession[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showImportSheet, setShowImportSheet] = useState(false);
  const [form, setForm] = useState<NewExerciseForm>(EMPTY_FORM);
  const [importing, setImporting] = useState(false);
  const [exSearch, setExSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      storage.getExercises().then(setExercises);
      storage.getPlannedSessions().then(setPlans);
    }, []),
  );

  // ─── Exercises ─────────────────────────────────────────────────────────────

  async function handleDeleteExercise(id: string) {
    await storage.deleteExercise(id);
    setExercises(prev => prev.filter(e => e.id !== id));
  }

  async function handleSaveExercise() {
    if (!form.name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio.');
      return;
    }
    const met = parseFloat(form.met);
    if (isNaN(met) || met <= 0) {
      Alert.alert('Error', 'El MET debe ser un número positivo.');
      return;
    }
    const exercise: Exercise = {
      id: `ex_${Date.now()}`,
      name: form.name.trim(),
      category: form.category,
      muscleGroups: form.muscleGroups
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      met,
    };
    await storage.saveExercise(exercise);
    setExercises(await storage.getExercises());
    setShowModal(false);
    setForm(EMPTY_FORM);
  }

  // ─── Plans ─────────────────────────────────────────────────────────────────

  async function handleDeletePlan(id: string) {
    await storage.deletePlannedSession(id);
    setPlans(prev => prev.filter(p => p.id !== id));
  }

  async function handleTogglePlanActive(plan: PlannedSession) {
    const updated = { ...plan, active: plan.active === false ? true : false };
    await storage.savePlannedSession(updated);
    setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function buildSetTargets(repsStr: string, numSets: number, weightKg?: number | null): { sets: PlannedSet[]; mode: SetMode; notes?: string } {
    // 1. Extract side notes
    let notes: string | undefined;
    let cleanReps = repsStr;
    const sideNoteRegex = /\s*(c\/lado|de cada lado|x lado|c\/u|cada lado|por lado)\b/gi;
    const sideNoteMatches = cleanReps.match(sideNoteRegex);
    if (sideNoteMatches) {
      notes = sideNoteMatches.map(s => s.trim()).join(', ');
      cleanReps = cleanReps.replace(sideNoteRegex, '').trim();
    }

    // 2. Detect seconds ('' or " notation, e.g. 30'' or 30")
    const isSeconds = /\d+[''`"]{1,2}/.test(cleanReps);
    const mode: SetMode = isSeconds ? 'seconds' : 'reps';
    cleanReps = cleanReps.replace(/[''`"]{1,2}/g, '').trim();

    // 3. Build set targets
    const w = weightKg ?? undefined;
    let sets: PlannedSet[];
    if (cleanReps.includes('/')) {
      sets = cleanReps.split('/').map(r => ({ targetReps: r.trim(), targetWeight: w, mode }));
    } else {
      const xMatch = cleanReps.match(/^(\d+)[xX](\S+)$/);
      if (xMatch) {
        const count = parseInt(xMatch[1]);
        sets = Array.from({ length: count }, () => ({ targetReps: xMatch[2], targetWeight: w, mode }));
      } else {
        sets = Array.from({ length: numSets > 0 ? numSets : 3 }, () => ({ targetReps: cleanReps, targetWeight: w, mode }));
      }
    }
    return { sets, mode, notes };
  }

  // ─── Import flow ────────────────────────────────────────────────────────────

  async function processBase64Image(pagesBase64: string[], groqKey: string) {
    const plan: ParsedWorkoutPlan = await parseWorkoutPDF({ pagesBase64, groqKey });

    const allExercises = await storage.getExercises();
    const newPlans: PlannedSession[] = [];

    for (const dia of plan.dias) {
      const planExercises: PlannedSession['exercises'] = [];

      for (const bloque of (dia.bloques ?? [])) {
        for (const ej of (bloque.ejercicios ?? [])) {
          const ejLower = ej.nombre.toLowerCase();
          let found = allExercises.find(
            e =>
              e.name.toLowerCase() === ejLower ||
              e.name.toLowerCase().includes(ejLower) ||
              ejLower.includes(e.name.toLowerCase()),
          );

          if (!found) {
            const newEx: Exercise = {
              id: `ex_imported_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              name: ej.nombre,
              muscleGroups: [],
              category: 'fuerza',
              met: 4,
            };
            await storage.saveExercise(newEx);
            allExercises.push(newEx);
            found = newEx;
          }

          const numSets = typeof ej.series === 'number' ? ej.series : parseInt(String(ej.series), 10) || 3;
          const repsStr = ej.reps ?? '';
          const weightKg = typeof ej.peso === 'number' ? ej.peso : undefined;
          const { sets: setTargets, mode, notes: parsedNotes } = buildSetTargets(repsStr, numSets, weightKg);
          // Also pick up notes from groq notas field or detalle
          const exerciseNotes = ej.notas || parsedNotes || (ej.detalle && ej.detalle.length < 80 ? ej.detalle : undefined);

          planExercises.push({
            exerciseId: found.id,
            exerciseName: found.name,
            targetSets: setTargets.length,
            targetReps: repsStr,
            targetWeight: weightKg,
            setTargets,
            bloque: bloque.nombre,
            mode,
            notes: exerciseNotes,
          });
        }
      }

      const newPlan: PlannedSession = {
        id: `plan_${Date.now()}_${dia.nombre.replace(/\s+/g, '_')}`,
        name: dia.nombre.replace('Dia', 'Día'),
        createdAt: new Date().toISOString(),
        exercises: planExercises,
      };
      await storage.savePlannedSession(newPlan);
      newPlans.push(newPlan);
    }

    setPlans(await storage.getPlannedSessions());
    setActiveTab('planes');

    const names = newPlans.map(p => p.name).join(', ');
    Alert.alert('Importación exitosa', `Se importaron ${newPlans.length} planes: ${names}`);
  }

  async function handleImportFromPdf() {
    const profile = await storage.getProfile();
    if (!profile?.groqKey) {
      Alert.alert('Sin clave Groq', 'Configurá tu clave Groq en Perfil primero.');
      return;
    }
    const groqKey = profile.groqKey;

    let uri: string | null = null;
    try {
      uri = await NativeModules.FilePicker.pickPdf();
    } catch (err) {
      Alert.alert('Error', 'No se pudo abrir el selector de archivos.');
      return;
    }
    if (!uri) return;

    setImporting(true);
    try {
      const pageCount: number = await NativeModules.PdfRenderer.getPageCount(uri);
      const pages = Math.min(pageCount, 5); // Groq max 5 images
      const pagesBase64: string[] = [];
      for (let i = 0; i < pages; i++) {
        const b64: string = await NativeModules.PdfRenderer.renderPageToBase64(uri, i);
        pagesBase64.push(b64);
      }
      await processBase64Image(pagesBase64, groqKey);
    } catch (err) {
      Alert.alert('Error al importar PDF', String(err));
    } finally {
      setImporting(false);
    }
  }

  async function handleImportFromImage() {
    const profile = await storage.getProfile();
    if (!profile?.groqKey) {
      Alert.alert('Sin clave Groq', 'Configurá tu clave Groq en Perfil primero.');
      return;
    }
    const groqKey = profile.groqKey;

    launchImageLibrary({ mediaType: 'photo', includeBase64: true }, async response => {
      if (response.didCancel || !response.assets?.length) return;
      const asset = response.assets[0];
      if (!asset.base64) {
        Alert.alert('Error', 'No se pudo obtener la imagen en base64.');
        return;
      }
      setImporting(true);
      try {
        await processBase64Image([asset.base64], groqKey);
      } catch (err) {
        Alert.alert('Error al importar', String(err));
      } finally {
        setImporting(false);
      }
    });
  }

  const categories: ExerciseCategory[] = ['fuerza', 'cardio', 'peso_corporal'];

  const filteredExList = exSearch.trim()
    ? exercises.filter(e =>
        e.name.toLowerCase().includes(exSearch.toLowerCase()) ||
        e.muscleGroups.some(g => g.toLowerCase().includes(exSearch.toLowerCase())),
      )
    : exercises;

  return (
    <SafeAreaView style={styles.container}>
      {/* Loading overlay */}
      <Modal visible={importing} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Analizando con IA...</Text>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Ejercicios</Text>
        {activeTab === 'ejercicios' && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>+ Agregar</Text>
          </TouchableOpacity>
        )}
        {activeTab === 'planes' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.importBtnHeader} onPress={() => setShowImportSheet(true)} activeOpacity={0.8}>
              <Text style={styles.importBtnHeaderText}>Importar ▾</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('PlanSession', undefined)} activeOpacity={0.8}>
              <Text style={styles.addBtnText}>+ Nuevo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Segmented control */}
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'ejercicios' && styles.segmentActive]}
          onPress={() => setActiveTab('ejercicios')}
          activeOpacity={0.8}>
          <Text style={[styles.segmentText, activeTab === 'ejercicios' && styles.segmentTextActive]}>
            Ejercicios
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'planes' && styles.segmentActive]}
          onPress={() => setActiveTab('planes')}
          activeOpacity={0.8}>
          <Text style={[styles.segmentText, activeTab === 'planes' && styles.segmentTextActive]}>
            Planes
          </Text>
        </TouchableOpacity>
      </View>

      {/* Exercises tab */}
      {activeTab === 'ejercicios' && (
        <>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={exSearch}
              onChangeText={setExSearch}
              placeholder="Buscar ejercicio..."
              placeholderTextColor={colors.textSecondary}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
          <FlatList
            data={filteredExList}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <ExerciseRow exercise={item} onDelete={handleDeleteExercise} />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Sin ejercicios.</Text>
              </View>
            }
          />
        </>
      )}

      {/* Plans tab */}
      {activeTab === 'planes' && (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {/* Active plans */}
          {plans.filter(p => p.active !== false).length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Sin planes activos.</Text>
              <Text style={styles.emptySubText}>
                Importá tu plan desde un PDF o imagen, o creá uno desde Inicio.
              </Text>
            </View>
          )}
          {plans.filter(p => p.active !== false).map(item => (
            <PlanRow
              key={item.id}
              plan={item}
              onPress={() => navigation.navigate('PlanSession', { session: item })}
              onDelete={handleDeletePlan}
              onToggleActive={handleTogglePlanActive}
            />
          ))}

          {/* Inactive / archived plans */}
          {plans.filter(p => p.active === false).length > 0 && (
            <>
              <Text style={styles.sectionDivider}>HISTORIAL DE PLANES</Text>
              {plans.filter(p => p.active === false).map(item => (
                <PlanRow
                  key={item.id}
                  plan={item}
                  onPress={() => navigation.navigate('PlanSession', { session: item })}
                  onDelete={handleDeletePlan}
                  onToggleActive={handleTogglePlanActive}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Import sheet */}
      <Modal visible={showImportSheet} animationType="slide" transparent onRequestClose={() => setShowImportSheet(false)}>
        <TouchableOpacity style={styles.sheetOverlay} onPress={() => setShowImportSheet(false)} activeOpacity={1}>
          <View style={styles.sheetBox}>
            <Text style={styles.sheetTitle}>Importar plan</Text>
            <TouchableOpacity style={styles.sheetOption} onPress={() => { setShowImportSheet(false); handleImportFromPdf(); }} activeOpacity={0.8}>
              <Text style={styles.sheetOptionText}>Desde PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetOption} onPress={() => { setShowImportSheet(false); handleImportFromImage(); }} activeOpacity={0.8}>
              <Text style={styles.sheetOptionText}>Desde imagen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setShowImportSheet(false)}>
              <Text style={styles.sheetCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* New exercise modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Nuevo ejercicio</Text>

              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={t => setForm(f => ({ ...f, name: t }))}
                placeholder="Ej: Press de banca"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.label}>Categoría</Text>
              <View style={styles.categoryRow}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, form.category === cat && styles.categoryChipActive]}
                    onPress={() => setForm(f => ({ ...f, category: cat }))}>
                    <Text style={[styles.categoryChipText, form.category === cat && styles.categoryChipTextActive]}>
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Grupos musculares (separados por coma)</Text>
              <TextInput
                style={styles.input}
                value={form.muscleGroups}
                onChangeText={t => setForm(f => ({ ...f, muscleGroups: t }))}
                placeholder="Ej: pecho, tríceps, hombros"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.label}>MET (metabolic equivalent)</Text>
              <TextInput
                style={styles.input}
                value={form.met}
                onChangeText={t => setForm(f => ({ ...f, met: t }))}
                keyboardType="decimal-pad"
                placeholder="Ej: 5"
                placeholderTextColor={colors.textSecondary}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setShowModal(false); setForm(EMPTY_FORM); }}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveExercise}>
                  <Text style={styles.saveBtnText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  addBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: colors.black, fontWeight: '700', fontSize: 14 },

  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  segmentTextActive: { color: colors.black, fontWeight: '700' },

  importBtnHeader: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  importBtnHeaderText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheetBox: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 2 },
  sheetTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  sheetOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetOptionText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  sheetCancel: { paddingVertical: 16, alignItems: 'center' },
  sheetCancelText: { color: colors.textSecondary, fontSize: 15 },

  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowMain: { flex: 1 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  rowPreview: { color: colors.textSecondary, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  rowChevron: { color: colors.accent, fontSize: 22, fontWeight: '300', paddingLeft: 4 },
  deleteBtn: { paddingLeft: 12 },
  toggleBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  toggleBtnInactive: { borderColor: colors.border },
  toggleBtnText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  toggleBtnTextInactive: { color: colors.textSecondary },
  sectionDivider: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
  },
  deleteBtnText: { color: colors.textSecondary, fontSize: 16 },
  searchRow: { paddingHorizontal: 20, paddingBottom: 12 },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: colors.textSecondary, fontSize: 15 },
  emptySubText: { color: colors.textSecondary, fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },

  loadingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  loadingBox: { backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 32, alignItems: 'center', gap: 16, minWidth: 220 },
  loadingText: { color: colors.text, fontSize: 15, fontWeight: '600', textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 15 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  categoryChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  categoryChipText: { color: colors.textSecondary, fontSize: 13 },
  categoryChipTextActive: { color: colors.black, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: colors.text, fontSize: 15 },
  saveBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: colors.black, fontWeight: '700', fontSize: 15 },
});
