/**
 * Topic Agent — 根据画像弱项生成针对性题目
 *
 * 输入：focus + weakness_tags + 训练参数
 * 输出：题目数组 JSON
 */

import { focusToGoal } from "./profile.js";

export async function generateTopics(input, { callAI, count = 3 }) {
  const topics = await Promise.all(
    Array.from({ length: count }).map(async (_, index) => {
      const topicInput = { ...input, seedOffset: index };
      const aiTopic = callAI
        ? await callAI(topicInput).catch((e) => {
            console.error("[Topic Agent] AI generation failed:", e?.message || e);
            return null;
          })
        : null;
      return aiTopic || generateFallback(topicInput);
    })
  );
  return topics;
}

export function generateFallback(input) {
  const mode = input.mode_type || "logic";
  const duration = input.duration_type || "1min";
  const pools = {
    logic: [
      "你认为一个团队效率低下的最核心原因是什么？",
      "为什么有些人很努力却成长缓慢？",
      "你如何判断一个方案是可执行而不是空想？",
    ],
    improv: [
      "如果你临时要在会议上汇报项目风险，你会怎么开场？",
      "今天让你接手一个延期项目，你第一步会做什么？",
      "面对领导突然提问，你如何在30秒内组织回答？",
    ],
    scenario: [
      "领导临时让你周末加班，但你已有安排，你会如何回应？",
      "同事频繁把任务推给你，你如何拒绝且不伤关系？",
      "你需要向上级争取资源，如何更有说服力地表达请求？",
    ],
  };

  const indexSeed = Math.floor(Math.random() * 1000) + Number(input.seedOffset || 0);
  const list = pools[mode] || pools.logic;
  const content = list[indexSeed % list.length];

  const frameworkMap = {
    logic: "结论-原因-例子-总结",
    improv: "PREP",
    scenario: "非暴力沟通",
  };
  const modeLabels = { logic: "逻辑表达", improv: "即兴表达", scenario: "场景表达" };

  return {
    title: `${modeLabels[mode] || "表达"}训练题`,
    content,
    topic_type: mode,
    difficulty: input.difficulty || "intermediate",
    target_skill: input.target_skill || "logic",
    suggested_framework: frameworkMap[mode] || "PREP",
    recommended_duration: duration,
    training_goal: input.focus
      ? focusToGoal(String(input.focus))
      : `${modeLabels[mode] || "表达"}能力强化`,
    agent_focus: String(input.focus || input.weakness_tags?.[0] || ""),
    __source: "fallback",
  };
}