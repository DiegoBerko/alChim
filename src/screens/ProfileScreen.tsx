import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { storage } from '../services/storage';
import { syncPlansFromCloud } from '../services/sync';
import type { UserProfile } from '../types';

const DEFAULT_PROFILE: UserProfile = {
  age: 25,
  gender: 'Masculino',
  height: 175,
  weight: 75,
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useFocusEffect(
    useCallback(() => {
      storage.getProfile().then(p => {
        if (p) setProfile(p);
      });
      setSaved(false);
    }, []),
  );

  function field(key: keyof UserProfile) {
    return {
      value: profile[key] !== undefined ? String(profile[key]) : '',
      onChangeText: (t: string) =>
        setProfile(prev => ({
          ...prev,
          [key]: ['name'].includes(key) ? t : parseFloat(t) || (t === '' ? undefined : 0),
        })),
    };
  }

  async function handleSync() {
    const code = profile.linkCode?.trim();
    if (!code) {
      Alert.alert('Código requerido', 'Ingresá tu código de acceso primero.');
      return;
    }
    setSyncing(true);
    setSyncMsg(null);
    // Save profile first so linkCode persists even if sync fails
    await storage.saveProfile(profile);
    const result = await syncPlansFromCloud(code, profile.backendUrl);
    setSyncing(false);
    if (result.error) {
      setSyncMsg({ text: result.error, ok: false });
    } else {
      const name = result.studentName ? ` (${result.studentName})` : '';
      const parts: string[] = [];
      if (result.added > 0) parts.push(`${result.added} nuevo${result.added !== 1 ? 's' : ''}`);
      if (result.updated > 0) parts.push(`${result.updated} actualizado${result.updated !== 1 ? 's' : ''}`);
      if (parts.length === 0) parts.push('Todo al día');
      setSyncMsg({ text: `${parts.join(', ')}${name}`, ok: true });
      setTimeout(() => setSyncMsg(null), 5000);
    }
  }

  async function handleSave() {
    if (!profile.age || !profile.height || !profile.weight) {
      Alert.alert('Error', 'Edad, altura y peso son obligatorios.');
      return;
    }
    await storage.saveProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Perfil</Text>
          <Text style={styles.subtitle}>
            Tu información se usa para estimar calorías quemadas.
          </Text>

          <Text style={styles.label}>Nombre (opcional)</Text>
          <TextInput
            style={styles.input}
            value={profile.name ?? ''}
            onChangeText={t => setProfile(p => ({ ...p, name: t }))}
            placeholder="Tu nombre"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>Edad *</Text>
          <TextInput
            style={styles.input}
            value={String(profile.age)}
            onChangeText={t =>
              setProfile(p => ({ ...p, age: parseInt(t, 10) || 0 }))
            }
            keyboardType="number-pad"
            placeholder="25"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>Género</Text>
          <View style={styles.genderRow}>
            {(['Masculino', 'Femenino'] as const).map(g => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.genderChip,
                  profile.gender === g && styles.genderChipActive,
                ]}
                onPress={() => setProfile(p => ({ ...p, gender: g }))}>
                <Text
                  style={[
                    styles.genderChipText,
                    profile.gender === g && styles.genderChipTextActive,
                  ]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Altura (cm) *</Text>
          <TextInput
            style={styles.input}
            value={String(profile.height)}
            onChangeText={t =>
              setProfile(p => ({ ...p, height: parseFloat(t) || 0 }))
            }
            keyboardType="decimal-pad"
            placeholder="175"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>Peso (kg) *</Text>
          <TextInput
            style={styles.input}
            value={String(profile.weight)}
            onChangeText={t =>
              setProfile(p => ({ ...p, weight: parseFloat(t) || 0 }))
            }
            keyboardType="decimal-pad"
            placeholder="75"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>% Grasa corporal (opcional)</Text>
          <TextInput
            style={styles.input}
            value={profile.bodyFatPct !== undefined ? String(profile.bodyFatPct) : ''}
            onChangeText={t =>
              setProfile(p => ({
                ...p,
                bodyFatPct: t ? parseFloat(t) : undefined,
              }))
            }
            keyboardType="decimal-pad"
            placeholder="Ej: 18"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>Clave Groq (para import PDF)</Text>
          <TextInput
            style={styles.input}
            value={profile.groqKey ?? ''}
            onChangeText={t => setProfile(p => ({ ...p, groqKey: t || undefined }))}
            secureTextEntry={true}
            placeholder="gsk_..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* ── Sync section ── */}
          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Sincronización de planes</Text>
          <Text style={styles.subtitle}>
            Ingresá el código que te dio tu entrenador para descargar tus planes activos.
          </Text>

          <Text style={styles.label}>URL del backoffice</Text>
          <TextInput
            style={styles.input}
            value={profile.backendUrl ?? ''}
            onChangeText={t => setProfile(p => ({ ...p, backendUrl: t.trim() || undefined }))}
            placeholder="https://tu-app.vercel.app"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>Código de acceso</Text>
          <TextInput
            style={[styles.input, styles.inputCode]}
            value={profile.linkCode ?? ''}
            onChangeText={t =>
              setProfile(p => ({ ...p, linkCode: t.toUpperCase() || undefined }))
            }
            placeholder="AB3XYZ"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
          />

          {syncMsg && (
            <View
              style={[
                styles.syncMsg,
                syncMsg.ok ? styles.syncMsgOk : styles.syncMsgErr,
              ]}>
              <Text
                style={[
                  styles.syncMsgText,
                  syncMsg.ok ? styles.syncMsgTextOk : styles.syncMsgTextErr,
                ]}>
                {syncMsg.ok ? '✓ ' : '✕ '}{syncMsg.text}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
            onPress={handleSync}
            disabled={syncing}
            activeOpacity={0.8}>
            {syncing ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={styles.syncBtnText}>Sincronizar planes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, saved && styles.saveBtnSuccess]}
            onPress={handleSave}
            activeOpacity={0.8}>
            <Text style={styles.saveBtnText}>
              {saved ? 'Guardado!' : 'Guardar perfil'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  genderChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  genderChipText: { color: colors.textSecondary, fontSize: 14 },
  genderChipTextActive: { color: colors.black, fontWeight: '700' },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  saveBtnSuccess: {
    backgroundColor: colors.success,
  },
  saveBtnText: {
    color: colors.black,
    fontWeight: '700',
    fontSize: 16,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 28,
    marginBottom: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 4,
  },
  inputCode: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  syncBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  syncBtnDisabled: {
    opacity: 0.5,
  },
  syncBtnText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 15,
  },
  syncMsg: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  syncMsgOk: {
    backgroundColor: colors.success + '20',
    borderWidth: 1,
    borderColor: colors.success + '60',
  },
  syncMsgErr: {
    backgroundColor: '#ef444420',
    borderWidth: 1,
    borderColor: '#ef444460',
  },
  syncMsgText: { fontSize: 13, fontWeight: '600' },
  syncMsgTextOk: { color: colors.success },
  syncMsgTextErr: { color: '#ef4444' },
});
