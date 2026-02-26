"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CompanyRow = {
  id: string;
  name: string;
  created_at: string;
  assessments?: { count: number }[] | null; // relacionamento + count
};

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
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

export default function CompanyListPage() {
  const router = useRouter();

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");

  const [menuId, setMenuId] = useState<string | null>(null);
  const selected = useMemo(
    () => companies.find((c) => c.id === menuId) ?? null,
    [companies, menuId]
  );

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");

  async function load() {
    setLoading(true);
    setError(null);

    const res = await supabase
      .from("companies")
      .select("id,name,created_at,assessments(count)")
      .order("created_at", { ascending: false });

    if (res.error) setError(res.error.message);
    setCompanies((res.data as CompanyRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name?.toLowerCase().includes(q));
  }, [companies, query]);

  function openEdit(c: CompanyRow) {
    setEditName(c.name ?? "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!selected) return;
    const name = editName.trim();
    if (!name) {
      alert("Informe o nome da empresa.");
      return;
    }

    setBusy(true);
    setError(null);

    const { error } = await supabase
      .from("companies")
      .update({ name })
      .eq("id", selected.id);

    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    setEditOpen(false);
    setMenuId(null);
    await load();
  }

  async function deleteCompany(companyId: string) {
    const ok = confirm(
      "Excluir esta empresa?\n\nCom ON DELETE CASCADE, isso apagará também avaliações e respostas vinculadas."
    );
    if (!ok) return;

    setMenuId(null);
    setBusy(true);
    setError(null);

    const { error } = await supabase.from("companies").delete().eq("id", companyId);

    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    await load();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-4 py-5">
        <header className="mb-4">
          <h1 className="text-xl font-semibold text-slate-900">Empresas</h1>
          <p className="text-sm text-slate-600">
            Lista geral de empresas cadastradas e ações rápidas.
          </p>
        </header>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => router.push("/new")}
            className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
          >
            + Nova avaliação
          </button>

          <button
            type="button"
            onClick={load}
            disabled={loading || busy}
            className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? "Aguarde..." : "Atualizar"}
          </button>
        </div>

        <div className="mb-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <label htmlFor="company-search" className="text-xs font-semibold text-slate-700">
            Buscar empresa
          </label>
          <input
            id="company-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite parte do nome…"
            aria-label="Buscar empresa"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none ring-slate-200 focus:ring-2"
          />
        </div>

        {loading && (
          <div className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            Carregando…
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
            Erro: {error}
          </div>
        )}

        <section className="space-y-2">
          {filtered.length === 0 && !loading ? (
            <div className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
              Nenhuma empresa encontrada.
            </div>
          ) : (
            filtered.map((c) => {
              const count = c.assessments?.[0]?.count ?? 0;
              return (
                <div
                  key={c.id}
                  className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {c.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Criada em {formatDateTime(c.created_at)} • {count} avaliação(ões)
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/new?companyId=${c.id}`}
                          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm active:scale-[0.99]"
                        >
                          + Avaliação nesta empresa
                        </Link>

                        <button
                          type="button"
                          onClick={() => router.push(`/company/${c.id}`)}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 ring-1 ring-slate-200 active:scale-[0.99]"
                        >
                          Abrir empresa →
                        </button>

                        <button
                          type="button"
                          onClick={() => router.push("/")}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 ring-1 ring-slate-200 active:scale-[0.99]"
                        >
                          Voltar Home
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMenuId(c.id)}
                      className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-100 active:scale-[0.99]"
                      aria-label="Ações da empresa"
                      title="Ações"
                    >
                      ⋯
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <footer className="mt-8 pb-6 text-center text-xs text-slate-500">
          Escala Lean Maturity • Empresas • v0.1
        </footer>
      </div>

      <ActionSheet
        open={!!selected}
        title={selected ? `Empresa: ${selected.name}` : "Empresa"}
        onClose={() => setMenuId(null)}
        actions={[
          {
            label: "Abrir empresa (histórico)",
            onClick: () => {
              if (selected) router.push(`/company/${selected.id}`);
            },
          },
          {
            label: "Criar avaliação nesta empresa",
            onClick: () => {
              if (selected) router.push(`/new?companyId=${selected.id}`);
            },
          },
          {
            label: "Editar empresa",
            onClick: () => {
              if (selected) openEdit(selected);
            },
          },
          {
            label: "Excluir empresa (cascade)",
            tone: "danger",
            onClick: () => {
              if (selected) deleteCompany(selected.id);
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
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none ring-slate-200 focus:ring-2"
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
              onClick={saveEdit}
              disabled={busy}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}