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
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

Chart.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

type Dimension = { id: number; name: string };
type Question = { id: number; dimension_id: number };
type ResponseRow = { question_id: number; value: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function classifyLevel(percent0to100: number) {
  if (percent0to100 >= 85) return { label: "Excelente", note: "Maturidade alta e consistente." };
  if (percent0to100 >= 70) return { label: "Avançado", note: "Bom nível de maturidade, com oportunidades pontuais." };
  if (percent0to100 >= 50) return { label: "Intermediário", note: "Bases presentes, mas ainda há gaps importantes." };
  if (percent0to100 >= 30) return { label: "Inicial", note: "Primeiras práticas existentes, precisa consolidar." };
  return { label: "Crítico", note: "Baixa maturidade; recomenda-se plano estruturado de melhorias." };
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
  const [loadError, setLoadError] = useState<string | null>(null);

  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const radarChartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!assessmentId) return;

    async function load() {
      setLoading(true);
      setLoadError(null);

      const [dRes, qRes, rRes, aRes] = await Promise.all([
        supabase.from("dimensions").select("id,name").order("id"),
        supabase.from("questions").select("id,dimension_id").order("id"),
        supabase.from("responses").select("question_id,value").eq("assessment_id", assessmentId),
        // OBS: aqui assume que a tabela assessments tem colunas locked e locked_at
        supabase.from("assessments").select("id,locked,locked_at").eq("id", assessmentId).maybeSingle(),
      ]);

      const firstErr =
        dRes.error?.message ||
        qRes.error?.message ||
        rRes.error?.message ||
        aRes.error?.message ||
        null;

      if (firstErr) setLoadError(firstErr);

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

  const dimensionStats = useMemo(() => {
    // média por dimensão (0..5)
    return dimensions.map((dim) => {
      const qids = questions.filter((q) => q.dimension_id === dim.id).map((q) => q.id);
      const vals = qids
        .map((qid) => byQuestion.get(qid))
        .filter((v): v is number => typeof v === "number");

      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      const percent = (avg / 5) * 100;

      return {
        id: dim.id,
        name: dim.name,
        answered: vals.length,
        total: qids.length,
        avg: Number(avg.toFixed(2)),
        percent: Number(percent.toFixed(2)),
      };
    });
  }, [dimensions, questions, byQuestion]);

  const overall = useMemo(() => {
    // média geral ponderada por questão
    const vals: number[] = [];
    for (const q of questions) {
      const v = byQuestion.get(q.id);
      if (typeof v === "number") vals.push(v);
    }
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const percent = (avg / 5) * 100;
    const level = classifyLevel(percent);

    return {
      avg: Number(avg.toFixed(2)),
      percent: Number(percent.toFixed(0)),
      level,
    };
  }, [questions, byQuestion]);

  // Render radar
  useEffect(() => {
    if (!radarCanvasRef.current) return;
    if (!dimensions.length) return;

    const labels = dimensionStats.map((d) => d.name);
    const data = dimensionStats.map((d) => d.avg);

    // destroy antigo
    radarChartRef.current?.destroy();
    radarChartRef.current = null;

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
            // Paleta alinhada com a logo (verde/emerald como primária)
            borderColor: "rgb(4,120,87)", // emerald-700
            backgroundColor: "rgba(4,120,87,0.18)",
            pointBackgroundColor: "rgb(4,120,87)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          tooltip: { enabled: true },
        },
        scales: {
          r: {
            suggestedMin: 0,
            suggestedMax: 5,
            ticks: { stepSize: 1, showLabelBackdrop: false },
            grid: { color: "rgba(15,23,42,0.12)" },
            angleLines: { color: "rgba(15,23,42,0.12)" },
            pointLabels: { color: "#0f172a", font: { size: 12 } },
          },
        },
      },
    });

    return () => {
      radarChartRef.current?.destroy();
      radarChartRef.current = null;
    };
  }, [dimensions.length, dimensionStats]);

  async function handleGeneratePdf() {
    // Evita html2canvas -> evita OKLCH
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

    // 1) salva/atualiza resultados
    const upsertRes = await supabase.from("assessment_results").upsert(
      {
        assessment_id: assessmentId,
        overall_avg: overall.avg,
        overall_percent: overall.percent,
        level: overall.level.label,
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

    // 2) trava na tabela assessments
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

  const progress = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
          <div className="rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
            Carregando…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
        {/* HEADER */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-slate-900 lg:text-2xl">Resultados</h1>
              <p className="text-sm text-slate-600">
                Respondidas: {answeredCount} / {totalQuestions}
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="hidden rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99] sm:inline-flex print:hidden"
            >
              Início
            </button>
          </div>

          {loadError && (
            <div className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
              Erro ao carregar: {loadError}
            </div>
          )}

          {/* Progresso */}
          <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="mb-2 flex justify-between text-xs text-slate-600">
              <span>Progresso</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-emerald-700 transition-all"
                style={{ width: `${clamp(progress, 0, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* GRID: conteúdo + ações sticky */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {/* Resumo */}
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm text-slate-600">Maturidade Geral</div>
              <div className="mt-1 text-4xl font-semibold text-slate-900">{overall.percent}%</div>
              <div className="mt-1 text-sm text-slate-700">
                Nível: <span className="font-semibold text-slate-900">{overall.level.label}</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">{overall.level.note}</p>
            </section>

            {/* Radar */}
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-semibold text-slate-900">Radar por dimensão</div>
                <div className="text-xs text-slate-500">Média (0–5)</div>
              </div>

              <div className="h-[340px]">
                <canvas ref={radarCanvasRef} />
              </div>

              <p className="mt-2 text-xs text-slate-600">
                Escala do radar: 0–5 (média das respostas de cada dimensão).
              </p>
            </section>

            {/* Detalhamento */}
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-3 font-semibold text-slate-900">Detalhamento</div>

              <div className="space-y-3">
                {dimensionStats.map((d) => (
                  <div key={d.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 text-sm font-semibold text-slate-900">{d.name}</div>
                      <div className="shrink-0 text-sm text-slate-700">{d.avg.toFixed(2)} / 5</div>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full bg-emerald-700"
                        style={{ width: `${clamp(d.percent, 0, 100)}%` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                      <span>
                        {d.answered}/{d.total} respondidas
                      </span>
                      <span>{Math.round(d.percent)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* AÇÕES */}
          <aside className="lg:sticky lg:top-6 print:hidden">
            <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <button
                type="button"
                onClick={() => router.push(`/assessment/${assessmentId}`)}
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99]"
              >
                Voltar ao questionário
              </button>

              <button
                type="button"
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-950 disabled:opacity-60 active:scale-[0.99]"
              >
                {generatingPdf ? "Abrindo impressão..." : "Gerar PDF"}
              </button>

              <button
                type="button"
                onClick={handleFinalizeAndLock}
                disabled={savingLock || assessmentLocked}
                className="w-full rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60 active:scale-[0.99]"
              >
                {assessmentLocked ? "Avaliação travada" : savingLock ? "Finalizando..." : "Finalizar e travar"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99]"
              >
                Ir para início
              </button>

              <div className="pt-2 text-xs text-slate-500">
                Dica: finalize e trave somente quando estiver 100% respondido.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}