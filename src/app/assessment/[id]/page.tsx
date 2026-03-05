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

/** Normaliza texto para bater chaves com segurança (acentos, símbolos, caixa, espaços) */
function normKey(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[_–—-]+/g, " ") // hífens e similares -> espaço
    .replace(/[^\w\s.]/g, "") // remove símbolos (mantém ponto p/ "4.0")
    .replace(/\s+/g, " "); // espaços múltiplos
}

/**
 * ✅ Suas explicações (reais, claras e diretas).
 * Chave = conceito normalizado (q.concept).
 *
 * IMPORTANTE:
 * - Se o seu banco tiver concept diferente (ex: "One piece flow" em vez de "One-piece-flow"),
 *   a normalização resolve a maioria dos casos.
 * - Se algum não bater, ele cai no fallback.
 */
const EXPLAIN_BY_CONCEPT: Record<string, string> = {
  [normKey("One-piece-flow")]:
    "Aqui você está perguntando se o trabalho “anda” de um processo para o outro sem virar montes e montes de peças paradas no meio. É como uma “fila organizada”: termina aqui e já vai para o próximo, sem acumular estoque entre etapas.",

  [normKey("5S")]:
    "Aqui você quer saber se o local de trabalho tem ordem e padrão: ferramentas no lugar certo, áreas identificadas, limpeza, tudo fácil de achar. Se as pessoas perdem tempo procurando coisa, ou se é “cada um guarda onde quer”.",

  [normKey("PDCA")]:
    "Você está perguntando se quando dá problema a empresa corrige a causa (não só o “remendo”). Ou seja: identifica o que deu errado, planeja a correção, aplica, confere se resolveu e padroniza para não repetir.",

  [normKey("Padronização + Gestão Visual")]:
    "Aqui você quer saber se as melhorias viram regra do jogo (padrão escrito/visual) e se a informação é transparente: procedimento atualizado, quadro/indicadores visíveis, todo mundo sabe como está o resultado e o que mudou.",

  [normKey("TPM")]:
    "Você está perguntando se a empresa cuida das máquinas antes de quebrar. Se existe rotina de inspeção/manutenção preventiva para evitar falhas, paradas e defeitos por desgaste.",

  [normKey("Produção nivelada")]:
    "Aqui você quer saber se eles produzem de acordo com o que o cliente pede/consome, e não por “achismo” ou para encher estoque. Lote é decidido pelo mercado, não pela vontade interna.",

  [normKey("Produção puxada")]:
    "Você está perguntando se a produção acontece porque alguém realmente precisa (cliente ou próxima etapa consumiu), e não porque “tem que deixar a máquina rodando”. É produzir sob sinal de consumo/pedido.",

  [normKey("JIT")]:
    "Aqui você está perguntando se o abastecimento funciona “redondo”: material e peça chegam na hora certa, sem faltar (parar a produção) e sem sobrar (entupir o chão/estoque).",

  [normKey("Takt-time")]:
    "Você quer saber se o trabalho é distribuído de forma justa e eficiente: se não existe uma etapa sempre “engarrafando” e outra sempre sobrando. É sobre equilíbrio do ritmo para evitar gargalo e correria.",

  [normKey("VSM")]:
    "Aqui você pergunta se a empresa desenhou o caminho completo (do pedido até a entrega) e usa esse mapa para achar desperdícios, demoras, retrabalho e gargalos — e se isso vira melhoria prática.",

  [normKey("Autonomia")]:
    "Você quer saber se quem está “na linha” tem voz: se o trabalhador é estimulado a apontar problema e sugerir melhoria, ou se ele só executa e fica calado.",

  [normKey("Motivação")]:
    "Aqui é simples: quando alguém dá uma boa ideia, a empresa valoriza e reconhece, ou ignora? Reconhecimento pode ser elogio formal, bônus, pontos, destaque, oportunidade — o importante é não deixar a pessoa “no vácuo”.",

  [normKey("Trabalho em equipe")]:
    "Você está perguntando se existem reuniões que realmente servem para olhar indicadores, entender problemas e decidir ações, e não só reunião “pra conversar”. É rotina de acompanhamento.",

  [normKey("Kaizen com parceiros")]:
    "Aqui você pergunta se a empresa melhora só “dentro de casa” ou se ela envolve quem está fora: fornecedor e revendedor. Se existe treinamento/padrão/projeto conjunto para melhorar a cadeia inteira, não só a fábrica.",

  [normKey("Liderança")]:
    "Você quer saber se a liderança “banca” Lean de verdade: define rumo, prioriza, dá recursos/tempo, remove barreiras. Não é só mandar; é sustentar a mudança.",

  [normKey("Transparência")]:
    "Aqui você pergunta se a operação é guiada por dados “na hora”: sistemas, painéis, registros digitais, atualização rápida. Ou se tudo depende de papel, conversa, planilha solta e demora para saber o que está acontecendo.",

  [normKey("Modularização")]:
    "Você quer saber se eles param de “inventar um processo do zero” toda vez. Se a empresa tem modelos prontos (templates/módulos) que reaproveita quando o trabalho é parecido, para ganhar velocidade e padrão.",

  [normKey("Flexibilidade")]:
    "Aqui você pergunta se a empresa consegue perceber “sobrou tempo/capacidade aqui” e redireciona trabalho automaticamente (ou com regra clara), usando medição real (sensor/dado) e não “achismo”.",

  [normKey("Manutenção por dados")]:
    "Você quer saber se a manutenção é planejada com base em histórico e sinais (tempo de uso, vibração, falhas, desempenho), para evitar quebra. É manutenção orientada por dados, não só por calendário “fixo” ou urgência.",

  [normKey("Rastreabilidade")]:
    "Aqui você pergunta se, quando dá defeito, a empresa consegue rastrear de onde veio (lote, máquina, turno, operador, matéria-prima) e corrige a causa principal — não só joga fora e segue.",

  [normKey("Machine Learning")]:
    "Você quer saber se existe “inteligência” no sistema: usando dados históricos para o algoritmo recomendar ou ajustar produção/estoque/sequência/manutenção, aprendendo com o tempo (não só relatório bonito).",

  [normKey("Big Data / Analytics")]:
    "Aqui você pergunta se, quando algo dá errado (máquina parou, material atrasou), o sistema consegue replanejar e achar alternativas para não travar tudo — com base em dados e análise, não só “correria”.",

  [normKey("Automação logística interna")]:
    "Você quer saber se o transporte interno é automatizado (AGV, robô, esteira inteligente), levando material até o ponto certo com menos esforço humano, mais controle e menos erro/atraso.",

  [normKey("Integração vertical")]:
    "Você pergunta se o produto “continua vivo” depois de vendido: se ele é conectado e gera dados, permitindo serviços como monitoramento, manutenção preventiva, assinatura, suporte avançado — criando novos modelos de receita.",

  [normKey("Integração horizontal")]:
    "Aqui você quer saber se fornecedor e fábrica estão conectados: quando baixa estoque ou aumenta consumo, o sistema já dispara reposição automaticamente (ou quase), reduzindo falta de material, urgência e compras “no desespero”.",
};

