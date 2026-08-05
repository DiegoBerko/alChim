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
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { colors } from '../theme';
import { storage } from '../services/storage';
import { parseWorkoutPDF } from '../services/groq';
import type { Exercise, ExerciseCategory, SessionTemplate } from '../types';
import type { ParsedWorkoutPlan } from '../services/groq';

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
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => onDelete(exercise.id),
      },
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

// ─── Template row ─────────────────────────────────────────────────────────────

function TemplateRow({
  template,
  onDelete,
  onRename,
}: {
  template: SessionTemplate;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(template.name);

  function confirmDelete() {
    Alert.alert('Eliminar template', `¿Eliminar "${template.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => onDelete(template.id),
      },
    ]);
  }

  function finishRename() {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== template.name) {
      onRename(template.id, trimmed);
    } else {
      setName(template.name);
    }
  }

  return (
    <TouchableOpacity
      style={styles.row}
      onLongPress={confirmDelete}
      activeOpacity={0.8}>
      <View style={styles.rowMain}>
        {editing ? (
          <TextInput
            style={styles.renameInput}
            value={name}
            onChangeText={setName}
            onBlur={finishRename}
            onSubmitEditing={finishRename}
            autoFocus
            returnKeyType="done"
            placeholderTextColor={colors.textSecondary}
          />
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={styles.rowName}>{template.name}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.rowMeta}>
          {template.exercises.length} ejercicio{template.exercises.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn} hitSlop={8}>
        <Text style={styles.deleteBtnText}>✕</Text>
      </TouchableOpacity>
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

type Tab = 'ejercicios' | 'templates';

export default function ExercisesScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('ejercicios');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewExerciseForm>(EMPTY_FORM);
  const [importing, setImporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      storage.getExercises().then(setExercises);
      storage.getTemplates().then(setTemplates);
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
    const updated = await storage.getExercises();
    setExercises(updated);
    setShowModal(false);
    setForm(EMPTY_FORM);
  }

  // ─── Templates ─────────────────────────────────────────────────────────────

  async function handleDeleteTemplate(id: string) {
    await storage.deleteTemplate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  async function handleRenameTemplate(id: string, name: string) {
    const updated = templates.map(t => (t.id === id ? { ...t, name } : t));
    const target = updated.find(t => t.id === id);
    if (target) {
      await storage.saveTemplate(target);
    }
    setTemplates(updated);
  }

  // ─── Import flow ────────────────────────────────────────────────────────────

  async function handleImportFromImage() {
    // Check groq key first
    const profile = await storage.getProfile();
    if (!profile?.groqKey) {
      Alert.alert('Sin clave Groq', 'Configurá tu clave Groq en Perfil primero.');
      return;
    }
    const groqKey = profile.groqKey;

    launchImageLibrary({ mediaType: 'photo', includeBase64: true }, async response => {
      if (response.didCancel || !response.assets?.length) {
        return;
      }
      const asset = response.assets[0];
      if (!asset.base64) {
        Alert.alert('Error', 'No se pudo obtener la imagen en base64.');
        return;
      }

      setImporting(true);
      try {
        const imageBase64 = asset.base64;
        const mimeType = asset.type || 'image/jpeg';
        const plan: ParsedWorkoutPlan = await parseWorkoutPDF({ imageBase64, mimeType, groqKey });

        // Convert to SessionTemplate[]
        const allExercises = await storage.getExercises();
        const newTemplates: SessionTemplate[] = [];

        for (const dia of plan.dias) {
          const templateExercises: SessionTemplate['exercises'] = [];

          for (const bloque of dia.bloques) {
            for (const ej of bloque.ejercicios) {
              // Try to find matching exercise by name (case-insensitive, partial)
              const ejLower = ej.nombre.toLowerCase();
              let found = allExercises.find(
                e =>
                  e.name.toLowerCase() === ejLower ||
                  e.name.toLowerCase().includes(ejLower) ||
                  ejLower.includes(e.name.toLowerCase()),
              );

              if (!found) {
                // Create new exercise
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

              templateExercises.push({
                exerciseId: found.id,
                exerciseName: found.name,
                targetSets: typeof ej.series === 'number' ? ej.series : parseInt(String(ej.series), 10) || 3,
                targetReps: ej.reps ?? '',
              });
            }
          }

          const template: SessionTemplate = {
            id: `tmpl_${Date.now()}_${dia.nombre.replace(/\s+/g, '_')}`,
            name: dia.nombre.replace('Dia', 'Día'),
            exercises: templateExercises,
          };
          await storage.saveTemplate(template);
          newTemplates.push(template);
        }

        const updated = await storage.getTemplates();
        setTemplates(updated);
        setActiveTab('templates');

        const names = newTemplates.map(t => t.name).join(', ');
        Alert.alert('Importación exitosa', `Se importaron ${newTemplates.length} templates: ${names}`);
      } catch (err) {
        Alert.alert('Error al importar', String(err));
      } finally {
        setImporting(false);
      }
    });
  }

  const categories: ExerciseCategory[] = ['fuerza', 'cardio', 'peso_corporal'];

  return (
    <SafeAreaView style={styles.container}>
      {/* Loading overlay */}
      <Modal visible={importing} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Analizando imagen con IA...</Text>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Ejercicios</Text>
        {activeTab === 'ejercicios' && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowModal(true)}
            activeOpacity={0.8}>
            <Text style={styles.addBtnText}>+ Agregar</Text>
          </TouchableOpacity>
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
          style={[styles.segment, activeTab === 'templates' && styles.segmentActive]}
          onPress={() => setActiveTab('templates')}
          activeOpacity={0.8}>
          <Text style={[styles.segmentText, activeTab === 'templates' && styles.segmentTextActive]}>
            Templates
          </Text>
        </TouchableOpacity>
      </View>

      {/* Exercises tab */}
      {activeTab === 'ejercicios' && (
        <FlatList
          data={exercises}
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
      )}

      {/* Templates tab */}
      {activeTab === 'templates' && (
        <FlatList
          data={templates}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TemplateRow
              template={item}
              onDelete={handleDeleteTemplate}
              onRename={handleRenameTemplate}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <TouchableOpacity
              style={styles.importBtn}
              onPress={handleImportFromImage}
              activeOpacity={0.8}>
              <Text style={styles.importBtnText}>Importar desde imagen</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Sin templates.</Text>
              <Text style={styles.emptySubText}>
                Importá tu plan de entrenamiento desde una imagen.
              </Text>
            </View>
          }
        />
      )}

      {/* New exercise modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}>
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
                    style={[
                      styles.categoryChip,
                      form.category === cat && styles.categoryChipActive,
                    ]}
                    onPress={() => setForm(f => ({ ...f, category: cat }))}>
                    <Text
                      style={[
                        styles.categoryChipText,
                        form.category === cat && styles.categoryChipTextActive,
                      ]}>
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
                  onPress={() => {
                    setShowModal(false);
                    setForm(EMPTY_FORM);
                  }}>
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: colors.black,
    fontWeight: '700',
    fontSize: 14,
  },
  // Segmented control
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
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  segmentTextActive: {
    color: colors.black,
    fontWeight: '700',
  },
  // Import button
  importBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  importBtnText: {
    color: colors.black,
    fontWeight: '700',
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 8,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowMain: { flex: 1 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  renameInput: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    paddingVertical: 2,
  },
  deleteBtn: { paddingLeft: 12 },
  deleteBtnText: { color: colors.textSecondary, fontSize: 16 },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: { color: colors.textSecondary, fontSize: 15 },
  emptySubText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  // Loading overlay
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    minWidth: 220,
  },
  loadingText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '85%',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryChipText: { color: colors.textSecondary, fontSize: 13 },
  categoryChipTextActive: { color: colors.black, fontWeight: '700' },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 8,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.text, fontSize: 15 },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: colors.black, fontWeight: '700', fontSize: 15 },
});
