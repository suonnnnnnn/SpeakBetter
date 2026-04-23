/**
 * Coach Agent — 教练反馈 + 下一步决策 + 画像更新建议
 *
 * 输入：Eval report + user_profile
 * 输出：agent_message + next_action + profile_update
 */

export function decide(report, profile) {
  const focus = report.issue_tags?.[0] || profile.recommended_focus || "表达结构";

  return {
    agent_message: buildAgentMessage(report, focus),
    session_summary: {
      main_problem: focus,
      best_point: report.strengths?.[0] || "你已经完成了完整表达",
      priority_fix: report.suggestions?.[0] || "把回答控制在结论、分点、例子、总结内。",
    },
    next_action: decideNextAction(report, profile),
    profile_update: {
      weaknesses_to_increase: report.issue_tags?.slice(0, 3) || [],
      weaknesses_to_decrease: decideWeaknessesToDecrease(report, profile),
      strengths_to_add: report.strengths?.slice(0, 2) || [],
      last_score: report.overall_score,
      last_practiced_at: new Date().toISOString(),
    },
  };
}

function decideNextAction(report, profile) {
  const tags = report.issue_tags || [];

  if (tags.includes("结论不先行") || tags.includes("分点不明确")) {
    return {
      type: "retry",
      label: "按结构重练",
      instruction: "请用 30 秒重新回答，只保留：结论、两个理由、一个总结。",
    };
  }
  if (tags.includes("例子不足")) {
    return {
      type: "follow_up",
      label: "补例子追问",
      instruction: "请补充一个真实例子，说明你的观点为什么成立。",
    };
  }
  if (tags.includes("废话较多") || tags.includes("重复表达")) {
    return {
      type: "compress",
      label: "压缩表达",
      instruction: "请把刚才的回答压缩到原来的一半，只保留最关键的信息。",
    };
  }
  if (tags.some((tag) => /得体|共情|情商/.test(tag))) {
    return {
      type: "roleplay",
      label: "角色扮演",
      instruction: "我会扮演对方继续追问，请你先表达理解，再提出你的边界和方案。",
    };
  }
  if (report.overall_score >= 82) {
    return {
      type: "level_up",
      label: "提升难度",
      instruction: "下一题提高难度，加入更强的临场追问。",
    };
  }
  return {
    type: "plan_next",
    label: "继续巩固",
    instruction: "下一题继续练同一能力点，直到表达结构稳定。",
  };
}

function decideWeaknessesToDecrease(report, profile) {
  // 如果本次得分 >= 80，且上次推荐 focus 不在本次 issue_tags 中，说明该弱项已改善
  const currentTags = report.issue_tags || [];
  const decreased = [];
  if (report.overall_score >= 75 && profile.recommended_focus) {
    if (!currentTags.includes(profile.recommended_focus)) {
      decreased.push(profile.recommended_focus);
    }
  }
  return decreased;
}

function buildAgentMessage(report, focus) {
  if (report.overall_score >= 85) {
    return `这轮已经比较稳了。下一步我会提高难度，重点打磨"${focus}"的细节质量。`;
  }
  if (report.overall_score >= 70) {
    return `基础能听懂，下一步最值得修的是"${focus}"。先按一个动作重练，比一次改很多点更有效。`;
  }
  return `这轮先别急着追求完整，先把"${focus}"练稳。我会给你一个更小的复练动作。`;
}

export function buildPlanCard(profile) {
  const focus = profile.recommended_focus || "结论先行";
  return {
    focus,
    coach_message: profile.evaluated_sessions
      ? `最近最值得优先修的是"${focus}"。这轮我会围绕它出题，并在结果页给你下一步动作。`
      : "我会先用一轮基础题建立你的表达画像，结束后再安排针对性复练。",
    warmup_tip: buildWarmupTip(focus),
    success_criteria: buildSuccessCriteria(focus),
  };
}

function buildWarmupTip(focus) {
  if (/结论/.test(focus)) return "准备时先写一句'我的结论是……'。";
  if (/分点|结构/.test(focus)) return "准备时只列 3 个关键词，每个关键词讲一句。";
  if (/例子/.test(focus)) return "准备时先想一个真实场景，不要只讲抽象道理。";
  if (/冗长|废话|重复/.test(focus)) return "录音前先删掉背景铺垫，直接进入观点。";
  if (/得体|共情|情商/.test(focus)) return "先想对方处境，再表达你的诉求和边界。";
  return "准备 10 秒，把结论和两个分点想清楚。";
}

function buildSuccessCriteria(focus) {
  if (/结论/.test(focus)) return ["第一句话出现明确判断", "后续理由不超过 3 点", "结尾能回扣题目"];
  if (/分点|结构/.test(focus)) return ["有明显结构词", "每个分点只讲一件事", "分点之间不互相重复"];
  if (/例子/.test(focus)) return ["至少出现一个具体例子", "例子能支撑观点", "不是只说口号"];
  if (/冗长|废话|重复/.test(focus)) return ["无重复句", "少铺垫", "能在限定时间内收束"];
  if (/得体|共情|情商/.test(focus)) return ["先理解对方", "表达边界", "给出替代方案"];
  return ["先结论", "有分点", "有例子"];
}