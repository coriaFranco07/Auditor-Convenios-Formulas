import https from 'node:https';
import { appConfig } from '../../../config/app-config';
import { AiIssueExplanation, ValidationIssue } from '../types/validation.types';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

const PDF_DOMAIN_CONTEXT = `
El PDF funcional describe un archivo Excel de formulas de liquidacion de sueldos.
Hojas principales:
- Conceptos y Formulas (1): conceptos de liquidacion, condiciones, formulas mensuales/jornales, unidades, pre/post formula.
- Calculo Auxiliares (3): calculos auxiliares reutilizables. En formulas se referencian como A[n].
Tablas de soporte:
- Variables de Legajos (2): variables del empleado o legajo. En formulas se referencian como L[n].
Nota de alcance: esta auditoria no valida la hoja Acumuladores (4); se concentra en las tablas donde se cargan formulas.
Referencias del lenguaje:
- A[n]: resultado de un calculo auxiliar.
- R[n]: importe calculado de un concepto.
- U[n]: unidades calculadas de un concepto.
- N[n] o I[n]: novedad/concepto informado.
- L[n]: variable del legajo.
Regla clave: una formula debe poder resolverse en un orden deterministico. Si una cadena vuelve al mismo calculo, hay dependencia circular y bloquea la importacion.
`;

export class AiIssueExplainerService {
  async explain(issue: ValidationIssue): Promise<AiIssueExplanation> {
    if (!appConfig.gemini.enabled || !appConfig.gemini.apiKey) {
      throw new Error('Gemini no esta configurado.');
    }

    const payload = this.issuePayload(issue);
    const prompt = this.prompt(payload);
    const errors: string[] = [];

    for (const model of appConfig.gemini.models) {
      try {
        const text = await this.generate(model, prompt);
        const parsed = this.parseJson(text);
        return {
          model,
          summary: this.clean(parsed.summary),
          impact: this.clean(parsed.impact),
          reviewSteps: this.cleanList(parsed.reviewSteps),
          suggestedAction: this.clean(parsed.suggestedAction),
          confidenceNote: this.clean(parsed.confidenceNote),
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        errors.push(`${model}: ${error instanceof Error ? error.message : 'error desconocido'}`);
      }
    }

    throw new Error(`Gemini no pudo generar la explicacion. ${errors.join(' | ')}`);
  }

  private async generate(model: string, prompt: string): Promise<string> {
    const url = `${appConfig.gemini.endpoint}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(
      appConfig.gemini.apiKey ?? '',
    )}`;

    const json = await this.postJson<GeminiResponse>(url, {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 700,
        responseMimeType: 'application/json',
      },
    });
      const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('\n').trim();
      if (!text) {
        throw new Error('respuesta vacia');
      }
      return text;
  }

  private postJson<T>(url: string, payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const body = JSON.stringify(payload);
      const request = https.request(
        parsed,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: appConfig.gemini.timeoutMs,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            let json: GeminiResponse;
            try {
              json = raw ? (JSON.parse(raw) as GeminiResponse) : {};
            } catch {
              reject(new Error(`respuesta no JSON: HTTP ${response.statusCode}`));
              return;
            }
            if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
              reject(new Error(json.error?.message ?? `HTTP ${response.statusCode}`));
              return;
            }
            resolve(json as T);
          });
        },
      );

      request.on('timeout', () => {
        request.destroy(new Error('timeout'));
      });
      request.on('error', reject);
      request.write(body);
      request.end();
    });
  }

  private prompt(issueJson: string): string {
    return `
Sos un agente funcional para una contadora que carga un Excel de formulas de liquidacion.
Tu tarea es explicar un hallazgo de auditoria en lenguaje humano, corto y accionable.

Contexto funcional del PDF:
${PDF_DOMAIN_CONTEXT}

Reglas estrictas:
- No inventes hojas, celdas, nombres ni formulas. Usa solo el JSON del hallazgo.
- No digas que algo esta corregido; solo explica que revisar.
- Escribi en espanol rioplatense/neutral, claro para una persona no programadora.
- No menciones codigos internos, severidades internas ni banderas tecnicas del sistema. Explica el problema por su significado funcional.
- Si hay dependencyDetails, usalos para indicar el recorrido y las celdas.
- Si hay replacementSuggestions, explicalos como posibles reemplazos a confirmar, nunca como correccion segura.
- Si la informacion no alcanza, decilo en confidenceNote.
- Devolve SOLO JSON valido con estas claves:
{
  "summary": "1 o 2 frases sobre que pasa",
  "impact": "por que afecta la liquidacion/importacion",
  "reviewSteps": ["paso 1", "paso 2", "paso 3"],
  "suggestedAction": "accion concreta recomendada",
  "confidenceNote": "nota breve sobre trazabilidad o limites"
}

Hallazgo:
${issueJson}
`;
  }

  private issuePayload(issue: ValidationIssue): string {
    const compact = {
      title: issue.title,
      message: issue.message,
      explanation: issue.explanation,
      recommendation: issue.recommendation,
      sheet: issue.sheet,
      row: issue.row,
      column: issue.column,
      cell: issue.cell,
      entityType: issue.entityType,
      entityId: issue.entityId,
      entityName: issue.entityName,
      formula: issue.formula,
      invalidFragment: issue.invalidFragment,
      referenceType: issue.referenceType,
      referenceId: issue.referenceId,
      dependencyPath: issue.dependencyPath,
      dependencyDetails: issue.dependencyDetails,
      replacementSuggestions: issue.replacementSuggestions,
      relatedLocations: issue.relatedLocations,
    };
    return JSON.stringify(compact, null, 2);
  }

  private parseJson(text: string): Record<string, unknown> {
    const normalized = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    const start = normalized.indexOf('{');
    const end = normalized.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('la respuesta no contiene JSON');
    }
    return JSON.parse(normalized.slice(start, end + 1)) as Record<string, unknown>;
  }

  private clean(value: unknown): string {
    return typeof value === 'string' && value.trim() ? value.trim() : 'No disponible.';
  }

  private cleanList(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return ['Revisar el detalle tecnico del hallazgo.'];
    }
    const cleaned = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned.slice(0, 6) : ['Revisar el detalle tecnico del hallazgo.'];
  }
}
