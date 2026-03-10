"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Chart,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  LineController,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  Title,
} from "chart.js";

Chart.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  Title
);

type Assessment = {
  id: string;
  title: string | null;
  applied_at: string | null;
  context_unit: string | null;
  company_id: string | null;
  companies?: { name: string }[] | null;
};

type Dimension = { id: number; name: string };
type Question = { id: number; dimension_id: number; text: string; concept: string };
type ResponseRow = { question_id: number; value: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

/**
 * Pesos do artigo (1..5) por dimensão.
 */
function getWeightForDimension(dimName: string, indexFallback1to5: number) {
  const key = dimName.trim().toLowerCase();
  if (key.includes("ferrament")) return 1;
  if (key.includes("cadeia") || key.includes("valor")) return 2;
  if (key.includes("funcion") || key.includes("perspect")) return 3;
  if (key.includes("digital")) return 4;
  if (key.includes("4.0") || key.includes("lean 4")) return 5;
  return clamp(indexFallback1to5, 1, 5);
}

/**
 * Faixas do artigo (0–375)
 */
function classifyByPoints(totalPoints: number) {
  const p = Math.round(totalPoints);

  if (p >= 281) {
    return {
      label: "Empresas Destaques",
      range: "281 – 375 pontos",
      note:
        "Nível elevado de maturidade Lean no instrumento aplicado. A soma ponderada das respostas atinge pelo menos 75% da pontuação total prevista no método Lean.",
    };
  }
  if (p >= 187) {
    return {
      label: "Empresas Acima da Média",
      range: "187 – 280 pontos",
      note:
        "Nível intermediário-alto no instrumento aplicado. A soma ponderada das respostas fica entre 50% e 75% da pontuação total prevista no método Lean.",
    };
  }
  if (p >= 93) {
    return {
      label: "Empresas Médias",
      range: "93 – 186 pontos",
      note:
        "Nível intermediário no instrumento aplicado. A soma ponderada das respostas fica entre 25% e 50% da pontuação total prevista no método Lean.",
    };
  }
  return {
    label: "Empresas em risco",
    range: "0 – 92 pontos",
    note:
      "Nível baixo no instrumento aplicado. A soma ponderada das respostas é inferior a 25% da pontuação total prevista no método Lean.",
  };
}

function noteBadgeClass(value: number) {
  if (value <= 2) {
    return "bg-red-100 text-red-700 ring-red-200";
  }
  if (value === 3) {
    return "bg-amber-100 text-amber-700 ring-amber-200";
  }
  return "bg-emerald-100 text-emerald-700 ring-emerald-200";
}

function buildCriticalSectionText(notes: number[]) {
  if (notes.length === 0) {
    return {
      title: "Como analisar esta seção",
      paragraphs: [
        "Não há itens suficientes para análise nesta seção. Verifique se a avaliação foi preenchida e salva corretamente.",
      ],
    };
  }

  const lowCount = notes.filter((n) => n <= 2).length;
  const midCount = notes.filter((n) => n === 3).length;
  const highCount = notes.filter((n) => n >= 4).length;
  const minNote = Math.min(...notes);
  const maxNote = Math.max(...notes);

  if (lowCount === notes.length) {
    return {
      title: "Como analisar esta seção",
      paragraphs: [
        "Os itens listados nesta seção representam fragilidades claras no diagnóstico, pois todos receberam notas baixas. Em termos práticos, são pontos onde a empresa demonstra pouca aplicação, pouca consistência ou ausência das práticas avaliadas.",
        "A leitura recomendada é priorizar primeiro os itens com nota 1 e 2, pois eles indicam maior necessidade de estruturação, correção e acompanhamento. Esses pontos tendem a puxar o resultado geral para baixo e merecem ação imediata.",
      ],
    };
  }

  if (lowCount > 0 && midCount > 0 && highCount === 0) {
    return {
      title: "Como analisar esta seção",
      paragraphs: [
        "Os itens desta seção mostram um cenário de fragilidade e transição. Há pontos ainda muito fracos, mas também itens em nível intermediário, indicando que parte das práticas já começou a ser desenvolvida, embora ainda não esteja consolidada.",
        "A recomendação é tratar primeiro os itens com nota mais baixa e, em seguida, fortalecer os itens com nota 3 para que evoluam para um nível mais consistente de aplicação.",
      ],
    };
  }

  if (minNote === 3 && maxNote === 3) {
    return {
      title: "Como analisar esta seção",
      paragraphs: [
        "Os itens listados nesta seção estão em nível intermediário. Isso significa que as práticas avaliadas existem de forma parcial, mas ainda não estão maduras, padronizadas ou consolidadas na rotina da empresa.",
        "A interpretação correta é enxergar esta seção como um conjunto de oportunidades de evolução. Não se trata de falhas críticas, mas de aspectos que ainda precisam ser fortalecidos para melhorar a maturidade geral.",
      ],
    };
  }

  if (lowCount === 0 && midCount > 0 && highCount > 0) {
    return {
      title: "Como analisar esta seção",
      paragraphs: [
        "Os itens apresentados nesta seção indicam um cenário relativamente positivo, com parte das práticas em bom nível e parte delas ainda em estágio intermediário. Isso mostra que a empresa já possui bases importantes, mas ainda há espaço para aperfeiçoamento.",
        "Neste caso, a seção deve ser lida como apoio à melhoria contínua: os itens com nota 3 merecem atenção para evoluir, enquanto os itens com nota 4 ou 5 mostram práticas já mais presentes e consistentes.",
      ],
    };
  }

  if (highCount === notes.length) {
    return {
      title: "Como analisar esta seção",
      paragraphs: [
        "Mesmo entre os itens priorizados, as notas encontradas são altas. Isso indica que a empresa já apresenta bom desempenho também nesses pontos, com práticas em nível satisfatório ou forte dentro do questionário aplicado.",
        "Aqui, a leitura não é de fragilidade crítica, mas de refinamento. O foco deve ser manter o que já funciona bem, padronizar o que ainda varia e buscar aperfeiçoamento contínuo nos itens que ainda não atingiram o nível máximo.",
      ],
    };
  }

  return {
    title: "Como analisar esta seção",
    paragraphs: [
      "Os itens listados nesta seção apresentam notas variadas, mostrando um cenário misto entre pontos mais fracos, pontos intermediários e aspectos já mais desenvolvidos. Isso indica que a empresa possui diferenças de maturidade entre práticas avaliadas.",
      "A melhor forma de leitura é priorizar primeiro as menores notas, depois fortalecer os itens intermediários e, por fim, manter os itens mais altos como referência de boas práticas já existentes.",
    ],
  };
}

export default function AssessmentReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assessmentId = params?.id;

  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);

  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const radarChartRef = useRef<Chart | null>(null);

  const weightedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const weightedChartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!assessmentId) return;

    async function load() {
      setLoading(true);

      const [aRes, dRes, qRes, rRes] = await Promise.all([
        supabase
          .from("assessments")
          .select("id,title,applied_at,context_unit,company_id,companies(name)")
          .eq("id", assessmentId)
          .maybeSingle(),
        supabase.from("dimensions").select("id,name").order("id"),
        supabase.from("questions").select("id,dimension_id,text,concept").order("id"),
        supabase.from("responses").select("question_id,value").eq("assessment_id", assessmentId),
      ]);

      if (aRes.error) alert(aRes.error.message);
      if (dRes.error) alert(dRes.error.message);
      if (qRes.error) alert(qRes.error.message);
      if (rRes.error) alert(rRes.error.message);

      setAssessment((aRes.data as Assessment) ?? null);
      setDimensions((dRes.data ?? []) as Dimension[]);
      setQuestions((qRes.data ?? []) as Question[]);
      setResponses((rRes.data ?? []) as ResponseRow[]);

      setLoading(false);
    }

    load();
  }, [assessmentId]);

  const totalQuestions = questions.length;

  const byQuestion = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of responses) m.set(r.question_id, r.value);
    return m;
  }, [responses]);

  const answeredCount = useMemo(() => {
    let c = 0;
    for (const q of questions) if (typeof byQuestion.get(q.id) === "number") c++;
    return c;
  }, [questions, byQuestion]);

  const overall = useMemo(() => {
    const vals: number[] = [];
    for (const q of questions) {
      const v = byQuestion.get(q.id);
      if (typeof v === "number") vals.push(v);
    }
    const sum = vals.length ? vals.reduce((a, b) => a + b, 0) : 0;
    const avg = vals.length ? sum / vals.length : 0;
    const percent = (avg / 5) * 100;
    return { avg: Number(avg.toFixed(2)), percent: Number(percent.toFixed(0)) };
  }, [questions, byQuestion]);

  const dimensionStats = useMemo(() => {
    return dimensions.map((dim) => {
      const qids = questions.filter((q) => q.dimension_id === dim.id).map((q) => q.id);

      const vals = qids
        .map((qid) => byQuestion.get(qid))
        .filter((v): v is number => typeof v === "number");

      const sum = vals.length ? vals.reduce((a, b) => a + b, 0) : 0;
      const avg = vals.length ? sum / vals.length : 0;
      const percent = (avg / 5) * 100;

      return {
        id: dim.id,
        name: dim.name,
        answered: vals.length,
        total: qids.length,
        sum: Number(sum.toFixed(0)),
        avg: Number(avg.toFixed(2)),
        percent: Number(percent.toFixed(2)),
      };
    });
  }, [dimensions, questions, byQuestion]);

  const weighted = useMemo(() => {
    const rows = dimensionStats.map((d, idx) => {
      const weight = getWeightForDimension(d.name, idx + 1);
      const maxPoints = d.total * 5 * weight;
      const points = d.sum * weight;
      const gap = Math.max(0, maxPoints - points);
      return {
        ...d,
        weight,
        maxPoints,
        points: Number(points.toFixed(0)),
        gap: Number(gap.toFixed(0)),
      };
    });

    const totalPoints = rows.reduce((sum, r) => sum + r.points, 0);
    const maxTotal = rows.reduce((sum, r) => sum + r.maxPoints, 0) || 375;

    return {
      rows,
      totalPoints: Number(totalPoints.toFixed(0)),
      maxTotal: Number(maxTotal.toFixed(0)),
      classification: classifyByPoints(totalPoints),
    };
  }, [dimensionStats]);

  /**
   * Prioridades (baseado SOMENTE nos itens do questionário):
   * scoreImpact = (5 - nota) * peso
   * - usado apenas para ordenar a lista
   */
  const criticalItems = useMemo(() => {
    const dimById = new Map<number, Dimension>();
    for (const d of dimensions) dimById.set(d.id, d);

    const weightByDimId = new Map<number, number>();
    weighted.rows.forEach((r) => {
      weightByDimId.set(r.id, r.weight);
    });

    const items = questions
      .map((q) => {
        const value = byQuestion.get(q.id);
        const dim = dimById.get(q.dimension_id);
        const weight = weightByDimId.get(q.dimension_id) ?? 1;

        if (typeof value !== "number") return null;

        const impact = (5 - value) * weight;
        return {
          question_id: q.id,
          value,
          impact: Number(impact.toFixed(2)),
          dimension: dim?.name ?? `Dimensão ${q.dimension_id}`,
          text: q.text,
          concept: q.concept,
          weight,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => b.impact - a.impact);

    return items.slice(0, 12);
  }, [questions, byQuestion, dimensions, weighted.rows]);

  const criticalSectionText = useMemo(() => {
    return buildCriticalSectionText(criticalItems.map((item) => item.value));
  }, [criticalItems]);

  // Radar
  useEffect(() => {
    if (!radarCanvasRef.current) return;
    if (!dimensions.length) return;

    const labels = dimensionStats.map((d) => d.name);
    const data = dimensionStats.map((d) => d.avg);

    radarChartRef.current?.destroy();
    radarChartRef.current = new Chart(radarCanvasRef.current, {
      type: "radar",
      data: {
        labels,
        datasets: [
          { label: "Média (0–5)", data, borderWidth: 2, pointRadius: 3, fill: true },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { r: { suggestedMin: 0, suggestedMax: 5, ticks: { stepSize: 1 } } },
        plugins: { legend: { display: false } },
      },
    });

    return () => {
      radarChartRef.current?.destroy();
      radarChartRef.current = null;
    };
  }, [dimensions.length, dimensionStats]);

  // Bar + Line (modelo do artigo)
  useEffect(() => {
    if (!weightedCanvasRef.current) return;
    if (!weighted.rows.length) return;

    const labels = weighted.rows.map((r) => r.name);
    const barData = weighted.rows.map((r) => r.points);
    const lineData = weighted.rows.map((r) => r.weight);

    weightedChartRef.current?.destroy();
    weightedChartRef.current = new Chart(weightedCanvasRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Pontuação final (Soma × Peso)",
            data: barData,
            borderWidth: 1,
            yAxisID: "yPoints",
          },
          {
            type: "line",
            label: "Pesos",
            data: lineData,
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.25,
            yAxisID: "yWeights",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: {
          yPoints: {
            position: "left",
            beginAtZero: true,
            title: { display: true, text: "Pontuação final" },
          },
          yWeights: {
            position: "right",
            beginAtZero: true,
            suggestedMax: 5,
            ticks: { stepSize: 1 },
            grid: { drawOnChartArea: false },
            title: { display: true, text: "Pesos" },
          },
        },
      },
    });

    return () => {
      weightedChartRef.current?.destroy();
      weightedChartRef.current = null;
    };
  }, [weighted]);

  async function handleGeneratePdf() {
    try {
      setGeneratingPdf(true);
      const oldTitle = document.title;
      document.title = `Relatório - Escala Lean - ${assessmentId}`;
      window.print();
      document.title = oldTitle;
    } finally {
      setGeneratingPdf(false);
    }
  }

  if (loading) return <div className="p-6">Carregando relatório...</div>;

  const companyName = assessment?.companies?.[0]?.name ?? "—";
  const title = assessment?.title ?? `Avaliação ${assessmentId?.slice(0, 8)}…`;

  return (
    <main className="min-h-screen bg-slate-50 print:bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6 print:px-0 print:py-0">
        {/* Header */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 print:rounded-none print:bg-white print:p-0 print:shadow-none print:ring-0">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
                Relatório Técnico — Escala Lean de Maturidade
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
                Documento informativo para instrução, orientação e suporte à tomada de decisão.
              </p>

              <div className="mt-5 grid gap-2 text-sm text-slate-700">
                <div>
                  <b>Empresa:</b> {companyName}
                </div>
                <div>
                  <b>Avaliação:</b> {title}
                </div>
                <div>
                  <b>Data:</b> {formatDate(assessment?.applied_at)}
                </div>
                <div>
                  <b>Unidade/Contexto:</b> {assessment?.context_unit ?? "—"}
                </div>
                <div>
                  <b>Respondidas:</b> {answeredCount} / {totalQuestions}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 text-sm text-slate-700 lg:items-end lg:text-right">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 print:bg-white print:p-0 print:ring-0">
                <div className="text-sm font-semibold text-slate-900">
                  Desenvolvido por: DECLEONES ANDRADE - PIETRA MACAGNAN - ISABELE LIMA
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Projeto Integrador — UniSenai MT (Rondonópolis)
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 ring-1 ring-slate-200 print:bg-white print:p-0 print:ring-0">
                <span className="font-semibold text-slate-900">Observação:</span> Projeto desenvolvido dentro da disciplina de Planejamento do Processo Produtivo, utilizando como base o artigo de ALMEIDA, A. T. de S. B.; GENNARO, D. R.; IBUSUKI, Ugo. Estudo do Nível de Maturidade Lean 4.0 em Empresas Brasileiras. Revista Eletrônica PesquisABC (Encontro de Iniciação Científica), [S. l.], ISSN 2675-1461.
              </div>
            </div>
          </div>
        </div>

        {/* Resumo Executivo */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
            <div className="text-sm text-slate-600">Média Geral</div>
            <div className="mt-1 text-4xl font-semibold text-slate-900">{overall.avg.toFixed(2)}</div>
            <div className="mt-1 text-xs text-slate-500">escala real de 1 a 5</div>
            <div className="mt-3 text-sm text-slate-600">{overall.percent}% da escala máxima</div>
            <div className="mt-2 text-xs leading-relaxed text-slate-600">
              Média calculada diretamente a partir das respostas do questionário, mantendo a escala original do instrumento (1–5).
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2 print:shadow-none print:ring-0">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 print:bg-white print:ring-0">
              <div className="text-xs font-semibold text-slate-700">Pontuação (LM)</div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-2xl font-semibold text-slate-900">{weighted.totalPoints}</div>
                <div className="text-xs text-slate-600">/ {weighted.maxTotal} pts</div>
              </div>
              <div className="mt-2 text-sm">
                <span className="font-semibold text-slate-900">{weighted.classification.label}</span>
              </div>
              <div className="mt-1 text-xs text-slate-600">{weighted.classification.range}</div>
              <p className="mt-2 text-xs leading-relaxed text-slate-700">
                {weighted.classification.note}
              </p>
            </div>
          </section>
        </div>

        {/* Gráficos */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
            <div className="mb-2 font-semibold text-slate-900">Radar por dimensão (média 0–5)</div>
            <div className="h-[320px]">
              <canvas ref={radarCanvasRef} />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
            <div className="mb-2 font-semibold text-slate-900">Pontuação ponderada + pesos</div>
            <div className="h-[320px]">
              <canvas ref={weightedCanvasRef} />
            </div>
          </section>
        </div>

        {/* Tabela por dimensão */}
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
          <div className="mb-2 font-semibold text-slate-900">Resultados por dimensão</div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-600">
                  <th className="py-2 pr-3">Dimensão</th>
                  <th className="py-2 pr-3">Média</th>
                  <th className="py-2 pr-3">%</th>
                  <th className="py-2 pr-3">Peso</th>
                  <th className="py-2 pr-3">Pontos</th>
                  <th className="py-2 pr-3">Máx.</th>
                  <th className="py-2 pr-3">Gap</th>
                </tr>
              </thead>
              <tbody>
                {weighted.rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-semibold text-slate-900">{r.name}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.avg}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.percent}%</td>
                    <td className="py-2 pr-3 text-slate-700">{r.weight}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.points}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.maxPoints}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.gap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-slate-600">
            “Gap” = diferença entre a pontuação máxima prevista (por dimensão) e a pontuação obtida.
            Quanto maior o gap, maior a oportunidade de melhoria dentro do instrumento aplicado.
          </p>
        </section>

        {/* Itens críticos */}
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
          <div className="mb-2 font-semibold text-slate-900">Top itens críticos (priorização objetiva)</div>
          <p className="text-xs text-slate-600">
            A lista abaixo mostra os itens do questionário que mais merecem atenção, organizados a partir das menores notas e da relevância da dimensão no modelo.
          </p>

          <div className="mt-3 space-y-3">
            {criticalItems.length === 0 ? (
              <div className="text-sm text-slate-700">
                Nenhum item crítico encontrado (verifique se a avaliação possui respostas salvas).
              </div>
            ) : (
              criticalItems.map((it) => (
                <div key={it.question_id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-700">
                      {it.dimension} • Peso {it.weight}
                    </div>

                    <span
                      className={[
                        "rounded-full px-3 py-1 text-xs font-semibold ring-1",
                        noteBadgeClass(it.value),
                      ].join(" ")}
                    >
                      Nota: {it.value}
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-slate-900">{it.text}</div>
                  <div className="mt-1 text-xs text-slate-600">{it.concept}</div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="text-xs font-semibold text-slate-700">{criticalSectionText.title}</div>

            {criticalSectionText.paragraphs.map((paragraph, index) => (
              <p key={index} className="mt-2 text-xs leading-relaxed text-slate-600">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        {/* Ações */}
        <div className="mt-6 max-w-md space-y-2 print:hidden">
          <button
            onClick={() => router.push(`/assessment/${assessmentId}/result`)}
            className="w-full rounded-2xl border bg-white py-3 shadow-sm"
          >
            Voltar aos resultados
          </button>

          <button
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
            className="w-full rounded-2xl bg-slate-900 py-3 text-white disabled:opacity-60"
          >
            {generatingPdf ? "Abrindo impressão..." : "Exportar PDF"}
          </button>

          <button
            onClick={() => router.push(`/assessment/${assessmentId}`)}
            className="w-full rounded-2xl border bg-white py-3 shadow-sm"
          >
            Voltar ao questionário
          </button>
        </div>
      </div>
    </main>
  );
}