import React, { useCallback, useState } from 'react';
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
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { colors } from '../theme';
import { storage } from '../services/storage';
import type { Exercise, PlannedExercise, PlannedSession, SessionTemplate } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';

type PlanSessionNavProp = NativeStackNavigationProp<RootStackParamList, 'PlanSession'>;
type PlanSessionRouteProp = RouteProp<RootStackParamList, 'PlanSession'>;

function plannedSessionToTemplate(session: PlannedSession): SessionTemplate {
  return {
    id: session.id,
    name: session.name || 'Sesión',
    exercises: session.exercises.map(e => ({
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      targetSets: e.targetSets || 3,
      targetReps: e.targetReps || '',
      targetWeight: undefined,
    })),
  };
}

export default function PlanSessionScreen() {
  const navigation = useNavigation<PlanSessionNavProp>();
  const route = useRoute<PlanSessionRouteProp>();
  const existing = route.params?.session;

  const [sessionName, setSessionName] = useState(existing?.name ?? '');
  const [exercises, setExercises] = useState<PlannedExercise[]>(existing?.exercises ?? []);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState('');

  useFocusEffect(
    useCallback(() => {
      storage.getExercises().then(setAllExercises);
    }, []),
  );

  const filteredExercises = allExercises.filter(e =>
    e.name.toLowerCase().includes(pickerFilter.toLowerCase()) ||
    e.muscleGroups.some(g => g.toLowerCase().includes(pickerFilter.toLowerCase())),
  );

  function addExercise(ex: Exercise) {
    const planned: PlannedExercise = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      targetSets: 3,
      targetReps: '',
      notes: '',
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

  function buildSession(): PlannedSession {
    const id = existing?.id ?? `plan_${Date.now()}`;
    return {
      id,
      name: sessionName.trim() || undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      exercises,
    };
  }

  async function handleSave() {
    if (exercises.length === 0) {
      Alert.alert('Sin ejercicios', 'Agregá al menos un ejercicio al plan.');
      return;
    }
    const session = buildSession();
    await storage.savePlannedSession(session);
    navigation.goBack();
  }

  async function handleStartNow() {
    if (exercises.length === 0) {
      Alert.alert('Sin ejercicios', 'Agregá al menos un ejercicio al plan.');
      return;
    }
    const session = buildSession();
    await storage.savePlannedSession(session);
    const template = plannedSessionToTemplate(session);
    await storage.setPendingTemplate(template);
    navigation.navigate('MainTabs');
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{existing ? 'Editar plan' : 'Planificar sesión'}</Text>
          <View style={{ width: 70 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Session name */}
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

          {/* Exercises list */}
          {exercises.length > 0 && (
            <View style={styles.exercisesSection}>
              <Text style={styles.sectionLabel}>EJERCICIOS</Text>
              {exercises.map((ex, idx) => (
                <View key={`${ex.exerciseId}-${idx}`} style={styles.exCard}>
                  <View style={styles.exCardHeader}>
                    <Text style={styles.exName}>{ex.exerciseName}</Text>
                    <TouchableOpacity onPress={() => removeExercise(idx)} hitSlop={10}>
                      <Text style={styles.removeExText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.exFields}>
                    <View style={styles.exFieldGroup}>
                      <Text style={styles.exFieldLabel}>SERIES</Text>
                      <TextInput
                        style={styles.exFieldInput}
                        value={String(ex.targetSets)}
                        onChangeText={t => {
                          const n = parseInt(t);
                          updateExercise(idx, { targetSets: isNaN(n) ? 0 : n });
                        }}
                        keyboardType="number-pad"
                        placeholder="3"
                        placeholderTextColor={colors.textSecondary}
                        returnKeyType="done"
                      />
                    </View>
                    <View style={[styles.exFieldGroup, { flex: 2 }]}>
                      <Text style={styles.exFieldLabel}>REPS / OBJETIVO</Text>
                      <TextInput
                        style={styles.exFieldInput}
                        value={ex.targetReps}
                        onChangeText={t => updateExercise(idx, { targetReps: t })}
                        placeholder='Ej: "12/10/8" o "3x10"'
                        placeholderTextColor={colors.textSecondary}
                        returnKeyType="done"
                      />
                    </View>
                  </View>

                  <TextInput
                    style={styles.exNotesInput}
                    value={ex.notes ?? ''}
                    onChangeText={t => updateExercise(idx, { notes: t })}
                    placeholder="Notas (ej: usar 7kg, elástico fuerte...)"
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="done"
                  />
                </View>
              ))}
            </View>
          )}

          {/* Add exercise button */}
          <TouchableOpacity
            style={styles.addExBtn}
            onPress={() => setShowPicker(true)}
            activeOpacity={0.8}>
            <Text style={styles.addExBtnText}>+ Agregar ejercicio</Text>
          </TouchableOpacity>

          {/* Action buttons */}
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
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => { setShowPicker(false); setPickerFilter(''); }}>
              <Text style={styles.modalCancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
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
  backBtn: {},
  backBtnText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },

  scroll: { padding: 20, gap: 20, paddingBottom: 40 },

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

  exercisesSection: { gap: 10 },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  exCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  exCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exName: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  removeExText: { color: colors.textSecondary, fontSize: 16, paddingLeft: 10 },

  exFields: { flexDirection: 'row', gap: 10 },
  exFieldGroup: { flex: 1 },
  exFieldLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  exFieldInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

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

  addExBtn: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
  },
  addExBtnText: { color: colors.accent, fontSize: 15, fontWeight: '700' },

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

  // Modal
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
});
