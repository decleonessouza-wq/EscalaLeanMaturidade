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

/**
 * ✅ Registro COMPLETO do Chart.js
 * - Radar: RadarController + RadialLinearScale + PointElement + LineElement + Filler
 * - Combo Bar+Line (gráfico do artigo): BarController/BarElement + LineController/LineElement + scales
 */
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

type Dimension = { id: number; name: string };
type Question = { id: number; dimension_id: number };
type ResponseRow = { question_id: number; value: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Pesos do artigo (1..5) por dimensão.
 * - Ferramentas Lean = 1
 * - Cadeias de valor = 2
 * - Perspectiva do Funcionário = 3
 * - Lean Digital = 4
 * - Lean 4.0 = 5
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
 * ✅ Faixas do artigo (0–375)
 */
function classifyByPoints(totalPoints: number) {
  const p = Math.round(totalPoints);

  if (p >= 281) {
    return {
      label: "Empresas Destaques",
      range: "281 – 375 pontos",
      note:
        "Tanto os líderes quanto os funcionários entendem e aplicam ferramentas do LM. A soma das notas é de pelo menos 75% da pontuação total.",
    };
  }

  if (p >= 187) {
    return {
      label: "Empresas Acima da Média",
      range: "187 – 280 pontos",
      note:
        "A soma das notas fica entre 50% e 75% da pontuação total. Muitas das ferramentas do LM são aplicadas, embora possa haver alguns setores que ainda não adotaram a cultura lean.",
    };
  }

  if (p >= 93) {
    return {
      label: "Empresas Médias",
      range: "93 – 186 pontos",
      note:
        "A soma das notas fica entre 25% e 50% da pontuação total. Nesta categoria, muitas práticas de produção e de relacionamento com clientes seguem modelos de gestão antigos.",
    };
  }

  return {
    label: "Empresas em risco",
    range: "0 – 92 pontos",
    note:
      "A soma das notas é inferior a 25% da pontuação total. Estas empresas utilizam poucas ou nenhuma das ferramentas do LM ou elementos culturais apresentados neste estudo.",
  };
}

export default function ResultPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assessmentId = params?.id;

  const [loading, setLoading] = useState(true);
  const [savingLock, setSavingLock] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [assessmentLocked, setAssessmentLocked] = useState(false);

  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const radarChartRef = useRef<Chart | null>(null);

  const weightedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const weightedChartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!assessmentId) return;

    async function load() {
      setLoading(true);

      const [dRes, qRes, rRes, aRes] = await Promise.all([
        supabase.from("dimensions").select("id,name").order("id"),
        supabase.from("questions").select("id,dimension_id").order("id"),
        supabase.from("responses").select("question_id,value").eq("assessment_id", assessmentId),
        supabase.from("assessments").select("id,locked,locked_at").eq("id", assessmentId).maybeSingle(),
      ]);

      if (dRes.error) alert(dRes.error.message);
      if (qRes.error) alert(qRes.error.message);
      if (rRes.error) alert(rRes.error.message);
      if (aRes.error) alert(aRes.error.message);

      setDimensions((dRes.data ?? []) as Dimension[]);
      setQuestions((qRes.data ?? []) as Question[]);
      setResponses((rRes.data ?? []) as ResponseRow[]);
      setAssessmentLocked(Boolean(aRes.data?.locked));

      setLoading(false);
    }

    load();
  }, [assessmentId]);

  const totalQuestions = questions.length;
  const answeredCount = responses.length;

  const byQuestion = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of responses) m.set(r.question_id, r.value);
    return m;
  }, [responses]);

  /**
   * Stats por dimensão:
   * - avg (0..5) para radar
   * - sum (ex.: 5..25 quando há 5 perguntas) para pontuação do artigo
   */
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

  /**
   * Percentual geral (0..100) mantido para UI,
   * mas a pontuação "conforme artigo" vem do weighted.totalPoints (0..375).
   */
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

  /**
   * ✅ Cálculo 100% no modelo do artigo:
   * - por dimensão: Pontos = (SOMA das respostas 1..5) × Peso (1..5)
   * - máximo por dimensão: (QtdePerguntas × 5) × Peso
   * - total máximo esperado: 375 (quando 5 perguntas por dimensão e pesos 1..5)
   */
  const weighted = useMemo(() => {
    const rows = dimensionStats.map((d, idx) => {
      const weight = getWeightForDimension(d.name, idx + 1);
      const maxPoints = d.total * 5 * weight; // ex: 5*5*weight = 25*weight
      const points = d.sum * weight; // ✅ soma real × peso (artigo)
      return {
        ...d,
        weight,
        maxPoints,
        points: Number(points.toFixed(0)),
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
          {
            label: "Média (0–5)",
            data,
            borderWidth: 2,
            pointRadius: 3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: { suggestedMin: 0, suggestedMax: 5, ticks: { stepSize: 1 } },
        },
      },
    });

    return () => {
      radarChartRef.current?.destroy();
      radarChartRef.current = null;
    };
  }, [dimensions.length, dimensionStats]);

  // Gráfico do artigo (bar + line)
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
            label: "Pontuação final (Pontos × Peso)",
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
        plugins: {
          legend: { display: true },
        },
        scales: {
          yPoints: {
            position: "left",
            beginAtZero: true,
            title: { display: true, text: "Pontuação final (Pontos × Peso)" },
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
      document.title = `Escala Lean Maturity - ${assessmentId}`;
      window.print();
      document.title = oldTitle;
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleFinalizeAndLock() {
    if (!assessmentId) return;

    if (answeredCount < totalQuestions) {
      alert("Você precisa responder todas as perguntas antes de finalizar e travar.");
      return;
    }

    setSavingLock(true);

    const dimension_avgs = dimensionStats.map((d) => ({
      dimension_id: d.id,
      name: d.name,
      avg: d.avg,
      percent: d.percent,
      answered: d.answered,
      total: d.total,
    }));

    const upsertRes = await supabase.from("assessment_results").upsert(
      {
        assessment_id: assessmentId,
        overall_avg: overall.avg,
        overall_percent: overall.percent,
        level: weighted.classification.label,
        answered_count: answeredCount,
        total_questions: totalQuestions,
        dimension_avgs,
        locked: true,
        locked_at: new Date().toISOString(),
      },
      { onConflict: "assessment_id" }
    );

    if (upsertRes.error) {
      alert(upsertRes.error.message);
      setSavingLock(false);
      return;
    }

    const lockRes = await supabase
      .from("assessments")
      .update({ locked: true, locked_at: new Date().toISOString() })
      .eq("id", assessmentId);

    if (lockRes.error) {
      alert(lockRes.error.message);
      setSavingLock(false);
      return;
    }

    setAssessmentLocked(true);
    setSavingLock(false);
    alert("Avaliação finalizada e travada com sucesso!");
  }

  if (loading) return <div className="p-6">Carregando...</div>;

  const progress = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-slate-900">Resultados</h1>
          <p className="text-sm text-slate-600">
            Respondidas: {answeredCount} / {totalQuestions}
          </p>

          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-slate-600">
              <span>Progresso</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-slate-900 transition-all"
                style={{ width: `${clamp(progress, 0, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border bg-white p-4 shadow-sm lg:col-span-1">
            <div className="text-sm text-slate-600">Maturidade Geral</div>
            <div className="mt-1 text-4xl font-semibold text-slate-900">{overall.percent}%</div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-xs font-semibold text-slate-700">Pontuação (modelo do artigo)</div>

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

          <section className="rounded-2xl border bg-white p-4 shadow-sm lg:col-span-2">
            <div className="mb-3 font-semibold text-slate-900">Radar por dimensão</div>
            <div className="h-[320px]">
              <canvas ref={radarCanvasRef} />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Escala do radar: 0–5 (média das respostas de cada dimensão).
            </p>
          </section>
        </div>

        <section className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="font-semibold text-slate-900">Análise de maturidade Lean</div>
          <div className="text-xs text-slate-600">
            Pontuação final (Pontos × Peso) + Pesos (1–5) — conforme modelo do artigo.
          </div>

          <div className="mt-3 h-[320px]">
            <canvas ref={weightedCanvasRef} />
          </div>
        </section>

        <div className="mt-6 max-w-md space-y-2 print:hidden">
          <button
            onClick={() => router.push(`/assessment/${assessmentId}`)}
            className="w-full rounded-2xl border bg-white py-3 shadow-sm"
          >
            Voltar ao questionário
          </button>

          <button
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
            className="w-full rounded-2xl bg-slate-700 py-3 text-white disabled:opacity-60"
          >
            {generatingPdf ? "Abrindo impressão..." : "Gerar PDF"}
          </button>

          <button
            onClick={handleFinalizeAndLock}
            disabled={savingLock || assessmentLocked}
            className="w-full rounded-2xl bg-emerald-600 py-3 text-white disabled:opacity-60"
          >
            {assessmentLocked ? "Avaliação travada" : savingLock ? "Finalizando..." : "Finalizar e travar"}
          </button>

          <button
            onClick={() => router.push("/")}
            className="w-full rounded-2xl border bg-white py-3 shadow-sm"
          >
            Ir para início
          </button>
        </div>
      </div>
    </main>
  );
}