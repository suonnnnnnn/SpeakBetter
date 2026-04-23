/**
 * Eval Agent — 结构化评分（只管打分，不管决策）
 *
 * 输入：转写 + 画像 + 题目
 * 输出：evaluation report JSON
 */

export async function evaluate(session, profile, { callAI, evaluateFallback, normalizeReport }) {
  const isManualInput = (session.input_source || "manual") === "manual";
  const speechFeatures = session.speech_features
    ? Object.fromEntries(
        Object.entries(session.speech_features).filter(
          ([k]) => !(isManualInput && k === "estimated_pause_seconds")
        )
      )
    : null;

  const payload = {
    topic: session.topic,
    mode_type: session.mode_type,
    duration_type: session.duration_type,
    transcript_text: session.transcript_text,
    speech_features: speechFeatures,
    input_source: session.input_source || "manual",
    user_profile: profile,
  };

  const aiReport = callAI
    ? await callAI(payload).catch((error) => {
        console.error("[Eval Agent] AI evaluation failed:", error?.message || error);
        return null;
      })
    : null;

  const rawReport = aiReport || evaluateFallback(payload);
  const report = normalizeReport ? normalizeReport(rawReport, payload) : rawReport;

  return { report, payload, source: aiReport ? "siliconflow" : "fallback" };
}