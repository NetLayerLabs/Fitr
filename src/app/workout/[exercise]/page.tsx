import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WorkoutScreen from "@/components/workout/WorkoutScreen";
import { EXERCISES } from "@/lib/exercises";
import { EXERCISE_KINDS, isExerciseKind } from "@/lib/pose/types";

/*
 * Every known exercise is prerendered; anything else hits isExerciseKind() + notFound()
 * below. `dynamicParams = false` would 404 those too, but Next 16 then logs an
 * "Error: Internal: NoFallbackError" to the server log on every such request, which reads like
 * a real failure in production logs.
 */
export function generateStaticParams(): Array<{ exercise: string }> {
  return EXERCISE_KINDS.map((exercise) => ({ exercise }));
}

export async function generateMetadata(props: PageProps<"/workout/[exercise]">): Promise<Metadata> {
  const { exercise } = await props.params;
  if (!isExerciseKind(exercise)) return { title: "Workout not found" };
  const info = EXERCISES[exercise];
  return {
    title: info.name,
    description: `${info.name} with live on-device rep verification. ${info.tagline}.`,
  };
}

export default async function WorkoutPage(props: PageProps<"/workout/[exercise]">) {
  const { exercise } = await props.params;
  if (!isExerciseKind(exercise)) notFound();
  return <WorkoutScreen exercise={exercise} />;
}
