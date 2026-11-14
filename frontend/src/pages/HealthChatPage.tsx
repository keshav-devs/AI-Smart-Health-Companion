import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { sendHealthQuestion } from "@/api/health_chat";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  emergency?: boolean;
}

export function HealthChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const chatMutation = useMutation({
    mutationFn: sendHealthQuestion,
    onSuccess: (result) => {
      setMessages((current) => [...current, {
        role: "assistant",
        text: `${result.answer}\n\n${result.disclaimer}`,
        emergency: result.emergency,
      }]);
      setError("");
    },
    onError: (reason: any) => setError(reason?.detail || "The assistant could not respond. Please try again."),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || chatMutation.isPending) return;
    setMessages((current) => [...current, { role: "user", text: message }]);
    setDraft("");
    setError("");
    chatMutation.mutate(message);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">AI Health Assistant</h1>
          <p className="mt-1 text-sm text-gray-500">Ask general health-information questions in plain language.</p>
          <p className="mt-1 text-xs text-gray-500">Your question is sent to Gemini to generate a response. This chat is not saved and does not include your health records.</p>
        </header>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Educational information only. The assistant cannot diagnose or recommend treatment or medication changes. For urgent symptoms, contact local emergency services.
        </div>

        <section aria-live="polite" className="min-h-[360px] space-y-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          {messages.length === 0 && (
            <div className="py-16 text-center text-sm text-gray-500">
              Ask about a health term, a common test, or how to prepare for a clinician visit.
            </div>
          )}
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                message.emergency
                  ? "border border-red-200 bg-red-50 text-red-900"
                  : message.role === "user"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-800"
              }`}>
                {message.text}
              </div>
            </div>
          ))}
          {chatMutation.isPending && <p className="text-sm text-gray-500">Preparing an educational response…</p>}
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </section>

        <form onSubmit={submit} className="flex items-end gap-3 rounded-2xl border border-gray-200 bg-white p-3">
          <label className="sr-only" htmlFor="health-question">Your question</label>
          <textarea
            id="health-question"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Ask a general health-information question…"
            className="min-h-12 flex-1 resize-y rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <Button type="submit" isLoading={chatMutation.isPending} disabled={!draft.trim() || chatMutation.isPending}>Ask</Button>
        </form>
      </div>
    </DashboardLayout>
  );
}