/**
 * Monta as linhas do card (explicação + instrução de resposta).
 * - Puxa explicação pelo q.concept (normalizado)
 * - Se não achar, cai num fallback curto (não quebra)
 */
function buildHelpLines(q: Question, dimName?: string) {
  const dim = (dimName || "").trim();
  const conceptRaw = (q.concept || "").trim();
  const conceptKey = normKey(conceptRaw);

  const explanation = EXPLAIN_BY_CONCEPT[conceptKey] || null;

  const lines: string[] = [];

  if (dim) lines.push(`Dimensão: ${dim}.`);
  if (conceptRaw) lines.push(`O que está sendo avaliado: ${conceptRaw}.`);

  if (explanation) {
    lines.push(explanation);
  } else {
    // fallback seguro (caso o concept do banco esteja diferente)
    lines.push(
      "Explicação: avalie se esta prática acontece de forma real no dia a dia (com evidências e rotina), e não apenas “no papel”."
    );
  }

  lines.push(
    "Como responder (1–5): escolha o número que melhor representa a realidade atual, com base em evidências/rotina do dia a dia."
  );
  lines.push(
    "1 = inexistente/raramente ocorre • 3 = ocorre parcialmente • 5 = ocorre de forma consistente e padronizada."
  );
  lines.push("Dica: se houver variação por setor/equipe, responda pela média ou pelo cenário mais frequente.");

  return lines;
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

  // ✅ Card suspenso (tooltip/click) por pergunta
  const [openHelpQid, setOpenHelpQid] = useState<number | null>(null);

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

  const dimNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of dimensions) m.set(d.id, d.name);
    return m;
  }, [dimensions]);

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
              .map((q) => {
                const helpLines = buildHelpLines(q, dimNameById.get(q.dimension_id));
                const isOpen = openHelpQid === q.id;

                return (
                  <div key={q.id} className="mb-3 rounded-2xl border bg-white p-4 shadow-sm">
                    {/* topo da pergunta + botão de ajuda */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm leading-snug text-slate-900">{q.text}</div>
                        <div className="mt-1 text-xs text-slate-500">{q.concept}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setOpenHelpQid((prev) => (prev === q.id ? null : q.id))}
                        className={[
                          "shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold",
                          "bg-white text-slate-900 border-slate-200 hover:bg-slate-50 active:scale-[0.99]",
                        ].join(" ")}
                        aria-label="Explicação da pergunta"
                        title="Explicação"
                      >
                        ?
                      </button>
                    </div>

                    {/* ✅ Card suspenso (abre ao clicar no ?). Mobile-friendly */}
                    {isOpen && (
                      <div className="mt-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-xs font-semibold text-slate-700">Explicação</div>

                          <button
                            type="button"
                            onClick={() => setOpenHelpQid(null)}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 active:scale-[0.99]"
                          >
                            Fechar
                          </button>
                        </div>

                        <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-700">
                          {helpLines.map((t, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="mt-[2px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                              <span>{t}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* respostas 1..5 */}
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
                );
              })}
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