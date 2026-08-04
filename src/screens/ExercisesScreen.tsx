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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { storage } from '../services/storage';
import type { Exercise, ExerciseCategory } from '../types';

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  fuerza: 'Fuerza',
  cardio: 'Cardio',
  peso_corporal: 'Peso corporal',
};

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

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewExerciseForm>(EMPTY_FORM);

  useFocusEffect(
    useCallback(() => {
      storage.getExercises().then(setExercises);
    }, []),
  );

  async function handleDelete(id: string) {
    await storage.deleteExercise(id);
    setExercises(prev => prev.filter(e => e.id !== id));
  }

  async function handleSave() {
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

  const categories: ExerciseCategory[] = ['fuerza', 'cardio', 'peso_corporal'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ejercicios</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowModal(true)}
          activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={exercises}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ExerciseRow exercise={item} onDelete={handleDelete} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Sin ejercicios.</Text>
          </View>
        }
      />

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
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
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
    paddingBottom: 16,
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
  deleteBtn: { paddingLeft: 12 },
  deleteBtnText: { color: colors.textSecondary, fontSize: 16 },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: { color: colors.textSecondary, fontSize: 15 },
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
