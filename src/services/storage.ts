import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Exercise, WorkoutSession, SessionTemplate, UserProfile, PlannedSession } from '../types';

const KEYS = {
  PROFILE: 'alchim_profile',
  SESSIONS: 'alchim_sessions',
  EXERCISES: 'alchim_exercises',
  TEMPLATES: 'alchim_templates',
  PENDING_TEMPLATE: 'alchim_pending_template',
  PLANNED_SESSIONS: 'alchim_planned_sessions',
};

const DEFAULT_EXERCISES: Exercise[] = [
  {
    id: 'ex_press_banca',
    name: 'Press de banca',
    muscleGroups: ['pecho', 'tríceps', 'hombros'],
    category: 'fuerza',
    met: 5,
  },
  {
    id: 'ex_sentadilla',
    name: 'Sentadilla',
    muscleGroups: ['cuádriceps', 'glúteos', 'isquios'],
    category: 'fuerza',
    met: 6,
  },
  {
    id: 'ex_peso_muerto',
    name: 'Peso muerto',
    muscleGroups: ['espalda', 'glúteos', 'isquios'],
    category: 'fuerza',
    met: 6,
  },
  {
    id: 'ex_dominadas',
    name: 'Dominadas',
    muscleGroups: ['espalda', 'bíceps'],
    category: 'peso_corporal',
    met: 5,
  },
  {
    id: 'ex_press_militar',
    name: 'Press militar',
    muscleGroups: ['hombros', 'tríceps'],
    category: 'fuerza',
    met: 4,
  },
  {
    id: 'ex_remo_barra',
    name: 'Remo con barra',
    muscleGroups: ['espalda', 'bíceps'],
    category: 'fuerza',
    met: 5,
  },
  {
    id: 'ex_curl_biceps',
    name: 'Curl de bíceps',
    muscleGroups: ['bíceps'],
    category: 'fuerza',
    met: 3,
  },
  {
    id: 'ex_ext_triceps',
    name: 'Extensión de tríceps',
    muscleGroups: ['tríceps'],
    category: 'fuerza',
    met: 3,
  },
  {
    id: 'ex_plancha',
    name: 'Plancha',
    muscleGroups: ['core', 'abdomen'],
    category: 'peso_corporal',
    met: 3,
  },
  {
    id: 'ex_burpees',
    name: 'Burpees',
    muscleGroups: ['full_body'],
    category: 'cardio',
    met: 8,
  },
];

