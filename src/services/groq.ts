/**
 * Groq vision service for parsing workout PDF screenshots.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'qwen/qwen3.6-27b';

const WORKOUT_PROMPT = `Analizá estas imágenes de un plan de entrenamiento.

ESTRUCTURA DEL DOCUMENTO:
El PDF tiene N días (Dia 1, Dia 2, etc.). Cada día contiene exactamente 3 bloques apilados: "Entrada en calor", "Bloque Principal", "Bloque Accesorio". Los días son el nivel superior; los bloques van dentro de cada día.

FILAS DE CADA TABLA (en orden):
  Fila 0: título del bloque — NO es un ejercicio.
  Fila 1: NOMBRES DE LOS EJERCICIOS, uno por columna. Esta fila define los ejercicios.
  Fila 2: "Series" — número de series de cada ejercicio.
  Fila 3: "Reps/T'" — repeticiones o tiempo.
  Fila 4: "Detalle" — instrucciones (puede incluir peso en kg).
  Fila 5: "Link" — repite los nombres como hipervínculos. IGNORAR. No es una fila de datos.

⚠️ La fila "Link" NO define ejercicios. Los ejercicios SOLO se extraen de la Fila 1.

EXTRACCIÓN por tabla: identificá cuántas columnas tiene la Fila 1. Por cada columna → un ejercicio: nombre = texto de Fila 1, series = Fila 2, reps = Fila 3, detalle = Fila 4. Ignorá la fila "Link".

REGLAS:
- Cada tabla es independiente. Los ejercicios de un bloque no se repiten en otro.
- Si Detalle tiene un número con "kg" o "k", guardalo en "peso".
- "Reps/T'" con "/" es progresión: "10/8/8" = serie 1: 10, serie 2: 8, serie 3: 8.
- Si "Reps/T'" contiene '' → son SEGUNDOS. Mantener '' en "reps".
- Texto como "c/lado", "de cada lado", "x lado", "c/u", "cada lado", "por lado" → moverlo a "notas", quitarlo de "reps". Ej: "20'' c/lado" → reps: "20''", notas: "c/lado".
- Si no podés leer una tabla con certeza, dejá sus ejercicios en [].

Respondé ÚNICAMENTE con JSON válido, sin markdown, sin texto adicional:
{
  "dias": [
    {
      "nombre": "Dia 1",
      "bloques": [
        {
          "nombre": "Entrada en calor",
          "ejercicios": [
            { "nombre": "Plancha frontal", "series": 2, "reps": "30''", "peso": null, "detalle": "", "notas": null },
            { "nombre": "Plancha lateral", "series": 2, "reps": "20''", "peso": null, "detalle": "", "notas": "c/lado" }
          ]
        },
        {
          "nombre": "Bloque Principal",
          "ejercicios": [
            { "nombre": "Sillon cuadriceps", "series": 3, "reps": "12/10/10", "peso": null, "detalle": "", "notas": null }
          ]
        },
        {
          "nombre": "Bloque Accesorio",
          "ejercicios": [
            { "nombre": "Puente gluteo a 1 pierna elevado", "series": 3, "reps": "15/15/15", "peso": 7, "detalle": "colocar 7k en cadera", "notas": "c/u" }
          ]
        }
      ]
    },
    {
      "nombre": "Dia 2",
      "bloques": [
        { "nombre": "Entrada en calor", "ejercicios": [] },
        { "nombre": "Bloque Principal", "ejercicios": [] },
        { "nombre": "Bloque Accesorio", "ejercicios": [] }
      ]
    }
  ]
}`;

export interface ParsedEjercicio {
  nombre: string;
  series: number;
  reps: string;
  peso?: number | null;
  detalle?: string;
  notas?: string;
}

export interface ParsedBloque {
  nombre: string;
  ejercicios: ParsedEjercicio[];
}

export interface ParsedDia {
  nombre: string;
  bloques: ParsedBloque[];
}

export interface ParsedWorkoutPlan {
  dias: ParsedDia[];
}

function extractJson(raw: string): string {
  let s = raw;

  // Strip <think>...</think> — handle both closed and unclosed tags
  if (s.includes('<think>')) {
    const closeIdx = s.indexOf('</think>');
    if (closeIdx !== -1) {
      s = s.slice(closeIdx + '</think>'.length);
    } else {
      // No closing tag — jump to the first JSON brace
      const braceIdx = s.indexOf('{');
      if (braceIdx !== -1) s = s.slice(braceIdx);
    }
  }

  // Strip markdown code fences
  s = s.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  // Extract from first { to last } as a safety net
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end > start) {
    s = s.slice(start, end + 1);
  }

  return s;
}

export async function parseWorkoutPDF(params: {
  pagesBase64: string[];
  groqKey: string;
}): Promise<ParsedWorkoutPlan> {
  const { pagesBase64, groqKey } = params;

  const imageContent = pagesBase64.slice(0, 5).map(b64 => ({
    type: 'image_url',
    image_url: { url: `data:image/jpeg;base64,${b64}` },
  }));

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            { type: 'text', text: WORKOUT_PROMPT },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
      reasoning_effort: 'none',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  const cleaned = extractJson(content);

  try {
    const parsed = JSON.parse(cleaned) as ParsedWorkoutPlan;
    if (!parsed.dias || !Array.isArray(parsed.dias)) {
      throw new Error('Respuesta inesperada: falta "dias"');
    }
    // Normalize: ensure bloques and ejercicios are always arrays
    parsed.dias = parsed.dias.map(dia => ({
      ...dia,
      bloques: (dia.bloques ?? []).map(bloque => ({
        ...bloque,
        ejercicios: bloque.ejercicios ?? [],
      })),
    }));
    return parsed;
  } catch (e) {
    throw new Error(`No se pudo parsear el JSON de Groq: ${String(e)}\n\nRespuesta: ${cleaned.slice(0, 200)}`);
  }
}
