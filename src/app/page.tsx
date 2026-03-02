"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  applied_at: string; // geralmente "YYYY-MM-DD"
  created_at: string;
  company_id: string;
  companies?: { name: string }[] | null; // relação pode vir como array
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

/* ===================== UI Helpers (Modal / Sheet) ===================== */

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <button
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
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
            onClick={onClose}
            className="mt-2 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 active:scale-[0.99]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Page ===================== */

export default function HomePage() {
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Action sheet targets
  const [companyMenuId, setCompanyMenuId] = useState<string | null>(null);
  const [assessmentMenuId, setAssessmentMenuId] = useState<string | null>(null);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyMenuId) ?? null,
    [companies, companyMenuId]
  );

  const selectedAssessment = useMemo(
    () => assessments.find((a) => a.id === assessmentMenuId) ?? null,
    [assessments, assessmentMenuId]
  );

  // Edit modals
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [editCompanyName, setEditCompanyName] = useState("");

  const [editAssessmentOpen, setEditAssessmentOpen] = useState(false);
  const [editAssessmentTitle, setEditAssessmentTitle] = useState("");
  const [editAssessmentContextUnit, setEditAssessmentContextUnit] = useState("");
  const [editAssessmentAppliedAt, setEditAssessmentAppliedAt] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  async function load() {
    setLoading(true);
    setError(null);

    const [companiesRes, assessmentsRes] = await Promise.all([
      supabase
        .from("companies")
        .select("id,name,created_at")
        .order("created_at", { ascending: false }),

      supabase
        .from("assessments")
        .select("id,title,context_unit,applied_at,created_at,company_id,companies(name)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (companiesRes.error) setError(companiesRes.error.message);
    if (assessmentsRes.error) setError(assessmentsRes.error.message);

    setCompanies((companiesRes.data as Company[]) ?? []);
    setAssessments((assessmentsRes.data as Assessment[]) ?? []);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  /* ===================== Actions: Companies ===================== */

  function openEditCompany(c: Company) {
    setEditCompanyName(c.name ?? "");
    setEditCompanyOpen(true);
  }

  async function saveCompany() {
    if (!selectedCompany) return;
    const name = editCompanyName.trim();
    if (!name) {
      alert("Informe o nome da empresa.");
      return;
    }

    setBusy(true);
    setError(null);

    const { error: upErr } = await supabase
      .from("companies")
      .update({ name })
      .eq("id", selectedCompany.id);

    setBusy(false);

    if (upErr) {
      alert(upErr.message);
      return;
    }

    setEditCompanyOpen(false);
    setCompanyMenuId(null);
    await load();
  }

  async function deleteCompany(companyId: string) {
    const ok = confirm(
      "Excluir esta empresa?\n\nIsso também excluirá todas as avaliações e respostas vinculadas."
    );
    if (!ok) return;

    setCompanyMenuId(null);

    setBusy(true);
    setError(null);

    // Com ON DELETE CASCADE: basta apagar a empresa
    const { error: delCompErr } = await supabase.from("companies").delete().eq("id", companyId);

    setBusy(false);

    if (delCompErr) {
      alert(delCompErr.message);
      return;
    }

    await load();
  }

  /* ===================== Actions: Assessments ===================== */

  function openEditAssessment(a: Assessment) {
    setEditAssessmentTitle(a.title ?? "");
    setEditAssessmentContextUnit(a.context_unit ?? "");
    setEditAssessmentAppliedAt(a.applied_at || editAssessmentAppliedAt);
    setEditAssessmentOpen(true);
  }

  async function saveAssessment() {
    if (!selectedAssessment) return;

    const title = editAssessmentTitle.trim();
    if (!title) {
      alert("Informe o título da avaliação.");
      return;
    }

    const payload = {
      title,
      context_unit: editAssessmentContextUnit.trim() || null,
      applied_at: editAssessmentAppliedAt,
    };

    setBusy(true);
    setError(null);

    const { error: upErr } = await supabase
      .from("assessments")
      .update(payload)
      .eq("id", selectedAssessment.id);

    setBusy(false);

    if (upErr) {
      alert(upErr.message);
      return;
    }

    setEditAssessmentOpen(false);
    setAssessmentMenuId(null);
    await load();
  }

  async function deleteAssessment(assessmentId: string) {
    const ok = confirm(
      "Excluir esta avaliação?\n\nIsso também excluirá todas as respostas deste questionário."
    );
    if (!ok) return;

    setAssessmentMenuId(null);

    setBusy(true);
    setError(null);

    // Com ON DELETE CASCADE: basta apagar a avaliação
    const { error: delErr } = await supabase.from("assessments").delete().eq("id", assessmentId);

    setBusy(false);

    if (delErr) {
      alert(delErr.message);
      return;
    }

    await load();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* container mais largo no desktop */}
      <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
        {/* HEADER com LOGO */}
        <header className="mb-6">
          <div className="flex items-center gap-4">
            {/* LOGO MAIOR */}
            <div className="h-20 w-20 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 sm:h-24 sm:w-24">
              <img
                src="/icons/icon-192.png"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/icons/icon-192.png";
                }}
                alt="Logo Escala Lean Maturity"
                className="h-full w-full object-cover"
              />
            </div>

            {/* TÍTULO “BRAND” */}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
                <span className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-slate-900 bg-clip-text text-transparent">
                  Escala Lean de Maturidade
                </span>
              </h1>

              <p className="mt-1 text-sm text-slate-600 sm:text-base">
                <span className="font-semibold text-emerald-700">PWA</span> • Formulário de avaliações
                de maturidade Lean
              </p>
            </div>
          </div>

          {/* ações principais */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
            <Link
              href="/new"
              className="rounded-xl bg-emerald-700 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 active:scale-[0.99]"
            >
              + Nova avaliação
            </Link>

            <button
              onClick={load}
              disabled={loading || busy}
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Aguarde..." : "Atualizar"}
            </button>
          </div>
        </header>

        {loading && (
          <div className="mb-4 rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            Carregando…
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
            Erro: {error}
          </div>
        )}

        {/* layout desktop: duas colunas */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ===================== EMPRESAS ===================== */}
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Empresas ({companies.length})
              </h2>
              <span className="text-xs text-slate-500">Clique/toque para abrir</span>
            </div>

            <div className="space-y-2">
              {companies.length === 0 && !loading ? (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                  Nenhuma empresa cadastrada ainda.
                </div>
              ) : (
                companies.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/company/${c.id}`)}
                    className="cursor-pointer rounded-2xl bg-white p-4 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{c.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Criada em {formatDateTime(c.created_at)}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-emerald-700">
                          Ver avaliações →
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCompanyMenuId(c.id);
                        }}
                        className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99]"
                        aria-label="Ações da empresa"
                        title="Ações"
                      >
                        ⋯
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ===================== AVALIAÇÕES ===================== */}
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Últimas avaliações ({assessments.length})
              </h2>
              <span className="text-xs text-slate-500">Clique/toque para abrir</span>
            </div>

            <div className="space-y-2">
              {assessments.length === 0 && !loading ? (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                  Nenhuma avaliação registrada ainda.
                </div>
              ) : (
                assessments.map((a) => {
                  const companyName = a.companies?.[0]?.name ?? "";
                  return (
                    <div
                      key={a.id}
                      onClick={() => router.push(`/assessment/${a.id}`)}
                      className="cursor-pointer rounded-2xl bg-white p-4 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{a.title}</div>
                          <div className="mt-1 text-xs text-slate-600">
                            {companyName ? `${companyName} • ` : ""}
                            {a.context_unit ?? "—"} • {formatDate(a.applied_at)}
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssessmentMenuId(a.id);
                          }}
                          className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99]"
                          aria-label="Ações da avaliação"
                          title="Ações"
                        >
                          ⋯
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <footer className="mt-8 pb-6 text-center text-xs text-slate-500">
          Escala Lean de Maturidade • Desenvolvido por Decleones Andrade • v0.1
        </footer>
      </div>

      {/* ===================== COMPANY ACTION SHEET ===================== */}
      <ActionSheet
        open={!!selectedCompany}
        title={selectedCompany ? `Empresa: ${selectedCompany.name}` : "Empresa"}
        onClose={() => setCompanyMenuId(null)}
        actions={[
          {
            label: "Abrir empresa (histórico)",
            onClick: () => {
              if (selectedCompany) router.push(`/company/${selectedCompany.id}`);
            },
          },
          {
            label: "Nova avaliação nesta empresa",
            onClick: () => {
              if (selectedCompany) router.push(`/new?companyId=${selectedCompany.id}`);
            },
          },
          {
            label: "Editar empresa",
            onClick: () => {
              if (selectedCompany) openEditCompany(selectedCompany);
            },
          },
          {
            label: "Excluir empresa (apaga avaliações e respostas)",
            tone: "danger",
            onClick: () => {
              if (selectedCompany) deleteCompany(selectedCompany.id);
            },
          },
        ]}
      />

      {/* ===================== ASSESSMENT ACTION SHEET ===================== */}
      <ActionSheet
        open={!!selectedAssessment}
        title={selectedAssessment ? `Avaliação: ${selectedAssessment.title}` : "Avaliação"}
        onClose={() => setAssessmentMenuId(null)}
        actions={[
          {
            label: "Abrir questionário",
            onClick: () => {
              if (selectedAssessment) router.push(`/assessment/${selectedAssessment.id}`);
            },
          },
          {
            label: "Editar avaliação",
            onClick: () => {
              if (selectedAssessment) openEditAssessment(selectedAssessment);
            },
          },
          {
            label: "Excluir avaliação (apaga respostas)",
            tone: "danger",
            onClick: () => {
              if (selectedAssessment) deleteAssessment(selectedAssessment.id);
            },
          },
        ]}
      />

      {/* ===================== EDIT COMPANY MODAL ===================== */}
      <Modal
        open={editCompanyOpen}
        title="Editar empresa"
        onClose={() => {
          if (!busy) setEditCompanyOpen(false);
        }}
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="edit-company-name" className="text-xs font-semibold text-slate-700">
              Nome da empresa
            </label>
            <input
              id="edit-company-name"
              value={editCompanyName}
              onChange={(e) => setEditCompanyName(e.target.value)}
              placeholder="Ex: Terracota Engenharia"
              aria-label="Nome da empresa"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:ring-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setEditCompanyOpen(false)}
              disabled={busy}
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              onClick={saveCompany}
              disabled={busy}
              className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ===================== EDIT ASSESSMENT MODAL ===================== */}
      <Modal
        open={editAssessmentOpen}
        title="Editar avaliação"
        onClose={() => {
          if (!busy) setEditAssessmentOpen(false);
        }}
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="edit-assessment-title" className="text-xs font-semibold text-slate-700">
              Título da avaliação
            </label>
            <input
              id="edit-assessment-title"
              value={editAssessmentTitle}
              onChange={(e) => setEditAssessmentTitle(e.target.value)}
              placeholder="Ex: Obra X - Fev/2026"
              aria-label="Título da avaliação"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:ring-2"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-assessment-context"
                className="text-xs font-semibold text-slate-700"
              >
                Unidade/Contexto
              </label>
              <input
                id="edit-assessment-context"
                value={editAssessmentContextUnit}
                onChange={(e) => setEditAssessmentContextUnit(e.target.value)}
                placeholder="Ex: Obra / Planta / Setor"
                aria-label="Unidade ou contexto"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:ring-2"
              />
            </div>

            <div>
              <label htmlFor="edit-assessment-date" className="text-xs font-semibold text-slate-700">
                Data
              </label>
              <input
                id="edit-assessment-date"
                type="date"
                value={editAssessmentAppliedAt}
                onChange={(e) => setEditAssessmentAppliedAt(e.target.value)}
                aria-label="Data da avaliação"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:ring-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setEditAssessmentOpen(false)}
              disabled={busy}
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              onClick={saveAssessment}
              disabled={busy}
              className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}