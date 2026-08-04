# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**alChim** — Android gym tracker app. React Native (TypeScript). Logs workout sessions with exercises, sets, reps, weight, effort level, and optional feedback per set or exercise. Estimates calories burned based on user profile (age, gender, height, weight, body fat %). Stores all data locally with AsyncStorage.

## Build & publish

```bash
# Dev
npm start                      # Metro bundler
npm run android                # Build + install debug APK on connected device

# Release APK only
npx react-native bundle --platform android --dev false --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk

# Full publish (bundle + build + upload to Drive + update version JSON)
./scripts/build-and-publish.sh "descripción de cambios"
```

## Update system

- Version JSON: `https://raw.githubusercontent.com/DiegoBerko/nutria-privacy/main/alchim-version.json`
- APK hosted in Google Drive folder: `alChim_APK/app-release.apk`
- `src/services/updater.ts` checks on app start and shows a download prompt if newer version exists

## Architecture

```
src/
├── config/version.ts           ← APP_VERSION (overwritten by build-and-publish.sh)
├── types/index.ts              ← All interfaces: Exercise, ExerciseSet, SessionExercise,
│                                  WorkoutSession, SessionTemplate, UserProfile, EffortLevel
├── services/
│   ├── storage.ts              ← AsyncStorage wrapper. Keys prefixed 'alchim_'.
│   │                              Seeds 10 default exercises on first load.
│   ├── calories.ts             ← MET-based kcal estimation:
│   │                              Kcal = MET × weightKg × durationH × effortMult × compositionFactor
│   │                              estimateKcal() for saved sessions
│   │                              estimateKcalForExercise() for live calculation during session
│   └── updater.ts              ← Checks nutria-privacy repo for newer version
├── context/UpdateContext.tsx   ← Wraps app; exposes updateInfo / clearUpdate
├── theme/index.ts              ← Dark gym aesthetic: bg #0D0D0D, accent #F5A623 (amber)
├── navigation/AppNavigator.tsx ← Bottom tabs: Inicio | Sesión | Historial | Ejercicios | Perfil
└── screens/
    ├── HomeScreen.tsx          ← Last 5 sessions + "Nueva sesión" button
    ├── ActiveSessionScreen.tsx ← Core screen: timer, add exercises, log sets with
    │                              reps/weight/effort chips/feedback, finish + save
    ├── HistoryScreen.tsx       ← All sessions sorted by date, delete
    ├── ExercisesScreen.tsx     ← Exercise library: list, add, delete
    └── ProfileScreen.tsx       ← User profile for kcal calculation
```

## Data model

- `Exercise`: id, name, muscleGroups[], category (fuerza/cardio/peso_corporal), met
- `ExerciseSet`: setNumber, reps, weight?, effort?, feedback?
- `SessionExercise`: exerciseId, exerciseName, sets[], feedback?, effort?
- `WorkoutSession`: id, date (YYYY-MM-DD), startTime (ISO), endTime?, exercises[], estimatedKcal?, notes?
- `EffortLevel`: 'fácil' | 'normal' | 'intenso' | 'muy_intenso'
- Effort multipliers: 0.8 / 1.0 / 1.2 / 1.4

## Key behaviors

- Default exercises are seeded once into AsyncStorage on first launch
- `estimateKcalForExercise` uses `completedSets × 3 min` as duration estimate
- Body composition factor: `1 + (100 - bodyFatPct) / 1000` (more lean mass = higher burn)
- ActiveSessionScreen keeps state in memory (no draft persistence yet)
- Sessions are sorted by startTime descending in storage
