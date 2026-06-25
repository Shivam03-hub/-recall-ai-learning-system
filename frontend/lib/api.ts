const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: "Something went wrong" }));
    throw new Error(errorBody.detail || "Request failed");
  }

  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/pdf")) {
    return res.blob();
  }
  return res.json();
}

export const api = {
  signup: (email: string, password: string) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),

  login: (email: string, password: string) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  listTopics: () => request("/topics/"),

  createMeeting: (source: string, language: string, isPodcast: boolean) =>
    request("/meetings", { method: "POST", body: JSON.stringify({ source, language, is_podcast: isPodcast }) }),

  getMeeting: (id: string) => request(`/meetings/${id}`),

  confirmTopic: (meetingId: string, topicId?: string, newTopicName?: string) =>
    request(`/meetings/${meetingId}/confirm-topic`, {
      method: "POST",
      body: JSON.stringify({ meeting_id: meetingId, topic_id: topicId, new_topic_name: newTopicName }),
    }),

  askTopic: (topicId: string, question: string) =>
    request(`/topics/${topicId}/ask`, { method: "POST", body: JSON.stringify({ question }) }),

  getChatHistory: (topicId: string) => request(`/topics/${topicId}/chat-history`),

  generatePdf: (topicId: string, instruction: string) =>
    request(`/topics/${topicId}/generate-pdf`, { method: "POST", body: JSON.stringify({ instruction }) }),

  exportMeetingPdf: (meetingId: string) => request(`/meetings/${meetingId}/export-pdf`),

  

  submitQuiz: (topicId: string, quizId: string, answers: { question_id: string; answer: string }[]) =>
    request(`/topics/${topicId}/quiz/${quizId}/submit`, { method: "POST", body: JSON.stringify({ answers }) }),

  getFlashcards: (topicId: string, quizId: string) => request(`/topics/${topicId}/flashcards/${quizId}`),
  getPdfHistory: (topicId: string) => request(`/topics/${topicId}/pdf-history`),

  downloadPastPdf: (topicId: string, pdfId: string) =>
    request(`/topics/${topicId}/pdf-history/${pdfId}/download`),

  listQuizzes: (topicId: string) => request(`/topics/${topicId}/quizzes`),

  renameTopic: (topicId: string, name: string) =>
    request(`/topics/${topicId}/rename`, { method: "PATCH", body: JSON.stringify({ name }) }),

  deleteTopic: (topicId: string) =>
    request(`/topics/${topicId}`, { method: "DELETE" }),

  getKnowledgeFlags: (topicId: string) => request(`/topics/${topicId}/knowledge-flags`),

  listTopicMeetings: (topicId: string) => request(`/topics/${topicId}/meetings`),

  createQuiz: (topicId: string, numQuestions: number, difficulty: string, customInstruction: string = "") =>
    request(`/topics/${topicId}/quiz`, { method: "POST", body: JSON.stringify({ num_questions: numQuestions, difficulty, custom_instruction: customInstruction }) }),
};

