export const leanEducation = {
  general: {
    title: "Entendendo o Método Lean de Maturidade",
    description:
      "Visão geral do método, da escala de maturidade e da interpretação dos resultados obtidos no diagnóstico.",
    youtubeUrl: "https://youtu.be/lF_ulEudOv4",
  },

  classes: {
    risk: {
      label: "Empresas em risco",
      description:
        "Orientações para empresas que apresentam baixa maturidade Lean e precisam estruturar processos básicos.",
      youtubeUrl: "https://youtu.be/XYd02vOXXhw",
    },

    average: {
      label: "Empresas médias",
      description:
        "Orientações para empresas que já possuem algumas práticas Lean, mas ainda precisam evoluir em consistência e padronização.",
      youtubeUrl: "https://youtu.be/VfY07ctsYAY",
    },

    aboveAverage: {
      label: "Empresas acima da média",
      description:
        "Orientações para empresas com bom nível de maturidade Lean e que precisam consolidar e expandir suas práticas.",
      youtubeUrl: "https://youtu.be/I_qATY5tDjA",
    },

    highlights: {
      label: "Empresas destaques",
      description:
        "Orientações para empresas com alto nível de maturidade Lean, focadas em excelência operacional e melhoria contínua.",
      youtubeUrl: "https://youtu.be/M8YHJ5QE-xg",
    },
  },
} as const;

export type LeanEducationClassKey =
  | "risk"
  | "average"
  | "aboveAverage"
  | "highlights";

export function getEducationKeyByClassification(
  label: string
): LeanEducationClassKey {
  const key = label.toLowerCase();

  if (key.includes("risco")) return "risk";
  if (key.includes("médias")) return "average";
  if (key.includes("acima da média")) return "aboveAverage";
  if (key.includes("destaques")) return "highlights";

  return "risk";
}