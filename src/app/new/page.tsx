import { Suspense } from "react";
import NewAssessmentClient from "./NewAssessmentClient";

export const dynamic = "force-dynamic";

export default function NewAssessmentPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-md px-4 py-6">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 text-sm text-slate-700">
              Carregando…
            </div>
          </div>
        </main>
      }
    >
      <NewAssessmentClient />
    </Suspense>
  );
}