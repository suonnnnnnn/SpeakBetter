/**
 * Profile Agent — 构建和更新用户长期画像
 *
 * 输入：历史 sessions 或 profile_update
 * 输出：user_profile JSON
 */

export function buildProfile(userId, sessions) {
  const userSessions = sessions.filter((s) => s.user_id === userId);
  const evaluated = userSessions.filter(
    (s) => s.evaluation_report && s.evaluation_report.overall_score != null
  );

  // 聚合弱项
  const tagStats = new Map();
  const strengthStats = new Map();

  for (const session of evaluated) {
    const report = session.evaluation_report;
    for (const tag of report.issue_tags || []) {
      const normalized = normalizeWeaknessTag(tag);
      if (!normalized) continue;
      const existing = tagStats.get(normalized) || { tag: normalized, count: 0, severity: 0, last_seen_at: session.created_at };
      existing.count += 1;
      existing.severity += 1;
      existing.last_seen_at = session.created_at;
      tagStats.set(normalized, existing);
    }
    for (const strength of report.strengths || []) {
      const key = String(strength).slice(0, 18);
      strengthStats.set(key, (strengthStats.get(key) || 0) + 1);
    }
  }

  const weaknesses = Array.from(tagStats.values())
    .map((item) => ({
      tag: item.tag,
      count: item.count,
      severity: Number(Math.min(1, item.severity / Math.max(3, evaluated.length)).toFixed(2)),
      last_seen_at: item.last_seen_at,
    }))
    .sort((a, b) => b.severity - a.severity || b.count - a.count)
    .slice(0, 5);

  const strengths = Array.from(strengthStats.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label]) => label);

  const scores = evaluated.map((s) => Number(s.evaluation_report.overall_score)).filter(Boolean);
  const averageScore = scores.length ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;
  const bestScore = scores.length ? Math.max(...scores) : null;
  const recommendedFocus = weaknesses[0]?.tag || "结论先行";

  return {
    user_id: userId,
    goals: inferGoals(userSessions),
    level: inferLevel(averageScore, evaluated.length),
    weaknesses,
    strengths,
    total_sessions: userSessions.length,
    evaluated_sessions: evaluated.length,
    average_score: averageScore,
    best_score: bestScore,
    preferred_training_minutes: inferPreferredMinutes(userSessions),
    recent_topics: userSessions.slice(-5).map((s) => s.topic?.content).filter(Boolean),
    recommended_focus: recommendedFocus,
    next_training_goal: focusToGoal(recommendedFocus),
    created_at: userSessions[0]?.created_at || new Date().toISOString(),
    updated_at: userSessions.at(-1)?.updated_at || new Date().toISOString(),
  };
}

export function applyProfileUpdate(profile, update) {
  if (!update) return profile;
  // 升权：新暴露的弱项
  for (const tag of update.weaknesses_to_increase || []) {
    const existing = profile.weaknesses.find((w) => w.tag === tag);
    if (existing) {
      existing.severity = Math.min(1, existing.severity + 0.1);
      existing.count += 1;
      existing.last_seen_at = new Date().toISOString();
    } else {
      profile.weaknesses.push({ tag, count: 1, severity: 0.3, last_seen_at: new Date().toISOString() });
    }
  }
  // 降权：训练过的弱项
  for (const tag of update.weaknesses_to_decrease || []) {
    const existing = profile.weaknesses.find((w) => w.tag === tag);
    if (existing) existing.severity = Math.max(0, existing.severity - 0.15);
  }
  // 新优势
  for (const s of update.strengths_to_add || []) {
    if (!profile.strengths.includes(s)) profile.strengths.push(s);
  }
  if (update.last_score != null) profile.average_score = update.last_score;
  profile.weaknesses.sort((a, b) => b.severity - a.severity);
  profile.recommended_focus = profile.weaknesses[0]?.tag || "结论先行";
  profile.next_training_goal = focusToGoal(profile.recommended_focus);
  profile.updated_at = new Date().toISOString();
  return profile;
}

function inferGoals(userSessions) {
  const modes = new Set(userSessions.map((s) => s.mode_type));
  const goals = [];
  if (modes.has("scenario")) goals.push("职场沟通");
  if (modes.has("improv")) goals.push("临场表达");
  goals.push("逻辑表达");
  return [...new Set(goals)].slice(0, 3);
}

function inferLevel(averageScore, evaluatedCount) {
  if (evaluatedCount < 3 || averageScore === null) return "beginner";
  if (averageScore >= 82) return "advanced";
  if (averageScore >= 68) return "intermediate";
  return "beginner";
}

function inferPreferredMinutes(userSessions) {
  const threeMin = userSessions.filter((s) => s.duration_type === "3min").length;
  return threeMin > userSessions.length / 2 ? 3 : 1;
}

export function focusToGoal(focus) {
  if (/结论/.test(focus)) return "开头 5 秒内先说结论，再展开理由。";
  if (/分点|结构/.test(focus)) return "用 2 到 3 个清晰分点组织回答。";
  if (/例子/.test(focus)) return "每个观点补一个具体场景或事实依据。";
  if (/冗长|废话|重复/.test(focus)) return "压缩重复句，只保留结论、理由和行动。";
  if (/得体|共情|情商/.test(focus)) return "先表达理解，再提出边界和可执行方案。";
  if (/犹豫/.test(focus)) return "用短暂停顿代替填充词。";
  return "把回答稳定控制在结论、分点、例子、总结四步内。";
}

function normalizeWeaknessTag(tag) {
  const value = String(tag || "").trim();
  if (!value) return "";
  const lower = value.toLowerCase();
  if (/strong|excellent|good|professional_tone|logic_strong/.test(lower)) return "";
  return value;
}