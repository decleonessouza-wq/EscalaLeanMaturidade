"use client";

import { useRouter } from "next/navigation";
import { leanEducation } from "@/lib/leanEducation";

function openVideo(url: string) {
  if (!url) {
    alert("O link deste vídeo ainda não foi preenchido.");
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function PlayIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8.5 6.5v11l9-5.5-9-5.5Z" />
    </svg>
  );
}

export default function EducationPage() {
  const router = useRouter();

  const classVideos = [
    {
      key: "risk",
      color: "border-red-200 bg-red-50",
      soft: "bg-red-100 text-red-700 ring-red-200",
      button: "bg-red-600 hover:bg-red-700 text-white",
      titleColor: "text-red-700",
      badge: "Empresas em risco",
      executiveText:
        "Conteúdo direcionado para organizações com baixa maturidade Lean, priorizando estruturação, padronização e eliminação de falhas básicas.",
      data: leanEducation.classes.risk,
    },
    {
      key: "average",
      color: "border-amber-200 bg-amber-50",
      soft: "bg-amber-100 text-amber-700 ring-amber-200",
      button: "bg-amber-500 hover:bg-amber-600 text-white",
      titleColor: "text-amber-700",
      badge: "Empresas médias",
      executiveText:
        "Conteúdo voltado para empresas em estágio intermediário, com foco em consistência operacional, disciplina de processo e evolução estruturada.",
      data: leanEducation.classes.average,
    },
    {
      key: "aboveAverage",
      color: "border-sky-200 bg-sky-50",
      soft: "bg-sky-100 text-sky-700 ring-sky-200",
      button: "bg-sky-600 hover:bg-sky-700 text-white",
      titleColor: "text-sky-700",
      badge: "Acima da média",
      executiveText:
        "Conteúdo indicado para empresas com boa base Lean, orientado à consolidação da cultura, ampliação de práticas e ganho de escala operacional.",
      data: leanEducation.classes.aboveAverage,
    },
    {
      key: "highlights",
      color: "border-emerald-200 bg-emerald-50",
      soft: "bg-emerald-100 text-emerald-700 ring-emerald-200",
      button: "bg-emerald-600 hover:bg-emerald-700 text-white",
      titleColor: "text-emerald-700",
      badge: "Empresas destaques",
      executiveText:
        "Conteúdo para organizações com alta maturidade Lean, voltado à excelência, sustentação de resultados e avanço contínuo da performance.",
      data: leanEducation.classes.highlights,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Central educacional
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Educação Lean de Maturidade
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
                Área educacional do aplicativo criada para apoiar a interpretação dos
                resultados, ampliar o entendimento do método Lean de maturidade e orientar
                decisões com base no diagnóstico realizado.
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
              <button
                onClick={() => router.push("/")}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]"
              >
                Ir para início
              </button>

              <button
                onClick={() => router.back()}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]"
              >
                Voltar
              </button>
            </div>
          </div>
        </section>

        {/* Vídeo geral */}
        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
                  Vídeo geral
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  Visão executiva do método
                </span>
              </div>

              <div className="mt-3 text-lg font-bold tracking-tight text-slate-900">
                {leanEducation.general.title}
              </div>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                {leanEducation.general.description}
              </p>

              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Recomendação: assista primeiro a este conteúdo para entender a lógica da
                avaliação, a escala de leitura e a estrutura da classificação antes de
                avançar para os vídeos específicos.
              </p>
            </div>

            <div className="shrink-0">
              <button
                onClick={() => openVideo(leanEducation.general.youtubeUrl)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] sm:w-auto"
              >
                <PlayIcon className="h-5 w-5" />
                Assistir vídeo geral
              </button>
            </div>
          </div>
        </section>

        {/* Trilhas por classificação */}
        <section className="mt-4">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Trilhas por classificação
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Conteúdos organizados conforme a faixa de classificação da empresa, permitindo
              uma leitura mais clara do resultado e das prioridades de evolução.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {classVideos.map((item) => (
              <article
                key={item.key}
                className={[
                  "rounded-3xl border p-5 shadow-sm transition hover:shadow-md",
                  item.color,
                ].join(" ")}
              >
                <div className="flex h-full flex-col justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1",
                          item.soft,
                        ].join(" ")}
                      >
                        {item.badge}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                        <PlayIcon className="h-4 w-4" />
                        Conteúdo em vídeo
                      </span>
                    </div>

                    <div
                      className={[
                        "mt-3 text-lg font-bold tracking-tight",
                        item.titleColor,
                      ].join(" ")}
                    >
                      {item.data.label}
                    </div>

                    <p className="mt-3 text-sm font-medium leading-relaxed text-slate-800">
                      {item.executiveText}
                    </p>

                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {item.data.description}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => openVideo(item.data.youtubeUrl)}
                      className={[
                        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm transition active:scale-[0.99]",
                        item.button,
                      ].join(" ")}
                    >
                      <PlayIcon className="h-5 w-5" />
                      Assistir orientação
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Orientação de uso */}
        <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">
            Como usar esta área
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Passo 1
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Assista ao vídeo geral para compreender a estrutura do método, a lógica da
                escala e a interpretação base do diagnóstico.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Passo 2
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Acesse o vídeo da classificação correspondente ao resultado da empresa para
                aprofundar a leitura prática do cenário encontrado.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Passo 3
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Utilize o conteúdo junto com a tela de resultados e o relatório detalhado
                para orientar prioridades, ações corretivas e melhoria contínua.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-8 pb-4 text-center text-xs text-slate-500">
          Escala Lean de Maturidade • Central Educacional • by Decleones Andrade
        </footer>
      </div>
    </main>
  );
}