export const storage = {
  // ===== PROFILE =====
  async getProfile(): Promise<UserProfile | null> {
    try {
      const json = await AsyncStorage.getItem(KEYS.PROFILE);
      return json ? JSON.parse(json) : null;
    } catch (error) {
      console.error('Error getting profile:', error);
      return null;
    }
  },

  async saveProfile(profile: UserProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  },

  // ===== SESSIONS =====
  async getSessions(): Promise<WorkoutSession[]> {
    try {
      const json = await AsyncStorage.getItem(KEYS.SESSIONS);
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error('Error getting sessions:', error);
      return [];
    }
  },

  async saveSession(session: WorkoutSession): Promise<void> {
    try {
      const sessions = await this.getSessions();
      const idx = sessions.findIndex(s => s.id === session.id);
      if (idx >= 0) {
        sessions[idx] = session;
      } else {
        sessions.push(session);
      }
      sessions.sort((a, b) => (b.startTime ?? b.date).localeCompare(a.startTime ?? a.date));
      await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  },

  async deleteSession(id: string): Promise<void> {
    try {
      const sessions = await this.getSessions();
      await AsyncStorage.setItem(
        KEYS.SESSIONS,
        JSON.stringify(sessions.filter(s => s.id !== id)),
      );
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  },

  // ===== EXERCISES =====
  async getExercises(): Promise<Exercise[]> {
    try {
      const json = await AsyncStorage.getItem(KEYS.EXERCISES);
      if (!json) {
        // Seed defaults on first load
        await AsyncStorage.setItem(KEYS.EXERCISES, JSON.stringify(DEFAULT_EXERCISES));
        return DEFAULT_EXERCISES;
      }
      return JSON.parse(json);
    } catch (error) {
      console.error('Error getting exercises:', error);
      return DEFAULT_EXERCISES;
    }
  },

  async saveExercise(exercise: Exercise): Promise<void> {
    try {
      const exercises = await this.getExercises();
      const idx = exercises.findIndex(e => e.id === exercise.id);
      if (idx >= 0) {
        exercises[idx] = exercise;
      } else {
        exercises.push(exercise);
      }
      exercises.sort((a, b) => a.name.localeCompare(b.name));
      await AsyncStorage.setItem(KEYS.EXERCISES, JSON.stringify(exercises));
    } catch (error) {
      console.error('Error saving exercise:', error);
    }
  },

  async deleteExercise(id: string): Promise<void> {
    try {
      const exercises = await this.getExercises();
      await AsyncStorage.setItem(
        KEYS.EXERCISES,
        JSON.stringify(exercises.filter(e => e.id !== id)),
      );
    } catch (error) {
      console.error('Error deleting exercise:', error);
    }
  },

  // ===== TEMPLATES =====
  async getTemplates(): Promise<SessionTemplate[]> {
    try {
      const json = await AsyncStorage.getItem(KEYS.TEMPLATES);
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error('Error getting templates:', error);
      return [];
    }
  },

  async saveTemplate(template: SessionTemplate): Promise<void> {
    try {
      const templates = await this.getTemplates();
      const idx = templates.findIndex(t => t.id === template.id);
      if (idx >= 0) {
        templates[idx] = template;
      } else {
        templates.push(template);
      }
      await AsyncStorage.setItem(KEYS.TEMPLATES, JSON.stringify(templates));
    } catch (error) {
      console.error('Error saving template:', error);
    }
  },

  async deleteTemplate(id: string): Promise<void> {
    try {
      const templates = await this.getTemplates();
      await AsyncStorage.setItem(
        KEYS.TEMPLATES,
        JSON.stringify(templates.filter(t => t.id !== id)),
      );
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  },

  // ===== PENDING TEMPLATE =====
  async setPendingTemplate(template: SessionTemplate | null): Promise<void> {
    try {
      if (template === null) {
        await AsyncStorage.removeItem(KEYS.PENDING_TEMPLATE);
      } else {
        await AsyncStorage.setItem(KEYS.PENDING_TEMPLATE, JSON.stringify(template));
      }
    } catch (error) {
      console.error('Error setting pending template:', error);
    }
  },

  async getPendingTemplate(): Promise<SessionTemplate | null> {
    try {
      const json = await AsyncStorage.getItem(KEYS.PENDING_TEMPLATE);
      return json ? JSON.parse(json) : null;
    } catch (error) {
      console.error('Error getting pending template:', error);
      return null;
    }
  },

  // ===== PLANNED SESSIONS =====
  async getPlannedSessions(): Promise<PlannedSession[]> {
    try {
      const json = await AsyncStorage.getItem(KEYS.PLANNED_SESSIONS);
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error('Error getting planned sessions:', error);
      return [];
    }
  },

  async savePlannedSession(session: PlannedSession): Promise<void> {
    try {
      const sessions = await this.getPlannedSessions();
      const idx = sessions.findIndex(s => s.id === session.id);
      if (idx >= 0) {
        sessions[idx] = session;
      } else {
        sessions.push(session);
      }
      await AsyncStorage.setItem(KEYS.PLANNED_SESSIONS, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving planned session:', error);
    }
  },

  async deletePlannedSession(id: string): Promise<void> {
    try {
      const sessions = await this.getPlannedSessions();
      await AsyncStorage.setItem(
        KEYS.PLANNED_SESSIONS,
        JSON.stringify(sessions.filter(s => s.id !== id)),
      );
    } catch (error) {
      console.error('Error deleting planned session:', error);
    }
  },
};
