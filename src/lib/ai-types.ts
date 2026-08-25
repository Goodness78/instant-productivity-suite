export type EmailResult = {
  subjects: string[];
  body: string;
};

export type SummaryResult = {
  title: string;
  overview: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: { task: string; owner: string; deadline: string }[];
  topics: string[];
  openQuestions: string[];
};

export type PlannedTask = {
  title: string;
  notes: string;
  priority: "high" | "medium" | "low";
  estimatedMinutes: number;
  dueDate: string;
  steps: string[];
};
