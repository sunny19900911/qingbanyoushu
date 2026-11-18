import type { ExerciseItem } from "../../shared/types";

const terms: Record<string, string> = {
  "屈髋": "屁股往后坐，像用屁股去关身后的门",
  "髋铰链": "屁股往后移，主要从大腿根处折叠身体",
  "躯干": "从肩膀到腰这一段身体",
  "中立": "自然的位置，不刻意弓起或塌下去",
  "核心": "肚子和腰周围负责稳住身体的肌肉",
  "肩胛骨": "后背上左右两块会跟着肩膀移动的骨头",
  "离心": "控制着慢慢放回去的阶段",
};
export function exerciseExplanation(exercise: ExerciseItem): string {
  const definitions = Object.entries(terms)
    .filter(([term]) => `${exercise.steps.join("")} ${exercise.cue}`.includes(term))
    .slice(0, 2).map(([term, definition]) => `“${term}”就是${definition}。`).join("");
  const setup = /徒手|自重|无器械/.test(exercise.equipment) ? "先找一个能站稳、能活动开的地方" : "先用能稳稳控制的重量";
  return `这个动作主要练${exercise.muscle}。先记住：${exercise.cue} ${definitions}${setup}，按下面的步骤做；不舒服就停下来问教练。`;
}
export function exerciseNarration(exercise: ExerciseItem): string {
  return `${exercise.name}。大白话讲解：${exerciseExplanation(exercise)}。${exercise.steps.map((s, i) => `第${i + 1}步，${s}`).join("。 ")}。注意：${exercise.caution}`;
}
