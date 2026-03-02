"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Company = {
  id: string;
  name: string;
  created_at: string;
};

type Assessment = {
  id: string;
  title: string;
  context_unit: string | null;
  applied_at: string;
  created_at: string;
  status?: string | null;
  company_id: string;
};

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatDate(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

/* ===== UI helpers ===== */

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.99]"
          >
            Fechar
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

function ActionSheet({
  open,
  title,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  actions: { label: string; tone?: "danger" | "default"; onClick: () => void }[];
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
        </div>

        <div className="p-2">
          {actions.map((a, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                a.onClick();
                onClose();
              }}
              className={[
                "w-full rounded-xl px-4 py-3 text-left text-sm font-semibold active:scale-[0.99]",
                a.tone === "danger"
                  ? "text-red-700 hover:bg-red-50"
                  : "text-slate-900 hover:bg-slate-50",
              ].join(" ")}
            >
              {a.label}
            </button>
          ))}

          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Page ===== */

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const companyId = params?.id;

  const [company, setCompany] = useState<Company | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assessmentMenuId, setAssessmentMenuId] = useState<string | null>(null);
  const selectedAssessment = useMemo(
    () => assessments.find((a) => a.id === assessmentMenuId) ?? null,
    [assessments, assessmentMenuId]
  );

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");

  async function load() {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    const [cRes, aRes] = await Promise.all([
      supabase.from("companies").select("id,name,created_at").eq("id", companyId).single(),
      supabase
        .from("assessments")
        .select("id,title,context_unit,applied_at,created_at,status,company_id")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
    ]);

    if (cRes.error) setError(cRes.error.message);
    if (aRes.error) setError(aRes.error.message);

    setCompany((cRes.data as Company) ?? null);
    setAssessments((aRes.data as Assessment[]) ?? []);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [companyId]);

  function openEdit() {
    if (!company) return;
    setEditName(company.name ?? "");
    setEditOpen(true);
  }

  async function saveCompany() {
    if (!company) return;

    const name = editName.trim();
    if (!name) {
      alert("Informe o nome da empresa.");
      return;
    }

    setBusy(true);
    setError(null);

    const { error } = await supabase.from("companies").update({ name }).eq("id", company.id);

    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    setEditOpen(false);
    await load();
  }

  async function deleteAssessment(assessmentId: string) {
    const ok = confirm(
      "Excluir esta avaliação?\n\nCom ON DELETE CASCADE, isso apagará também as respostas vinculadas."
    );
    if (!ok) return;

    setAssessmentMenuId(null);
    setBusy(true);
    setError(null);

    const { error } = await supabase.from("assessments").delete().eq("id", assessmentId);

    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    await load();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 text-sm text-slate-700">
            Carregando empresa…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {/* Header / Top bar */}
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                <img
                  src="/icons/icon-192.png"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/icons/icon-512.png";
                  }}
                  alt="Logo Escala Lean Maturity"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-slate-900">
                  {company?.name ?? "Empresa"}
                </h1>
                <p className="text-sm text-slate-600">
                  Criada em {company?.created_at ? formatDateTime(company.created_at) : "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99]"
            >
              Início
            </button>

            <button
              type="button"
              onClick={openEdit}
              disabled={busy || !company}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60"
            >
              Editar empresa
            </button>

            <button
              type="button"
              onClick={() => router.push(`/new?companyId=${companyId}`)}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.99]"
            >
              + Nova avaliação
            </button>

            <button
              type="button"
              onClick={load}
              disabled={busy}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Aguarde..." : "Atualizar"}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
            Erro: {error}
          </div>
        )}

        {/* Layout desktop: lista + painel */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Coluna esquerda: lista */}
          <section className="lg:col-span-7">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Avaliações ({assessments.length})
              </h2>
              <span className="text-xs text-slate-500">Toque/clique no card para abrir</span>
            </div>

            <div className="space-y-2">
              {assessments.length === 0 ? (
                <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
                  Nenhuma avaliação nesta empresa ainda.
                </div>
              ) : (
                assessments.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => router.push(`/assessment/${a.id}`)}
                    className="cursor-pointer rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {a.title || "Sem título"}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {a.context_unit ?? "—"} • {formatDate(a.applied_at)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Criada em {formatDateTime(a.created_at)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssessmentMenuId(a.id);
                        }}
                        className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-100 active:scale-[0.99]"
                        aria-label="Ações da avaliação"
                        title="Ações"
                      >
                        ⋯
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Botão voltar (mobile) */}
            <div className="mt-4 lg:hidden">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 active:scale-[0.99]"
              >
                Voltar
              </button>
            </div>
          </section>

          {/* Coluna direita: “Resumo” (desktop) */}
          <aside className="lg:col-span-5">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">Atalhos</div>
              <p className="mt-1 text-sm text-slate-600">
                Crie uma nova avaliação para esta empresa ou abra avaliações anteriores.
              </p>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => router.push(`/new?companyId=${companyId}`)}
                  className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.99]"
                >
                  + Nova avaliação
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99]"
                >
                  Voltar ao início
                </button>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
                Dica: use o menu “⋯” em uma avaliação para ver resultados ou excluir.
              </div>
            </div>

            <footer className="mt-4 pb-4 text-center text-xs text-slate-500">
              Escala Lean de Maturidade • Empresa • v0.1
            </footer>
          </aside>
        </div>
      </div>

      <ActionSheet
        open={!!selectedAssessment}
        title={
          selectedAssessment
            ? `Avaliação: ${selectedAssessment.title ?? "Sem título"}`
            : "Avaliação"
        }
        onClose={() => setAssessmentMenuId(null)}
        actions={[
          {
            label: "Abrir questionário",
            onClick: () => {
              if (selectedAssessment) router.push(`/assessment/${selectedAssessment.id}`);
            },
          },
          {
            label: "Ver resultados",
            onClick: () => {
              if (selectedAssessment) router.push(`/assessment/${selectedAssessment.id}/result`);
            },
          },
          {
            label: "Excluir avaliação (cascade)",
            tone: "danger",
            onClick: () => {
              if (selectedAssessment) deleteAssessment(selectedAssessment.id);
            },
          },
        ]}
      />

      <Modal
        open={editOpen}
        title="Editar empresa"
        onClose={() => {
          if (!busy) setEditOpen(false);
        }}
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="edit-company-name" className="text-xs font-semibold text-slate-700">
              Nome da empresa
            </label>
            <input
              id="edit-company-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Ex: Terracota Engenharia"
              aria-label="Nome da empresa"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:ring-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              disabled={busy}
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 active:scale-[0.99] disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveCompany}
              disabled={busy}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}