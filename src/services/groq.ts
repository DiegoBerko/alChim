/**
 * Groq vision service for parsing workout PDF screenshots.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const WORKOUT_PROMPT = `Analizá esta imagen de un plan de entrenamiento semanal.

El plan tiene tablas para "Dia 1" y "Dia 2". Cada tabla tiene secciones (Entrada en calor, Bloque Principal, Bloque Accesorio). En cada sección, los EJERCICIOS son las COLUMNAS y las FILAS son: nombre del ejercicio, Series, Reps/T', Detalle, Link (ignorar Link).

Extraé todos los ejercicios de cada día con sus datos.

Respondé ÚNICAMENTE con JSON válido, sin markdown, sin explicación:
{
  "dias": [
    {
      "nombre": "Dia 1",
      "bloques": [
        {
          "nombre": "Entrada en calor",
          "ejercicios": [
            {
              "nombre": "Tobillo-Rodilla-Cadera",
              "series": 2,
              "reps": "10",
              "detalle": ""
            }
          ]
        }
      ]
    }
  ]
}`;

export interface ParsedEjercicio {
  nombre: string;
  series: number;
  reps: string;
  detalle?: string;
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

export async function parseWorkoutPDF(params: {
  imageBase64: string;
  mimeType: string;
  groqKey: string;
}): Promise<ParsedWorkoutPlan> {
  const { imageBase64, mimeType, groqKey } = params;

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
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: WORKOUT_PROMPT,
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '';

  // Strip markdown code fences if present
  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as ParsedWorkoutPlan;
    if (!parsed.dias || !Array.isArray(parsed.dias)) {
      throw new Error('Respuesta inesperada: falta "dias"');
    }
    return parsed;
  } catch (e) {
    throw new Error(`No se pudo parsear el JSON de Groq: ${String(e)}\n\nRespuesta: ${cleaned.slice(0, 200)}`);
  }
}
