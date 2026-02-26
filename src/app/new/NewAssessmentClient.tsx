"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Company = {
  id: string;
  name: string;
};

function isoToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function NewAssessmentClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const companyIdFromUrl = searchParams.get("companyId");

  // modo: usar empresa existente OU criar nova
  const [mode, setMode] = useState<"existing" | "new">(
    companyIdFromUrl ? "existing" : "new"
  );

  // empresa existente
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // criar nova empresa
  const [companyName, setCompanyName] = useState("");

  // campos avaliação
  const [title, setTitle] = useState("");
  const [contextUnit, setContextUnit] = useState("Obra");
  const [appliedAt, setAppliedAt] = useState(isoToday);

  const [saving, setSaving] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveCompanyId = useMemo(() => {
    if (mode === "existing") return selectedCompany?.id ?? null;
    return null;
  }, [mode, selectedCompany]);

  // Carregar empresa quando vier companyId na URL
  useEffect(() => {
    async function loadCompany() {
      if (!companyIdFromUrl) return;

      setLoadingCompany(true);
      setError(null);

      const { data, error } = await supabase
        .from("companies")
        .select("id,name")
        .eq("id", companyIdFromUrl)
        .single();

      setLoadingCompany(false);

      if (error || !data) {
        setMode("new");
        setSelectedCompany(null);
        setError(error?.message ?? "Empresa não encontrada.");
        return;
      }

      setSelectedCompany({ id: data.id, name: data.name });
      setMode("existing");
    }

    loadCompany();
  }, [companyIdFromUrl]);

  async function handleCreate() {
    setError(null);

    // Validações
    if (!title.trim()) {
      setError("Informe o título da avaliação (ex: Obra X - Fev/2026).");
      return;
    }

    if (mode === "existing") {
      if (!effectiveCompanyId) {
        setError("Selecione uma empresa válida.");
        return;
      }
    } else {
      if (!companyName.trim()) {
        setError("Informe o nome da empresa.");
        return;
      }
    }

    setSaving(true);

    try {
      let companyIdToUse = effectiveCompanyId;

      // 1) se modo "new", cria empresa
      if (mode === "new") {
        const { data: company, error: cErr } = await supabase
          .from("companies")
          .insert({ name: companyName.trim() })
          .select("id")
          .single();

        if (cErr || !company) {
          throw new Error(cErr?.message ?? "Falha ao criar empresa.");
        }

        companyIdToUse = company.id;
      }

      if (!companyIdToUse) {
        throw new Error("Não foi possível determinar a empresa.");
      }

      // 2) cria avaliação
      const { data: assessment, error: aErr } = await supabase
        .from("assessments")
        .insert({
          company_id: companyIdToUse,
          title: title.trim(),
          context_unit: contextUnit.trim() || null,
          applied_at: appliedAt,
        })
        .select("id")
        .single();

      if (aErr || !assessment) {
        throw new Error(aErr?.message ?? "Falha ao criar avaliação.");
      }

      router.push(`/assessment/${assessment.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Erro inesperado.");
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  const headerSubtitle =
    mode === "existing"
      ? "Criar uma avaliação para uma empresa já cadastrada."
      : "Crie a empresa e a avaliação. Depois você preenche o questionário.";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-4 py-5">
        <header className="mb-4">
          <h1 className="text-xl font-semibold text-slate-900">Nova avaliação</h1>
          <p className="text-sm text-slate-600">{headerSubtitle}</p>

          {/* Toggle modo */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("existing")}
              disabled={loadingCompany}
              className={[
                "rounded-xl px-3 py-2 text-sm font-semibold ring-1 active:scale-[0.99] disabled:opacity-60",
                mode === "existing"
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-900 ring-slate-200",
              ].join(" ")}
              aria-pressed="true"
            >
              Empresa existente
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("new");
                setSelectedCompany(null);
              }}
              disabled={loadingCompany}
              className={[
                "rounded-xl px-3 py-2 text-sm font-semibold ring-1 active:scale-[0.99] disabled:opacity-60",
                mode === "new"
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-900 ring-slate-200",
              ].join(" ")}
              aria-pressed="true"
            >
              Nova empresa
            </button>
          </div>

          {/* Info empresa selecionada */}
          {mode === "existing" && (
            <div className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
              {loadingCompany ? (
                <div>Carregando empresa…</div>
              ) : selectedCompany ? (
                <div>
                  <div className="text-xs font-semibold text-slate-500">
                    Empresa selecionada
                  </div>
                  <div className="mt-0.5 font-semibold text-slate-900">
                    {selectedCompany.name}
                  </div>
                </div>
              ) : (
                <div className="text-slate-600">
                  Nenhuma empresa selecionada. Volte e abra pelo menu da empresa,
                  ou use “Nova empresa”.
                </div>
              )}
            </div>
          )}
        </header>

        {error && (
          <div className="mb-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          {/* Empresa (apenas no modo new) */}
          {mode === "new" && (
            <div>
              <label
                htmlFor="company-name"
                className="text-xs font-semibold text-slate-700"
              >
                Empresa
              </label>
              <input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Terracota Engenharia"
                aria-label="Nome da empresa"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none ring-slate-200 focus:ring-2"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="assessment-title"
              className="text-xs font-semibold text-slate-700"
            >
              Título da avaliação
            </label>
            <input
              id="assessment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Obra X - Fev/2026"
              aria-label="Título da avaliação"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none ring-slate-200 focus:ring-2"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="context-unit"
                className="text-xs font-semibold text-slate-700"
              >
                Unidade/Contexto
              </label>
              <select
                id="context-unit"
                value={contextUnit}
                onChange={(e) => setContextUnit(e.target.value)}
                aria-label="Unidade ou contexto"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none ring-slate-200 focus:ring-2"
              >
                <option>Obra</option>
                <option>Escritório</option>
                <option>Almoxarifado</option>
                <option>Outro</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="applied-at"
                className="text-xs font-semibold text-slate-700"
              >
                Data
              </label>
              <input
                id="applied-at"
                type="date"
                value={appliedAt}
                onChange={(e) => setAppliedAt(e.target.value)}
                aria-label="Data da avaliação"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none ring-slate-200 focus:ring-2"
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={saving || (mode === "existing" && !selectedCompany)}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60 active:scale-[0.99]"
          >
            {saving ? "Salvando..." : "Criar avaliação"}
          </button>

          <button
            onClick={() => router.push("/")}
            className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 active:scale-[0.99]"
          >
            Voltar
          </button>
        </div>
      </div>
    </main>
  );
}