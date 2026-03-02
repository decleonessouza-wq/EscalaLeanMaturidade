"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Question = {
  id: number;
  text: string;
  concept: string;
  dimension_id: number;
};

type Dimension = {
  id: number;
  name: string;
};

type ResponseRow = {
  question_id: number;
  value: number;
};

type AssessmentRow = {
  id: string;
  status: "draft" | "completed" | "locked";
  title: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function AssessmentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assessmentId = params?.id;

  const [assessment, setAssessment] = useState<AssessmentRow | null>(null);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isLocked = assessment?.status === "completed" || assessment?.status === "locked";

  useEffect(() => {
    async function load() {
      if (!assessmentId) return;
      setLoading(true);

      const [a, d, q, r] = await Promise.all([
        supabase.from("assessments").select("id,status,title").eq("id", assessmentId).single(),
        supabase.from("dimensions").select("id,name").order("id"),
        supabase.from("questions").select("id,text,concept,dimension_id").order("id"),
        supabase.from("responses").select("question_id,value").eq("assessment_id", assessmentId),
      ]);

      if (a.data) setAssessment(a.data as AssessmentRow);
      if (d.data) setDimensions(d.data as Dimension[]);
      if (q.data) setQuestions(q.data as Question[]);

      if (r.data) {
        const map: Record<number, number> = {};
        (r.data as ResponseRow[]).forEach((x) => (map[x.question_id] = x.value));
        setAnswers(map);
      } else {
        setAnswers({});
      }

      setLoading(false);
    }

    load();
  }, [assessmentId]);

  async function saveResponses() {
    if (!assessmentId) return;

    if (isLocked) {
      alert("Esta avaliação está finalizada/travada e não pode mais ser editada.");
      return;
    }

    const rows = Object.entries(answers).map(([qid, val]) => ({
      assessment_id: assessmentId,
      question_id: Number(qid),
      value: val,
    }));

    if (rows.length === 0) return;

    setSaving(true);

    const { error } = await supabase
      .from("responses")
      .upsert(rows, { onConflict: "assessment_id,question_id" });

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  function setAnswer(questionId: number, value: number) {
    if (isLocked) return;
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  const answered = Object.keys(answers).length;
  const total = questions.length;
  const percent = total > 0 ? clamp(Math.round((answered / total) * 100), 0, 100) : 0;

  const subtitle = useMemo(() => {
    if (!assessment) return null;
    if (assessment.title) return assessment.title;
    return `Avaliação ${assessment.id.slice(0, 8)}…`;
  }, [assessment]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-md px-4 py-6">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 text-sm text-slate-700">
            Carregando questionário…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-4 py-5">
        {/* HEADER */}
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-slate-900">Questionário Lean</h1>
          {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}

          {isLocked && (
            <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
              Esta avaliação está <b>finalizada/travada</b>. As respostas não podem ser alteradas.
            </div>
          )}

          {/* Progress */}
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-slate-600">
              <span>
                {answered}/{total} respondidas
              </span>
              <span>{percent}%</span>
            </div>

            <progress
              value={answered}
              max={Math.max(1, total)}
              className="
                w-full h-2 overflow-hidden rounded-full
                [&::-webkit-progress-bar]:bg-slate-200
                [&::-webkit-progress-value]:bg-slate-900
                [&::-moz-progress-bar]:bg-slate-900
              "
            />
          </div>
        </div>

        {/* QUESTIONS */}
        {dimensions.map((dim) => (
          <section key={dim.id} className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">{dim.name}</h2>

            {questions
              .filter((q) => q.dimension_id === dim.id)
              .map((q) => (
                <div key={q.id} className="mb-3 rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="text-sm leading-snug text-slate-900">{q.text}</div>
                  <div className="mt-1 text-xs text-slate-500">{q.concept}</div>

                  <div className="mt-3 flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setAnswer(q.id, n)}
                        disabled={isLocked}
                        className={`flex-1 rounded-xl border py-2 text-sm transition active:scale-[0.99] disabled:opacity-60 ${
                          answers[q.id] === n
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-slate-800"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </section>
        ))}

        {/* ACTIONS */}
        <div className="mt-6 space-y-2">
          <button
            onClick={saveResponses}
            disabled={saving || isLocked}
            className="w-full rounded-2xl border bg-white py-3 text-sm font-semibold text-slate-900 shadow-sm disabled:opacity-60 active:scale-[0.99]"
          >
            {saving ? "Salvando..." : "Salvar rascunho"}
          </button>

          <button
            onClick={async () => {
              await saveResponses();
              router.push(`/assessment/${assessmentId}/result`);
            }}
            disabled={saving}
            className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-60 active:scale-[0.99]"
          >
            Ver resultados
          </button>

          <button
            onClick={() => router.push("/")}
            className="w-full rounded-2xl border bg-white py-3 text-sm font-semibold text-slate-900 shadow-sm active:scale-[0.99]"
          >
            Voltar
          </button>
        </div>
      </div>
    </main>
  );
}