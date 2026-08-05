import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { storage } from '../services/storage';
import { useUpdate } from '../context/UpdateContext';
import type { WorkoutSession, SessionTemplate, PlannedSession } from '../types';
import type { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Inicio'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function SessionCard({ session }: { session: WorkoutSession }) {
  const date = new Date(session.startTime ?? session.date);
  const dateStr = date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  return (
    <View style={styles.card}>
      <Text style={styles.cardDate}>{dateStr}</Text>
      <Text style={styles.cardTitle}>
        {session.exercises.length} ejercicio{session.exercises.length !== 1 ? 's' : ''}
        {'  ·  '}
        {totalSets} serie{totalSets !== 1 ? 's' : ''}
      </Text>
      {session.estimatedKcal !== undefined && (
        <Text style={styles.cardKcal}>{session.estimatedKcal} kcal estimadas</Text>
      )}
      {session.notes ? <Text style={styles.cardNotes}>{session.notes}</Text> : null}
    </View>
  );
}

function PlannedSessionCard({
  session,
  onStart,
  onEdit,
}: {
  session: PlannedSession;
  onStart: () => void;
  onEdit: () => void;
}) {
  return (
    <View style={styles.plannedCard}>
      <View style={styles.plannedCardInfo}>
        <Text style={styles.plannedCardName}>{session.name || 'Sesión sin nombre'}</Text>
        <Text style={styles.plannedCardMeta}>
          {session.exercises.length} ejercicio{session.exercises.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.plannedCardActions}>
        <TouchableOpacity style={styles.plannedEditBtn} onPress={onEdit} activeOpacity={0.8}>
          <Text style={styles.plannedEditBtnText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.plannedStartBtn} onPress={onStart} activeOpacity={0.8}>
          <Text style={styles.plannedStartBtnText}>Empezar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const { updateInfo, clearUpdate } = useUpdate();

  useFocusEffect(
    useCallback(() => {
      storage.getSessions().then(all => setRecentSessions(all.slice(0, 5)));
      storage.getTemplates().then(setTemplates);
      storage.getPlannedSessions().then(setPlannedSessions);
    }, []),
  );

  function handleUpdate() {
    if (!updateInfo) return;
    Alert.alert(
      'Nueva versión disponible',
      `¿Descargar la actualización?${updateInfo.changelog ? `\n\n${updateInfo.changelog}` : ''}`,
      [
        { text: 'Ahora no', style: 'cancel', onPress: clearUpdate },
        { text: 'Descargar', onPress: () => { Linking.openURL(updateInfo.url); clearUpdate(); } },
      ],
    );
  }

  function handleNewSession() {
    if (templates.length === 0) {
      navigation.navigate('Sesión');
    } else {
      setShowTemplateModal(true);
    }
  }

  async function startWithTemplate(template: SessionTemplate | null) {
    setShowTemplateModal(false);
    await storage.setPendingTemplate(template);
    navigation.navigate('Sesión');
  }

  async function startPlannedSession(session: PlannedSession) {
    const template: SessionTemplate = {
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
    await storage.setPendingTemplate(template);
    navigation.navigate('Sesión');
  }

  function editPlannedSession(session: PlannedSession) {
    navigation.navigate('PlanSession', { session });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>alChim</Text>
          <Text style={styles.subtitle}>Tu diario de entrenamiento</Text>
        </View>

        {updateInfo && (
          <TouchableOpacity style={styles.updateBanner} onPress={handleUpdate} activeOpacity={0.8}>
            <Text style={styles.updateBannerText}>🔄 Nueva versión disponible — tap para actualizar</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.newSessionBtn}
          onPress={handleNewSession}
          activeOpacity={0.8}>
          <Text style={styles.newSessionBtnText}>+ Nueva sesión</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.planSessionBtn}
          onPress={() => navigation.navigate('PlanSession', undefined)}
          activeOpacity={0.8}>
          <Text style={styles.planSessionBtnText}>Planificar sesión</Text>
        </TouchableOpacity>

        {/* Planned sessions section */}
        {plannedSessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sesiones planificadas</Text>
            <View style={styles.plannedList}>
              {plannedSessions.map(s => (
                <PlannedSessionCard
                  key={s.id}
                  session={s}
                  onStart={() => startPlannedSession(s)}
                  onEdit={() => editPlannedSession(s)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Recent sessions section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sesiones recientes</Text>

          {recentSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No hay sesiones todavía.</Text>
              <Text style={styles.emptySubText}>
                ¡Empezá tu primera sesión de entrenamiento!
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {recentSessions.map(item => (
                <SessionCard key={item.id} session={item} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Template picker modal */}
      <Modal
        visible={showTemplateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTemplateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Iniciar sesión</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.templateOption}
                onPress={() => startWithTemplate(null)}
                activeOpacity={0.8}>
                <Text style={styles.templateOptionName}>Sesión vacía</Text>
                <Text style={styles.templateOptionMeta}>Sin plantilla</Text>
              </TouchableOpacity>

              {templates.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.templateOption, styles.templateOptionFilled]}
                  onPress={() => startWithTemplate(t)}
                  activeOpacity={0.8}>
                  <Text style={styles.templateOptionName}>{t.name}</Text>
                  <Text style={styles.templateOptionMeta}>
                    {t.exercises.length} ejercicio{t.exercises.length !== 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowTemplateModal(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
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
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  title: {
    color: colors.accent,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  updateBanner: {
    backgroundColor: '#1a2a1a',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  updateBannerText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
  },
  newSessionBtn: {
    backgroundColor: colors.accent,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  newSessionBtnText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '700',
  },
  planSessionBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 20,
    marginBottom: 24,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  planSessionBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  plannedList: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
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
  plannedCardInfo: {
    flex: 1,
  },
  plannedCardName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  plannedCardMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  plannedCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  plannedEditBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  plannedEditBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  plannedStartBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  plannedStartBtnText: {
    color: colors.black,
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 20,
    gap: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDate: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  cardKcal: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  cardNotes: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '70%',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  templateOption: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  templateOptionFilled: {
    borderColor: colors.accent,
  },
  templateOptionName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  templateOptionMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
});
