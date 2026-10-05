import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WorkoutScreen from "@/components/workout/WorkoutScreen";
import { exerciseName, exerciseTagline } from "@/lib/i18n/exercise";
import { getT } from "@/lib/i18n/server";
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
  const t = await getT("workout");
  if (!isExerciseKind(exercise)) return { title: t("metaNotFound") };
  const tx = await getT("exercises");
  const name = exerciseName(tx, exercise);
  return {
    title: name,
    description: t("metaDescription", { name, tagline: exerciseTagline(tx, exercise) }),
  };
}

export default async function WorkoutPage(props: PageProps<"/workout/[exercise]">) {
  const { exercise } = await props.params;
  if (!isExerciseKind(exercise)) notFound();
  return <WorkoutScreen exercise={exercise} />;
}
