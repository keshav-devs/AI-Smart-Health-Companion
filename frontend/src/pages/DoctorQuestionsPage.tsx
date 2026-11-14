import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  doctorQuestionsApi,
  type DoctorQuestionResponse,
  type DoctorQuestionCreate,
  type DoctorQuestionUpdate,
} from "@/api/doctor_questions";
import { useProfile } from "@/hooks/useProfile";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";

export function DoctorQuestionsPage() {
  const queryClient = useQueryClient();
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<DoctorQuestionResponse | null>(null);

  const [questionText, setQuestionText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [isAsked, setIsAsked] = useState(false);
  const [formError, setFormError] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionError, setSuggestionError] = useState("");

  const { data: questions, isLoading } = useQuery({
    queryKey: ["doctor_questions", profileId],
    queryFn: () => (profileId ? doctorQuestionsApi.getQuestions(profileId) : []),
    enabled: !!profileId,
  });

  const createMutation = useMutation({
    mutationFn: (data: DoctorQuestionCreate) => doctorQuestionsApi.createQuestion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor_questions", profileId] });
      closeModal();
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || "Failed to create question.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DoctorQuestionUpdate }) =>
      doctorQuestionsApi.updateQuestion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor_questions", profileId] });
      closeModal();
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || "Failed to update question.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => doctorQuestionsApi.deleteQuestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor_questions", profileId] });
    },
  });

  const suggestionsMutation = useMutation({
    mutationFn: () => {
      if (!profileId) throw new Error("Select a profile first.");
      return doctorQuestionsApi.generateSuggestions(profileId);
    },
    onSuccess: (result) => {
      setSuggestions(result.suggestions);
      setSuggestionError("");
    },
    onError: (err: any) => setSuggestionError(err?.detail || "Could not generate suggestions. Please try again."),
  });

  const addSuggestionMutation = useMutation({
    mutationFn: (question: string) => {
      if (!profileId) throw new Error("Select a profile first.");
      return doctorQuestionsApi.createQuestion({ profile_id: profileId, question });
    },
    onSuccess: (_saved, question) => {
      queryClient.invalidateQueries({ queryKey: ["doctor_questions", profileId] });
      setSuggestions((current) => current.filter((item) => item !== question));
    },
    onError: (err: any) => setSuggestionError(err?.detail || "Could not save this question."),
  });

  const openAddModal = () => {
    setEditingQuestion(null);
    setQuestionText("");
    setAnswerText("");
    setIsAsked(false);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (q: DoctorQuestionResponse) => {
    setEditingQuestion(q);
    setQuestionText(q.question);
    setAnswerText(q.answer || "");
    setIsAsked(!!q.is_asked);
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingQuestion(null);
    setQuestionText("");
    setAnswerText("");
    setIsAsked(false);
    setFormError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      setFormError("Question is required.");
      return;
    }
    if (questionText.length > 500) {
      setFormError("Question cannot exceed 500 characters.");
      return;
    }

    if (editingQuestion) {
      updateMutation.mutate({
        id: editingQuestion.id,
        data: {
          question: questionText.trim(),
          answer: answerText.trim() || undefined,
          is_asked: isAsked,
        },
      });
    } else {
      if (!profileId) {
        setFormError("No active profile selected.");
        return;
      }
      createMutation.mutate({
        profile_id: profileId,
        question: questionText.trim(),
        answer: answerText.trim() || undefined,
        is_asked: isAsked,
      });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this question?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctor Prep Questions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Keep track of questions you want to ask at your next appointment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => suggestionsMutation.mutate()} isLoading={suggestionsMutation.isPending} disabled={!profileId} className="flex items-center gap-2">
          Suggest with AI
        </Button>
        <Button onClick={openAddModal} className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Question
        </Button>
        </div>
      </div>

      {suggestionError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{suggestionError}</div>}
      {suggestions.length > 0 && (
        <section className="mb-6 rounded-2xl border border-primary-100 bg-primary-50/40 p-4 sm:p-5" aria-label="AI generated doctor question suggestions">
          <h2 className="font-semibold text-gray-900">Suggestions to review</h2>
          <p className="mt-1 text-xs text-gray-600">When you request suggestions, this profile&apos;s confirmed lab values and active medicine names are sent to Gemini. Review and edit every suggestion before saving it.</p>
          <ul className="mt-3 space-y-3">
            {suggestions.map((suggestion, index) => (
              <li key={`suggestion-${index}`} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <textarea
                  value={suggestion}
                  maxLength={500}
                  rows={2}
                  aria-label={`Edit suggested question ${index + 1}`}
                  onChange={(event) => setSuggestions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                  className="min-w-0 flex-1 resize-y rounded-lg border border-gray-300 p-2 text-sm text-gray-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
                <Button size="sm" variant="secondary" onClick={() => addSuggestionMutation.mutate(suggestion.trim())} disabled={addSuggestionMutation.isPending || !suggestion.trim()}>Save question</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {questions && questions.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {questions.map((q) => (
                <li key={q.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-base">{q.question}</div>
                    {q.answer && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-100">
                        <strong className="text-gray-900">Answer: </strong> {q.answer}
                      </div>
                    )}
                    <div className="mt-2.5 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          q.is_asked
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {q.is_asked ? "Asked" : "Not Asked"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-start">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditModal(q)}
                      className="text-xs"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(q.id)}
                      className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-base font-medium text-gray-900">No questions found</p>
              <p className="text-xs text-gray-500 mt-1">Get ready for your next doctor visit by adding a question.</p>
              <Button onClick={openAddModal} size="sm" className="mt-4">
                Add Question
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Question Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {editingQuestion ? "Edit Question" : "Add Question for Doctor"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Question *
                </label>
                <textarea
                  required
                  maxLength={500}
                  rows={4}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="What would you like to ask your doctor?"
                  className="w-full text-xs rounded-xl border border-gray-300 p-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
                <div className="text-right text-[10px] text-gray-400 mt-1">
                  {questionText.length}/500 chars
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Answer (Optional)
                </label>
                <textarea
                  rows={3}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Doctor's response or notes..."
                  className="w-full text-xs rounded-xl border border-gray-300 p-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_asked"
                  checked={isAsked}
                  onChange={(e) => setIsAsked(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="is_asked" className="text-xs text-gray-700 font-medium">
                  Already asked doctor
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-gray-100">
                <Button type="button" variant="ghost" size="sm" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                >
                  {editingQuestion ? "Save Changes" : "Create Question"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
