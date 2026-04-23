/**
 * Orchestrator — 主控调度器
 *
 * 三个入口：
 *   init(userId, params, deps)      → 训练初始化（Profile → Topic → PlanCard）
 *   evaluate(sessionId, deps)       → 评估流程（Eval → Coach → ProfileUpdate）
 *   next(sessionId, actionType, deps)→ 下一步决策（Coach 根据 action 生成下一步）
 *
 * deps 是依赖注入对象，由 server.js 传入，包含：
 *   sessions, findSession, saveSession, callAI, readPrompt,
 *   evaluateFallback, normalizeReport, extractSpeechFeatures
 */

import { buildProfile, applyProfileUpdate } from "./profile.js";
import { generateTopics } from "./topic.js";
import { evaluate as evalAgent } from "./eval.js";
import { decide as coachDecide, buildPlanCard } from "./coach.js";

// ─────────────────────────────────────────
// 1. init — 训练初始化
// ─────────────────────────────────────────
export async function init(userId, params, deps) {
  const { sessions, callAI, readPrompt } = deps;

  // Step 1: Profile Agent — 构建画像
  const profile = buildProfile(userId, sessions);

  // Step 2: Topic Agent — 基于画像弱项生成题目
  const topicInput = {
    mode_type: params.mode_type || "logic",
    difficulty: params.difficulty || "intermediate",
    duration_type: params.duration_type || "1min",
    target_skill: params.target_skill || "logic",
    focus: profile.recommended_focus,
    weakness_tags: profile.weaknesses.map((w) => w.tag),
  };

  const topicPrompt = await readPrompt("topic_generation.txt");

  const topics = await generateTopics(topicInput, {
    callAI: topicPrompt
      ? async (input) => {
          const result = await callAI(topicPrompt, input);
          if (!result || !result.title || !result.content) return null;
          return result;
        }
      : null,
    count: params.count || 3,
  });

  // Step 3: Coach Agent — 生成教练计划卡
  const planCard = buildPlanCard(profile);

  return {
    profile,
    topics,
    planCard,
    meta: {
      orchestrator: "init",
      timestamp: new Date().toISOString(),
    },
  };
}

// ─────────────────────────────────────────
// 2. evaluate — 评估流程
// ─────────────────────────────────────────
export async function evaluateSession(sessionId, deps) {
  const {
    sessions,
    findSession,
    saveSession,
    callAI,
    readPrompt,
    evaluateFallback,
    normalizeReport,
  } = deps;

  // Step 1: 取出 session
  const session = findSession(sessionId);
  if (!session) throw new Error("session 不存在");
  if (!session.transcript_text?.trim()) throw new Error("请先完成转写");

  // Step 2: Profile Agent — 构建当前画像
  const profile = buildProfile(session.user_id, sessions);

  // Step 3: Eval Agent — 结构化评估
  const evalPrompt = await readPrompt("evaluation.txt");

  const { report, source } = await evalAgent(session, profile, {
    callAI: evalPrompt
      ? async (payload) => {
          const result = await callAI(evalPrompt, payload);
          if (!result || typeof result !== "object") return null;
          return result;
        }
      : null,
    evaluateFallback,
    normalizeReport,
  });

  // Step 4: Coach Agent — 决策反馈
  const coaching = coachDecide(report, profile);

  // Step 5: 合并到 report，写入 session
  report.agent_message = coaching.agent_message;
  report.session_summary = coaching.session_summary;
  report.next_action = coaching.next_action;

  session.evaluation_report = report;
  session.status = "evaluated";
  session.updated_at = new Date().toISOString();

  // Step 6: Profile Agent — 增量更新画像
  const updatedProfile = applyProfileUpdate(
    buildProfile(session.user_id, sessions),
    coaching.profile_update
  );

  await saveSession();

  return {
    report,
    coaching,
    profile: updatedProfile,
    source,
    meta: {
      orchestrator: "evaluate",
      timestamp: new Date().toISOString(),
    },
  };
}

// ─────────────────────────────────────────
// 3. next — 下一步决策
// ─────────────────────────────────────────
export async function nextAction(sessionId, actionType, deps) {
  const { sessions, findSession, callAI, readPrompt } = deps;

  const session = findSession(sessionId);
  if (!session) throw new Error("session 不存在");

  const profile = buildProfile(session.user_id, sessions);
  const report = session.evaluation_report;

  if (!report) throw new Error("请先完成评估");

  // 根据 actionType 决定下一步
  switch (actionType) {
    case "retry": {
      // 重练同题：返回同一题目 + 精简 instruction
      const coaching = coachDecide(report, profile);
      return {
        action: "retry",
        topic: session.topic,
        instruction: coaching.next_action.instruction,
        planCard: buildPlanCard(profile),
        meta: { orchestrator: "next", actionType, timestamp: new Date().toISOString() },
      };
    }

    case "follow_up": {
      // 追问：基于当前题目生成追问
      const coaching = coachDecide(report, profile);
      return {
        action: "follow_up",
        topic: {
          ...session.topic,
          title: `[追问] ${session.topic.title}`,
          content: coaching.next_action.instruction,
        },
        instruction: coaching.next_action.instruction,
        planCard: buildPlanCard(profile),
        meta: { orchestrator: "next", actionType, timestamp: new Date().toISOString() },
      };
    }

    case "level_up":
    case "plan_next":
    default: {
      // 新题：Topic Agent 重新出题
      const topicInput = {
        mode_type: session.mode_type,
        difficulty: actionType === "level_up" ? "advanced" : "intermediate",
        duration_type: session.duration_type,
        target_skill: "logic",
        focus: profile.recommended_focus,
        weakness_tags: profile.weaknesses.map((w) => w.tag),
      };

      const topicPrompt = await readPrompt("topic_generation.txt");
      const topics = await generateTopics(topicInput, {
        callAI: topicPrompt
          ? async (input) => {
              const result = await callAI(topicPrompt, input);
              if (!result || !result.title || !result.content) return null;
              return result;
            }
          : null,
        count: 1,
      });

      return {
        action: actionType || "plan_next",
        topic: topics[0],
        planCard: buildPlanCard(profile),
        meta: { orchestrator: "next", actionType, timestamp: new Date().toISOString() },
      };
    }
  }
}