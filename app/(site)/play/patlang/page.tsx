import { QuizGame } from "@/components/quiz-game";

export const metadata = {
  title: "Order Your Patlang",
  description: "Five questions. One coffee order. Find out which Patlang play is yours.",
};

export default function Page() {
  return <QuizGame slug="patlang" />;
}
