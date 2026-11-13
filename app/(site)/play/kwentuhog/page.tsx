import { QuizGame } from "@/components/quiz-game";

export const metadata = {
  title: "Which Stage of Sleep Are You?",
  description: "Reality, Dream, Nightmare or Awakening. Find your stage. Kwentuhog: A Bedtime Story.",
};

export default function Page() {
  return <QuizGame slug="kwentuhog" />;
}
