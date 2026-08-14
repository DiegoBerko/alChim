// Always dynamically imported — never included in SSR bundle
import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import type { Plan, PlanSet, SetMode } from './types';

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', color: '#111', fontSize: 10 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#777', marginBottom: 28 },
  daySection: { marginTop: 18 },
  dayTitle: {
    fontSize: 13, fontWeight: 'bold',
    borderBottomWidth: 1.5, borderBottomColor: '#111',
    paddingBottom: 4, marginBottom: 12,
  },
  blockTitle: {
    fontSize: 7.5, fontWeight: 'bold', textTransform: 'uppercase',
    letterSpacing: 0.8, color: '#777', marginBottom: 6, marginTop: 10,
  },
  exercise: {
    backgroundColor: '#f6f6f6', borderRadius: 4,
    padding: '6 8', marginBottom: 4,
  },
  exerciseName: { fontSize: 10, fontWeight: 'bold' },
  exerciseSets: { fontSize: 9, color: '#444', marginTop: 2 },
  exerciseNotes: { fontSize: 8, color: '#999', fontStyle: 'italic', marginTop: 2 },
});

function formatSets(sets: PlanSet[], mode: SetMode): string {
  return sets
    .map((s) => {
      const r = mode === 'seconds' ? `${s.targetReps}''` : `${s.targetReps} reps`;
      return s.targetWeight ? `${r} × ${s.targetWeight}kg` : r;
    })
    .join(' / ');
}

function PlanDocument({ plan }: { plan: Plan }) {
  const allDays =
    plan.days && plan.days.length > 0
      ? plan.days
      : [{ id: '__single__', name: 'Día 1', blocks: plan.blocks ?? [] }];

  return (
    <Document title={plan.name}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{plan.name}</Text>
        <Text style={styles.subtitle}>
          Creado el {new Date(plan.createdAt).toLocaleDateString('es-AR')}
        </Text>

        {allDays.map((day) => (
          <View key={day.id} style={styles.daySection}>
            <Text style={styles.dayTitle}>{day.name}</Text>
            {[...day.blocks]
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((block) => (
                <View key={block.id}>
                  <Text style={styles.blockTitle}>{block.name}</Text>
                  {block.exercises.map((ex) => (
                    <View key={ex.id} style={styles.exercise}>
                      <Text style={styles.exerciseName}>{ex.exerciseName}</Text>
                      {ex.sets.length > 0 && (
                        <Text style={styles.exerciseSets}>
                          {formatSets(ex.sets, ex.mode)}
                        </Text>
                      )}
                      {ex.notes && (
                        <Text style={styles.exerciseNotes}>{ex.notes}</Text>
                      )}
                    </View>
                  ))}
                </View>
              ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}

async function getPDFBlob(plan: Plan): Promise<Blob> {
  return pdf(<PlanDocument plan={plan} />).toBlob();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadPlanPDF(plan: Plan): Promise<void> {
  const blob = await getPDFBlob(plan);
  triggerDownload(blob, `${plan.name}.pdf`);
}

export async function sharePlanPDF(plan: Plan): Promise<void> {
  const blob = await getPDFBlob(plan);
  const filename = `${plan.name}.pdf`;
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: plan.name });
  } else {
    triggerDownload(blob, filename);
  }
}
