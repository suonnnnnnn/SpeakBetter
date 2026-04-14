const DEMO_STORAGE_KEY = "speakbetter_demo_sessions_v1";
const AUTH_STORAGE_KEY = "speakbetter_auth_v1";

const state = {
  userId: "user_demo",
  authToken: "",
  userEmail: "",
  topic: null,
  sessionId: null,
  modeType: "logic",
  durationType: "1min",
  difficulty: "intermediate",
  targetSkill: "logic",
  mediaRecorder: null,
  mediaStream: null,
  audioChunks: [],
  audioBlob: null,
  audioBase64: null,
  timer: null,
  remainingSeconds: 60,
  isRecording: false,
  speechRecognition: null,
  speechRecognitionText: "",
  speechRecognitionEnabled: false,
  generatedTopics: [],  // 存放本次生成的3道题
  finalTranscript: ""   // 提交评估时的回答原文
};

const el = {
  navButtons: Array.from(document.querySelectorAll(".nav-btn")),
  tabs: Array.from(document.querySelectorAll(".tab")),
  // 兼容隐藏 select（部分逻辑仍读取 value）
  modeSelect: document.getElementById("modeSelect"),
  durationSelect: document.getElementById("durationSelect"),
  difficultySelect: document.getElementById("difficultySelect"),
  targetSkillSelect: document.getElementById("targetSkillSelect"),
  // 新 UI 元素
  modeGrid: document.getElementById("modeGrid"),
  durationGroup: document.getElementById("durationGroup"),
  difficultyGroup: document.getElementById("difficultyGroup"),
  topicListArea: document.getElementById("topicListArea"),
  topicListPlaceholder: document.getElementById("topicListPlaceholder"),
  refreshTopicsBtn: document.getElementById("refreshTopicsBtn"),
  startSessionBtn: document.getElementById("startSessionBtn"),
  trainingFlow: document.getElementById("trainingFlow"),
  backToTopicBtn: document.getElementById("backToTopicBtn"),
  trainingTopicText: document.getElementById("trainingTopicText"),
  timerValue: document.getElementById("timerValue"),
  recordStatus: document.getElementById("recordStatus"),
  recordBtn: document.getElementById("recordBtn"),
  stopBtn: document.getElementById("stopBtn"),
  recordingPanel: document.getElementById("recordingPanel"),
  transcriptPanel: document.getElementById("transcriptPanel"),
  submitBtn: document.getElementById("submitBtn"),
  reRecordBtn: document.getElementById("reRecordBtn"),
  trainingMessage: document.getElementById("trainingMessage"),
  transcribeStatus: document.getElementById("transcribeStatus"),
  manualTranscript: document.getElementById("manualTranscript"),
  // 结果
  overallScore: document.getElementById("overallScore"),
  resultSummary: document.getElementById("resultSummary"),
  dimensionScores: document.getElementById("dimensionScores"),
  issueTags: document.getElementById("issueTags"),
  detectedIssues: document.getElementById("detectedIssues"),
  suggestions: document.getElementById("suggestions"),
  frameworkName: document.getElementById("frameworkName"),
  frameworkOutline: document.getElementById("frameworkOutline"),
  rewriteConcise: document.getElementById("rewriteConcise"),
  rewriteLogic: document.getElementById("rewriteLogic"),
  rewriteEq: document.getElementById("rewriteEq"),
  modelAnswer: document.getElementById("modelAnswer"),
  retryBtn: document.getElementById("retryBtn"),
  goHistoryBtn: document.getElementById("goHistoryBtn"),
  historyList: document.getElementById("historyList"),
  refreshHistoryBtn: document.getElementById("refreshHistoryBtn"),
  loginStatusText: document.getElementById("loginStatusText"),
  loginEmailInput: document.getElementById("loginEmailInput"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  profileNickname: document.getElementById("profileNickname"),
  profileTotalSessions: document.getElementById("profileTotalSessions"),
  profileBestScore: document.getElementById("profileBestScore"),
  profileAvgScore: document.getElementById("profileAvgScore"),
  profileWeakTags: document.getElementById("profileWeakTags"),
  avatarWrap: document.getElementById("avatarWrap"),
  avatarImg: document.getElementById("avatarImg"),
  avatarFallback: document.getElementById("avatarFallback"),
  avatarInput: document.getElementById("avatarInput"),
  editNicknameBtn: document.getElementById("editNicknameBtn"),
  nicknameEditRow: document.getElementById("nicknameEditRow"),
  nicknameInput: document.getElementById("nicknameInput"),
  saveNicknameBtn: document.getElementById("saveNicknameBtn")
};

init();

function init() {
  restoreAuth();
  initSpeechRecognition();
  bindEvents();
  renderTimer();
  loadHistory();
  updateLoginUi();
  // 恢复本地保存的头像和昵称
  const savedAvatar = localStorage.getItem("speakbetter_avatar");
  if (savedAvatar) applyAvatar(savedAvatar);
  const savedNickname = localStorage.getItem("speakbetter_nickname");
  if (savedNickname) el.profileNickname.textContent = savedNickname;
}

function applyAvatar(dataUrl) {
  el.avatarImg.src = dataUrl;
  el.avatarImg.classList.remove("hidden");
  el.avatarFallback.style.display = "none";
}

function saveNickname() {
  const val = el.nicknameInput.value.trim();
  if (!val) return;
  localStorage.setItem("speakbetter_nickname", val);
  el.profileNickname.textContent = val;
  el.nicknameEditRow.classList.add("hidden");
}

function restoreAuth() {
  try {
    const auth = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "{}");
    if (auth && auth.userId) {
      state.userId = String(auth.userId);
      state.authToken = String(auth.token || "");
      state.userEmail = String(auth.email || "");
    }
  } catch {
    state.userId = "user_demo";
  }
}

function persistAuth() {
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      userId: state.userId,
      token: state.authToken,
      email: state.userEmail
    })
  );
}

function clearAuth() {
  state.userId = "user_demo";
  state.authToken = "";
  state.userEmail = "";
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function updateLoginUi() {
  const loggedIn = Boolean(state.userId && state.userId !== "user_demo");
  if (el.loginStatusText) {
    el.loginStatusText.textContent = loggedIn
      ? `已登录：${state.userEmail || state.userId}（训练历史将按此账号保存）`
      : "未登录，将使用游客身份保存本机记录。";
  }
  if (el.loginEmailInput) {
    el.loginEmailInput.value = loggedIn ? state.userEmail : "";
  }
  if (el.loginBtn) {
    el.loginBtn.textContent = loggedIn ? "重新登录" : "登录";
  }
}

async function loginByEmail() {
  const email = String(el.loginEmailInput?.value || "").trim();
  if (!email || !email.includes("@")) {
    alert("请输入有效邮箱后再登录");
    return;
  }

  if (el.loginBtn) el.loginBtn.disabled = true;
  try {
    const data = await apiPost("/api/auth/login", { email });
    if (!data.user?.id) throw new Error("登录失败，请稍后重试");
    state.userId = String(data.user.id);
    state.authToken = String(data.token || "");
    state.userEmail = String(data.user.email || email);
    persistAuth();
    updateLoginUi();
    setTrainingMessage("登录成功，训练记录将保存到当前账号。");
    await loadHistory();
    if (document.getElementById("profileTab")?.classList.contains("active")) {
      await loadProfile();
    }
  } catch (error) {
    alert(error.message || "登录失败");
  } finally {
    if (el.loginBtn) el.loginBtn.disabled = false;
  }
}

async function logoutAccount() {
  clearAuth();
  updateLoginUi();
  await loadHistory();
  if (document.getElementById("profileTab")?.classList.contains("active")) {
    await loadProfile();
  }
  setTrainingMessage("已退出登录，当前为游客模式。");
}

function bindEvents() {
  el.navButtons.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // ---- 模式卡片 ----
  if (el.modeGrid) {
    el.modeGrid.addEventListener("click", (e) => {
      const card = e.target.closest(".mode-card");
      if (!card) return;
      el.modeGrid.querySelectorAll(".mode-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      state.modeType = card.dataset.mode;
      el.modeSelect.value = state.modeType;
      triggerAutoGenerate();
    });
  }

  // ---- 时长 chip ----
  if (el.durationGroup) {
    el.durationGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip-btn");
      if (!btn) return;
      el.durationGroup.querySelectorAll(".chip-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.durationType = btn.dataset.duration;
      el.durationSelect.value = state.durationType;
      triggerAutoGenerate();
    });
  }

  // ---- 难度 chip ----
  if (el.difficultyGroup) {
    el.difficultyGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip-btn");
      if (!btn) return;
      el.difficultyGroup.querySelectorAll(".chip-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.difficulty = btn.dataset.difficulty;
      el.difficultySelect.value = state.difficulty;
      triggerAutoGenerate();
    });
  }

  // ---- 换一批 ----
  if (el.refreshTopicsBtn) {
    el.refreshTopicsBtn.addEventListener("click", () => generateTopics());
  }

  // ---- 开始训练 ----
  el.startSessionBtn.addEventListener("click", createSessionAndEnterTraining);
  el.backToTopicBtn?.addEventListener("click", () => {
    resetTrainingState();
    el.trainingFlow?.classList.add("hidden");
    setTrainingMessage("已返回选题，你可以换题后再开始。");
    document.getElementById("topicListSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  el.recordBtn.addEventListener("click", startRecording);
  el.stopBtn.addEventListener("click", stopRecording);
  el.submitBtn.addEventListener("click", submitForEvaluation);
  el.reRecordBtn.addEventListener("click", () => {
    el.transcriptPanel.classList.add("hidden");
    el.recordingPanel.classList.remove("hidden");
    el.manualTranscript.value = "";
    el.recordStatus.textContent = "待开始";
    el.recordStatus.classList.remove("recording");
    el.recordBtn.disabled = false;
    el.stopBtn.disabled = true;
    state.audioBlob = null;
    state.audioChunks = [];
    state.remainingSeconds = state.durationType === "3min" ? 180 : 60;
    renderTimer();
    setTrainingMessage("");
  });

  el.retryBtn.addEventListener("click", () => {
    resetTrainingState();
    el.trainingFlow?.classList.add("hidden");
    switchTab("homeTab");
  });
  el.goHistoryBtn.addEventListener("click", () => {
    loadHistory();
    switchTab("historyTab");
  });
  el.refreshHistoryBtn.addEventListener("click", loadHistory);
  el.loginBtn?.addEventListener("click", loginByEmail);
  el.logoutBtn?.addEventListener("click", logoutAccount);
  el.loginEmailInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loginByEmail();
  });

  // 头像
  el.avatarWrap.addEventListener("click", () => el.avatarInput.click());
  el.avatarInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      localStorage.setItem("speakbetter_avatar", dataUrl);
      applyAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  });

  // 昵称
  el.editNicknameBtn.addEventListener("click", () => {
    el.nicknameInput.value = el.profileNickname.textContent;
    el.nicknameEditRow.classList.remove("hidden");
    el.nicknameInput.focus();
    el.nicknameInput.select();
  });
  el.saveNicknameBtn.addEventListener("click", saveNickname);
  el.nicknameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveNickname();
    if (e.key === "Escape") el.nicknameEditRow.classList.add("hidden");
  });

  el.historyList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches("button[data-session-id]")) return;
    const sessionId = target.dataset.sessionId;
    if (!sessionId) return;
    try {
      const data = await apiGet(`/api/session/${sessionId}/result`);
      if (!data.report) { alert("该记录尚未完成评估。"); return; }
      renderResult(data.report);
      switchTab("resultTab");
    } catch (error) {
      alert(error.message || "加载结果失败");
    }
  });

  // hamburger 菜单
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  function openMobileSidebar() {
    if (!sidebar || !overlay) return;
    sidebar.classList.add("mobile-open");
    overlay.style.display = "block";
    document.body.style.overflow = "hidden";
  }
  function closeMobileSidebar() {
    if (!sidebar || !overlay) return;
    sidebar.classList.remove("mobile-open");
    overlay.style.display = "";
    document.body.style.overflow = "";
  }
  if (hamburgerBtn) hamburgerBtn.addEventListener("click", openMobileSidebar);
  if (overlay) overlay.addEventListener("click", closeMobileSidebar);
  if (sidebar) {
    sidebar.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => { if (window.innerWidth <= 600) closeMobileSidebar(); });
    });
  }
}

// 防抖：选完后 300ms 触发（避免快速切换重复请求）
let _autoGenTimer = null;
function triggerAutoGenerate() {
  clearTimeout(_autoGenTimer);
  _autoGenTimer = setTimeout(() => generateTopics(), 300);
}

function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    state.speechRecognitionEnabled = false;
    return;
  }
  const recognition = new SR();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let finalText = "";
    for (let i = 0; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal && result[0]?.transcript) {
        finalText += result[0].transcript;
      }
    }
    if (finalText) {
      state.speechRecognitionText = `${state.speechRecognitionText}${finalText}`.trim();
    }
  };

  recognition.onerror = () => {
    // 浏览器识别仅做兜底，不在录音过程中打断主流程
  };

  state.speechRecognition = recognition;
  state.speechRecognitionEnabled = true;
}

function startBrowserSpeechRecognition() {
  if (!state.speechRecognitionEnabled || !state.speechRecognition) return;
  try {
    state.speechRecognition.start();
  } catch {
    // 某些浏览器重复 start 会抛错，忽略即可
  }
}

function stopBrowserSpeechRecognition() {
  if (!state.speechRecognitionEnabled || !state.speechRecognition) return;
  try {
    state.speechRecognition.stop();
  } catch {
    // noop
  }
}

// 生成3道题并渲染可选列表
async function generateTopics() {
  // 显示 loading 状态
  el.topicListPlaceholder && (el.topicListPlaceholder.style.display = "none");
  el.topicListArea.innerHTML = `<div class="topics-loading"><span class="loading-spinner"></span>AI 正在生成题目…</div>`;
  if (el.refreshTopicsBtn) el.refreshTopicsBtn.style.display = "none";
  state.topic = null;
  el.startSessionBtn.disabled = true;

  const payload = {
    modeType: state.modeType,
    durationType: state.durationType,
    difficulty: state.difficulty || "intermediate",
    targetSkill: state.targetSkill || "logic",
    weaknessTags: [],
    count: 3
  };

  try {
    // 并发生成3题（后端 generate 每次生成1题，并发3次）
    const results = await Promise.all([
      apiPost("/api/topic/generate", payload),
      apiPost("/api/topic/generate", payload),
      apiPost("/api/topic/generate", payload)
    ]);
    state.generatedTopics = results.map((r) => r.topic);
    renderTopicList(state.generatedTopics);
  } catch (err) {
    el.topicListArea.innerHTML = `<div class="topics-error">生成失败：${escapeHtml(err.message || "请检查网络后重试")}<br><button class="ghost-btn" style="margin-top:12px" onclick="generateTopics()">重试</button></div>`;
  } finally {
    if (el.refreshTopicsBtn) el.refreshTopicsBtn.style.display = "";
  }
}

function renderTopicList(topics) {
  el.topicListArea.innerHTML = "";
  topics.forEach((topic, idx) => {
    const item = document.createElement("div");
    item.className = "topic-option";
    item.dataset.idx = idx;
    item.innerHTML = `
      <div class="topic-option-num">${idx + 1}</div>
      <div class="topic-option-body">
        <p class="topic-option-text">${escapeHtml(topic.content)}</p>
        <div class="topic-option-meta">
          <span>${escapeHtml(topic.suggested_framework || "")}</span>
          <span>${escapeHtml(topic.recommended_duration || state.durationType)}</span>
        </div>
        <button class="topic-select-btn" data-idx="${idx}">选这道题</button>
      </div>
      <div class="topic-option-check">✓</div>
    `;
    // 仅按钮触发选中，卡片本身不响应点击
    item.querySelector(".topic-select-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      selectTopic(idx);
    });
    el.topicListArea.appendChild(item);
  });
}

function selectTopic(idx) {
  el.topicListArea.querySelectorAll(".topic-option").forEach((item, i) => {
    item.classList.toggle("selected", i === idx);
    // 选中态下按钮文案改为"已选择 ✓"，其余恢复
    const btn = item.querySelector(".topic-select-btn");
    if (btn) {
      btn.textContent = i === idx ? "已选择 ✓" : "选这道题";
      btn.classList.toggle("topic-select-btn--chosen", i === idx);
    }
  });
  state.topic = state.generatedTopics[idx];
  state.modeType = state.topic.topic_type || state.modeType;
  el.startSessionBtn.disabled = false;
}

function switchTab(tabId) {
  el.tabs.forEach((tab) => tab.classList.toggle("active", tab.id === tabId));
  el.navButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabId));
  const titleMap = {
    homeTab: "开始训练",
    resultTab: "评估结果", historyTab: "训练历史", profileTab: "我的"
  };
  const titleEl = document.getElementById("topBarTitle");
  if (titleEl) titleEl.textContent = titleMap[tabId] || "";
  if (tabId === "profileTab") {
    updateLoginUi();
    loadProfile();
  }
}

async function createSessionAndEnterTraining() {
  if (!state.topic) { alert("请先选择一道题目"); return; }
  try {
    const data = await apiPost("/api/session/create", {
      userId: state.userId, modeType: state.modeType,
      durationType: state.durationType, topic: state.topic
    });
    state.sessionId = data.session.id;
    state.audioBlob = null; state.audioChunks = [];
    state.remainingSeconds = state.durationType === "3min" ? 180 : 60;
    el.trainingTopicText.textContent = state.topic.content;
    el.manualTranscript.value = "";
    el.recordStatus.textContent = "待开始";
    el.recordBtn.disabled = false; el.stopBtn.disabled = true;
    el.submitBtn.disabled = false;
    setTrainingMessage("会话已创建，点击【开始录音】进入训练。");
    renderTimer();
    el.trainingFlow?.classList.remove("hidden");
    el.recordingPanel.classList.remove("hidden");
    el.transcriptPanel.classList.add("hidden");
    el.trainingFlow?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { alert(error.message || "创建训练会话失败"); }
}


async function startRecording() {
  if (!state.sessionId) {
    setTrainingMessage("请先从首页生成题目并开始训练。", true);
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setTrainingMessage("当前浏览器不支持录音，请直接在下方输入回答文本。", true);
    el.submitBtn.disabled = false;
    return;
  }

  try {
    if (!state.mediaStream) {
      state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    state.audioChunks = [];
    state.audioBlob = null;
    state.speechRecognitionText = "";
    state.remainingSeconds = state.durationType === "3min" ? 180 : 60;
    renderTimer();

    const options = MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : undefined;
    const recorder = new MediaRecorder(state.mediaStream, options);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        state.audioChunks.push(event.data);
      }
    };

    recorder.onstop = async () => {
      stopBrowserSpeechRecognition();
      state.audioBlob = new Blob(state.audioChunks, { type: recorder.mimeType || "audio/webm" });
      state.isRecording = false;
      el.recordStatus.textContent = "录音完成";
      el.recordStatus.classList.remove("recording");
      el.recordBtn.disabled = false;
      el.stopBtn.disabled = true;
      clearTimer();

      // 切换到转写确认面板
      el.recordingPanel.classList.add("hidden");
      el.transcriptPanel.classList.remove("hidden");
      el.manualTranscript.value = "";
      el.manualTranscript.placeholder = "转写中，请稍候…";
      el.manualTranscript.disabled = true;
      el.submitBtn.disabled = true;
      el.transcribeStatus.textContent = "⏳ 正在识别语音，完成后可修改再提交…";

      // 先上传音频，upload 时后端会同步 ASR 转写
      try {
        const audioBase64 = await blobToBase64(state.audioBlob);
        state.audioBase64 = audioBase64; // 缓存，transcribe 时备用
        const uploadRes = await apiPost("/api/session/upload-audio", {
          sessionId: state.sessionId,
          audioBase64,
          mimeType: state.audioBlob.type || "audio/webm"
        });

        const text = uploadRes.transcript_text || "";
        const browserText = (state.speechRecognitionText || "").trim();
        el.manualTranscript.value = text || browserText;
        el.manualTranscript.placeholder = "粘贴或修改你的回答文本…";

        if (text && uploadRes.transcribe_source === "siliconflow") {
          el.transcribeStatus.textContent = "✓ 识别完成，你可以修改后再提交评估";
        } else if (browserText) {
          el.transcribeStatus.textContent = "✓ 已使用浏览器识别结果，你可以修改后再提交评估";
        } else if (text) {
          el.transcribeStatus.textContent = "✓ 已完成，你可以修改后再提交评估";
        } else {
          const errMsg = uploadRes.asr_error ? `（${uploadRes.asr_error.slice(0, 120)}）` : "";
          el.transcribeStatus.textContent = `⚠️ 自动识别未返回结果${errMsg}，请手动粘贴你的回答后提交`;
        }
      } catch (err) {
        const browserText = (state.speechRecognitionText || "").trim();
        el.manualTranscript.value = browserText;
        if (browserText) {
          el.transcribeStatus.textContent = `⚠️ 云端识别失败（${err.message || "网络错误"}），已回填浏览器识别结果`;
        } else {
          el.transcribeStatus.textContent = `⚠️ 上传失败（${err.message || "网络错误"}），请手动粘贴后提交`;
        }
      } finally {
        el.manualTranscript.disabled = false;
        el.submitBtn.disabled = false;
      }
    };

    recorder.start(250);
    state.mediaRecorder = recorder;
    state.isRecording = true;
    el.recordBtn.disabled = true;
    el.stopBtn.disabled = false;
    el.submitBtn.disabled = true;
    el.recordStatus.textContent = "● 录音中";
    el.recordStatus.classList.add("recording");
    setTrainingMessage("正在录音，请按“结论 -> 分点 -> 总结”的结构回答。");
    startBrowserSpeechRecognition();
    startTimerCountdown();
  } catch (error) {
    setTrainingMessage("麦克风不可用，请直接在下方输入回答文本。", true);
  }
}

function stopRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state === "recording") {
    state.mediaRecorder.stop();
  }
  stopBrowserSpeechRecognition();
  clearTimer();
}

function startTimerCountdown() {
  clearTimer();
  state.timer = window.setInterval(() => {
    state.remainingSeconds -= 1;
    renderTimer();
    if (state.remainingSeconds <= 0) {
      stopRecording();
    }
  }, 1000);
}

function clearTimer() {
  if (state.timer) {
    window.clearInterval(state.timer);
    state.timer = null;
  }
}

function renderTimer() {
  const min = String(Math.floor(state.remainingSeconds / 60)).padStart(2, "0");
  const sec = String(state.remainingSeconds % 60).padStart(2, "0");
  el.timerValue.textContent = `${min}:${sec}`;
}

async function submitForEvaluation() {
  if (!state.sessionId) {
    el.transcribeStatus.textContent = "没有可提交的会话，请重新开始。";
    return;
  }

  const finalText = el.manualTranscript.value.trim();
  if (!finalText) {
    el.transcribeStatus.textContent = "⚠️ 请先填写或确认回答内容再提交。";
    return;
  }

  el.submitBtn.disabled = true;
  el.reRecordBtn.disabled = true;
  el.transcribeStatus.textContent = "⏳ AI 评估中，请稍候…";

  // 保存原文供结果页逐句展示
  state.finalTranscript = finalText;

  try {
    // 把用户最终确认/修改的文字同步给后端，并带上备用音频
    await apiPost("/api/session/transcribe", {
      sessionId: state.sessionId,
      transcriptText: finalText,
      audioBase64: state.audioBase64 || "",
      mimeType: state.audioBlob ? (state.audioBlob.type || "audio/webm") : "audio/webm"
    });

    const evaluateRes = await apiPost("/api/session/evaluate", {
      sessionId: state.sessionId
    });

    renderResult(evaluateRes.report);
    await loadHistory();
    switchTab("resultTab");
  } catch (error) {
    el.transcribeStatus.textContent = `❌ ${error.message || "提交失败，请稍后重试"}`;
  } finally {
    el.submitBtn.disabled = false;
    el.reRecordBtn.disabled = false;
  }
}

function renderResult(report) {
  const dimensionLabels = {
    logic: "逻辑清晰度",
    structure: "结构完整度",
    brevity: "简洁程度",
    precision: "用词精准度",
    speaking: "口语表现",
    effectiveness: "回答有效性",
    appropriateness: "场景得体度"
  };

  el.overallScore.textContent = String(report.overall_score ?? "--");
  el.resultSummary.textContent = report.summary || "评估完成。";
  el.dimensionScores.innerHTML = "";

  Object.entries(report.dimension_scores || {}).forEach(([key, value]) => {
    const item = document.createElement("div");
    item.className = "score-item";
    item.innerHTML = `<div class="dim-name">${dimensionLabels[key] || key}</div><div class="dim-val">${value}</div>`;
    el.dimensionScores.appendChild(item);
  });

  renderIssueChips(el.issueTags, report.issue_tags || []);
  renderTextList(el.detectedIssues, report.detected_issues || []);
  renderTextList(el.suggestions, report.suggestions || []);

  const guide = report.thinking_guide || {};
  el.frameworkName.textContent = `推荐框架：${guide.recommended_framework || "PREP"}`;
  renderTextList(el.frameworkOutline, guide.outline || []);

  const rewrites = report.rewrites || {};
  el.rewriteConcise.textContent = rewrites.concise || "";
  el.rewriteLogic.textContent = rewrites.high_logic || "";
  el.rewriteEq.textContent = rewrites.high_eq || "";
  el.modelAnswer.textContent = guide.model_answer || "";

  // 逐句点评
  renderSentenceReview(state.finalTranscript, report.sentence_comments || []);
}

// 逐句点评渲染
function renderSentenceReview(transcript, sentenceComments) {
  const container = document.getElementById("sentenceReview");
  if (!container) return;
  container.innerHTML = "";

  if (!transcript) {
    container.innerHTML = '<p class="hint">暂无回答内容</p>';
    return;
  }

  // 按中英文句终标点拆句
  const raw = transcript.trim();
  const sentences = raw
    .split(/(?<=[。！？!?…]+)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) {
    container.innerHTML = `<p class="sr-sentence sr-ok">${escapeHtml(raw)}</p>`;
    return;
  }

  // 建立句子→点评的映射（后端精确匹配）
  const commentMap = new Map();
  sentenceComments.forEach((c) => {
    if (c.sentence) commentMap.set(c.sentence.trim(), c);
  });

  sentences.forEach((sent, idx) => {
    const comment = commentMap.get(sent);
    const row = document.createElement("div");
    row.className = comment ? "sr-row sr-row--issue" : "sr-row sr-row--ok";

    const sentEl = document.createElement("p");
    sentEl.className = "sr-sentence";
    sentEl.textContent = `${idx + 1}. ${sent}`;
    row.appendChild(sentEl);

    if (comment) {
      // 问题说明
      if (comment.issue) {
        const issueEl = document.createElement("div");
        issueEl.className = "sr-issue";
        issueEl.innerHTML = `<span class="sr-issue-icon">⚠</span>${escapeHtml(comment.issue)}`;
        row.appendChild(issueEl);
      }
      // 改进建议
      if (comment.suggestion) {
        const sugEl = document.createElement("div");
        sugEl.className = "sr-suggestion";
        sugEl.innerHTML = `<span class="sr-sug-icon">💡</span>可以说：<em>${escapeHtml(comment.suggestion)}</em>`;
        row.appendChild(sugEl);
      }
    }

    container.appendChild(row);
  });
}

async function loadHistory() {
  try {
    const data = await apiGet(`/api/session/history?userId=${encodeURIComponent(state.userId)}&limit=30`);
    renderHistory(data.sessions || []);
  } catch {
    renderHistory([]);
  }
}

async function loadProfile() {
  try {
    const data = await apiGet(`/api/session/history?userId=${encodeURIComponent(state.userId)}&limit=200`);
    renderProfile(data.sessions || []);
  } catch {
    renderProfile([]);
  }
}

function renderProfile(sessions) {
  const evaluated = sessions.filter((s) => s.overall_score !== null && s.overall_score !== undefined);
  const total = sessions.length;
  const best = evaluated.length ? Math.max(...evaluated.map((s) => s.overall_score)) : null;
  const avg = evaluated.length
    ? Math.round(evaluated.reduce((sum, s) => sum + s.overall_score, 0) / evaluated.length)
    : null;

  el.profileTotalSessions.textContent = total > 0 ? `${total} 次` : "--";
  el.profileBestScore.textContent = best !== null ? String(best) : "--";
  el.profileAvgScore.textContent = avg !== null ? String(avg) : "--";

  // 统计最常出现的薄弱项 tag（取 top 3）
  const tagCount = {};
  sessions.forEach((s) => {
    (s.issue_tags || []).forEach((tag) => {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  el.profileWeakTags.innerHTML = "";
  if (topTags.length) {
    topTags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "issue-chip";
      chip.textContent = tag;
      el.profileWeakTags.appendChild(chip);
    });
  } else {
    el.profileWeakTags.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem">暂无数据，完成训练后查看</span>';
  }
}

function renderHistory(rows) {
  el.historyList.innerHTML = "";
  if (!rows.length) {
    el.historyList.innerHTML = '<p class="hint">暂无训练记录，先去首页开始一次训练吧。</p>';
    return;
  }

  rows.forEach((row) => {
    const card = document.createElement("div");
    card.className = "history-item";
    const time = new Date(row.created_at).toLocaleString("zh-CN", {
      month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
    const score = row.overall_score ?? "--";
    const scoreColor = row.overall_score >= 80
      ? "color:#16a34a;background:var(--green-dim);border-color:rgba(34,197,94,0.20)"
      : row.overall_score >= 60
      ? "color:#d97706;background:#fef3c7;border-color:rgba(245,158,11,0.25)"
      : "color:var(--text-2);background:var(--bg-muted);border-color:var(--border)";

    const tagsHtml = (row.issue_tags || []).slice(0, 3)
      .map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");

    card.innerHTML = `
      <h4>${escapeHtml(row.topic_title || "训练记录")}</h4>
      <p class="history-meta">
        ${typeLabel(row.mode_type)} · ${durationLabel(row.duration_type)}
      </p>
      <p class="history-time">${escapeHtml(time)}</p>
      <div class="history-tags">${tagsHtml}</div>
      <div class="history-score-pill" style="${scoreColor}">${score}${typeof row.overall_score === "number" ? " 分" : ""}</div>
      <div class="history-actions">
        <button class="ghost-btn" style="padding:7px 16px;font-size:0.82rem" data-session-id="${row.id}">详情 →</button>
      </div>
    `;
    el.historyList.appendChild(card);
  });
}

function renderIssueChips(container, items) {
  container.innerHTML = "";
  const values = items.length ? items : [];
  values.forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "issue-chip";
    chip.textContent = item;
    container.appendChild(chip);
  });
}

function renderChipList(container, items) {
  container.innerHTML = "";
  const values = items.length ? items : ["暂无明显问题标签"];
  values.forEach((item) => {
    const chip = document.createElement("span");
    chip.textContent = item;
    container.appendChild(chip);
  });
}

function renderTextList(container, items) {
  container.innerHTML = "";
  const values = items.length ? items : ["暂无"];
  values.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    container.appendChild(li);
  });
}

function resetTrainingState() {
  clearTimer();
  stopBrowserSpeechRecognition();
  state.sessionId = null;
  state.audioBlob = null;
  state.audioBase64 = null;
  state.audioChunks = [];
  state.speechRecognitionText = "";
  state.remainingSeconds = state.durationType === "3min" ? 180 : 60;
  state.isRecording = false;
  el.recordStatus.textContent = "待开始";
  el.recordStatus.classList.remove("recording");
  el.recordingPanel.classList.remove("hidden");
  el.transcriptPanel.classList.add("hidden");
  el.manualTranscript.value = "";
  el.manualTranscript.disabled = false;
  el.recordBtn.disabled = false;
  el.stopBtn.disabled = true;
  renderTimer();
  setTrainingMessage("");
}

function setTrainingMessage(message, isError = false) {
  el.trainingMessage.textContent = message;
  el.trainingMessage.style.color = isError ? "#b75f1d" : "#567071";
}

async function apiGet(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "请求失败");
  }
  return data;
}

async function apiPost(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body || {})
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "请求失败");
  }
  return data;
}

function demoApiGet(url, originalError) {
  if (url.startsWith("/api/session/history")) {
    const query = new URL(url, window.location.origin);
    const userId = query.searchParams.get("userId") || state.userId;
    const limit = Number(query.searchParams.get("limit") || 50);
    const sessions = getDemoSessions()
      .filter((session) => session.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
      .map((session) => ({
        id: session.id,
        topic_title: session.topic?.title || "未命名题目",
        topic_content: session.topic?.content || "",
        mode_type: session.mode_type,
        duration_type: session.duration_type,
        overall_score: session.evaluation_report?.overall_score ?? null,
        issue_tags: session.evaluation_report?.issue_tags || [],
        created_at: session.created_at,
        status: session.status
      }));
    return Promise.resolve({ ok: true, sessions, source: "demo" });
  }

  const resultMatch = url.match(/^\/api\/session\/([a-zA-Z0-9-]+)\/result$/);
  if (resultMatch) {
    const session = getDemoSessions().find((item) => item.id === resultMatch[1]);
    if (!session) {
      return Promise.reject(new Error("该记录不存在"));
    }
    return Promise.resolve({ ok: true, session, report: session.evaluation_report, source: "demo" });
  }

  return Promise.reject(originalError instanceof Error ? originalError : new Error("请求失败"));
}

function demoApiPost(url, body, originalError) {
  if (url === "/api/topic/generate") {
    return Promise.resolve({ ok: true, topic: generateDemoTopic(body), source: "demo" });
  }

  if (url === "/api/session/create") {
    const sessions = getDemoSessions();
    const session = {
      id: makeDemoId(),
      user_id: body.userId || state.userId,
      mode_type: body.modeType || "logic",
      duration_type: body.durationType || "1min",
      topic: body.topic,
      audio_url: null,
      mime_type: null,
      transcript_text: "",
      speech_features: null,
      evaluation_report: null,
      status: "created",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    sessions.push(session);
    saveDemoSessions(sessions);
    return Promise.resolve({ ok: true, session, source: "demo" });
  }

  if (url === "/api/session/upload-audio") {
    const sessions = getDemoSessions();
    const session = sessions.find((item) => item.id === body.sessionId);
    if (!session) {
      return Promise.reject(new Error("session 不存在"));
    }
    session.status = "audio_uploaded";
    session.updated_at = new Date().toISOString();
    saveDemoSessions(sessions);
    return Promise.resolve({ ok: true, audio_url: null, size: 0, source: "demo" });
  }

  if (url === "/api/session/transcribe") {
    const sessions = getDemoSessions();
    const session = sessions.find((item) => item.id === body.sessionId);
    if (!session) {
      return Promise.reject(new Error("session 不存在"));
    }
    const transcriptText = String(body.transcriptText || "").trim() || "这是一个演示版会话，请粘贴回答文本后再次评估。";
    const speechFeatures = extractDemoSpeechFeatures(transcriptText);
    session.transcript_text = transcriptText;
    session.speech_features = speechFeatures;
    session.status = "transcribed";
    session.updated_at = new Date().toISOString();
    saveDemoSessions(sessions);
    return Promise.resolve({
      ok: true,
      transcript_text: transcriptText,
      speech_features: speechFeatures,
      source: "demo"
    });
  }

  if (url === "/api/session/evaluate") {
    const sessions = getDemoSessions();
    const session = sessions.find((item) => item.id === body.sessionId);
    if (!session) {
      return Promise.reject(new Error("session 不存在"));
    }
    if (!session.transcript_text) {
      return Promise.reject(new Error("请先完成转写"));
    }
    const report = evaluateDemoAnswer({
      topic: session.topic,
      mode_type: session.mode_type,
      duration_type: session.duration_type,
      transcript_text: session.transcript_text,
      speech_features: session.speech_features
    });
    session.evaluation_report = report;
    session.status = "evaluated";
    session.updated_at = new Date().toISOString();
    saveDemoSessions(sessions);
    return Promise.resolve({ ok: true, report, source: "demo" });
  }

  return Promise.reject(originalError instanceof Error ? originalError : new Error("请求失败"));
}

function getDemoSessions() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveDemoSessions(sessions) {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(sessions));
}

function makeDemoId() {
  return `demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateDemoTopic(input) {
  const mode = input.modeType || "logic";
  const pools = {
    logic: [
      "你认为一个团队效率低下的最核心原因是什么？",
      "为什么有些人很努力却成长缓慢？",
      "你如何判断一个方案是可执行而不是空想？"
    ],
    improv: [
      "如果你临时要在会议上汇报项目风险，你会怎么开场？",
      "今天让你接手一个延期项目，你第一步会做什么？",
      "面对领导突然提问，你如何在30秒内组织回答？"
    ],
    scenario: [
      "领导临时让你周末加班，但你已有安排，你会如何回应？",
      "同事频繁把任务推给你，你如何拒绝且不伤关系？",
      "你需要向上级争取资源，如何更有说服力地表达请求？"
    ]
  };
  const frameworks = {
    logic: "结论-原因-例子-总结",
    improv: "PREP",
    scenario: "非暴力沟通"
  };
  const labels = {
    logic: "逻辑表达训练题",
    improv: "即兴表达训练题",
    scenario: "场景表达训练题"
  };
  const list = pools[mode] || pools.logic;

  return {
    title: labels[mode] || "表达训练题",
    content: list[Math.floor(Math.random() * list.length)],
    topic_type: mode,
    difficulty: input.difficulty || "intermediate",
    target_skill: input.targetSkill || "logic",
    suggested_framework: frameworks[mode] || "PREP",
    recommended_duration: input.durationType || "1min",
    training_goal: "提升结构化表达能力"
  };
}

function extractDemoSpeechFeatures(text) {
  const fillers = ["嗯", "啊", "那个", "然后", "就是", "其实"];
  let fillerCount = 0;
  fillers.forEach((word) => {
    const matches = String(text || "").match(new RegExp(word, "g"));
    fillerCount += matches ? matches.length : 0;
  });

  const charCount = String(text || "").replace(/\s+/g, "").length;
  return {
    char_count: charCount,
    filler_count: fillerCount,
    filler_ratio: charCount ? Number((fillerCount / charCount).toFixed(4)) : 0,
    repetition_ratio: 0,
    estimated_pause_seconds: Number((fillerCount * 0.2).toFixed(2))
  };
}

function evaluateDemoAnswer(payload) {
  const transcript = String(payload.transcript_text || "").trim();
  const features = payload.speech_features || extractDemoSpeechFeatures(transcript);
  const hasConclusion = /(我认为|我的结论|总结来说|结论是|我会先)/.test(transcript);
  const hasStructure = /(第一|第二|第三|首先|其次|最后)/.test(transcript);
  const hasEvidence = /(例如|比如|数据|案例|结果|所以|因为)/.test(transcript);
  const politeness = /(请|感谢|抱歉|理解|辛苦)/.test(transcript);
  const length = transcript.length;

  const logic = clampDemoScore(66 + (hasConclusion ? 14 : -4) + (hasStructure ? 8 : -2));
  const structure = clampDemoScore(64 + (hasStructure ? 16 : -5));
  const brevity = clampDemoScore(78 - Math.max(0, Math.floor((length - 260) / 18)));
  const precision = clampDemoScore(65 + (hasEvidence ? 10 : -1));
  const speaking = clampDemoScore(72 - Math.min(20, Math.round(features.filler_ratio * 120)));
  const effectiveness = clampDemoScore(68 + (hasEvidence ? 10 : -3) + (hasConclusion ? 6 : -3));
  const appropriateness = clampDemoScore(payload.mode_type === "scenario" ? (politeness ? 80 : 66) : 75);
  const overall = clampDemoScore(
    Math.round(logic * 0.2 + structure * 0.15 + brevity * 0.15 + precision * 0.15 + speaking * 0.15 + effectiveness * 0.2)
  );

  const issueTags = [];
  const detectedIssues = [];
  if (!hasConclusion) {
    issueTags.push("结论不先行");
    detectedIssues.push("开头缺少直接结论，听者需要花更久抓重点。");
  }
  if (!hasStructure) {
    issueTags.push("分点不明确");
    detectedIssues.push("建议用“第一、第二、第三”让结构更清楚。");
  }
  if (!hasEvidence) {
    issueTags.push("例子不足");
    detectedIssues.push("可以补一个真实案例，让表达更有说服力。");
  }
  if (features.filler_ratio > 0.02) {
    issueTags.push("犹豫词偏多");
    detectedIssues.push("减少“嗯、然后、就是”等填充词，表达会更干净。");
  }

  return {
    overall_score: overall,
    dimension_scores: {
      logic,
      structure,
      brevity,
      precision,
      speaking,
      effectiveness,
      appropriateness
    },
    detected_issues: detectedIssues,
    issue_tags: issueTags,
    strengths: [
      hasConclusion ? "能够先表达核心观点" : "已经有基本表达主线",
      hasEvidence ? "回答中有支撑信息，可信度更高" : "整体表达自然，继续打磨结构会提升很快"
    ],
    suggestions: [
      "第一句话先讲结论，再用 2-3 个分点展开。",
      "每个分点补一个例子或场景，让内容更具体。",
      "卡顿时先停 1 秒，不要用填充词占位。"
    ],
    thinking_guide: {
      first_think: [
        "先确定你的核心结论。",
        "拆成 2-3 个支持点。",
        "每个点都准备一个例子。"
      ],
      question_type: typeLabel(payload.mode_type),
      recommended_framework: payload.mode_type === "scenario" ? "非暴力沟通" : "PREP",
      outline: [
        "结论：先给出你的判断。",
        "分点一：原因或原则。",
        "分点二：例子或行动。",
        "总结：重申结论。"
      ],
      model_answer:
        normalizeDuration(payload.duration_type) === "1min"
          ? "我的结论是，这个问题的关键在于先明确目标，再快速给出两到三项可执行动作。第一，统一优先级，避免重复投入；第二，建立反馈机制，让问题及时暴露；第三，用具体场景说明方案如何落地。"
          : "我先给结论：解决这个问题，关键不是说得多，而是说得有结构。第一，先明确核心目标，让听者快速知道重点。第二，用两到三个分点展开，每一点只讲一件事。第三，通过案例补足说服力，让内容不空泛。最后，再用一句话收束观点，这样表达会更清楚也更有影响力。"
    },
    rewrites: {
      concise: "我认为，这个问题最重要的是先明确结论，再围绕两到三点展开，避免信息分散。",
      high_logic: "我的结论是：要把这个问题说清楚，需要三步。第一，先讲结论；第二，分点展开；第三，用例子支撑，让表达更有说服力。",
      high_eq:
        payload.mode_type === "scenario"
          ? "我理解当前场景的敏感性，也愿意积极配合。为了让沟通更顺畅，我建议我们先对齐目标，再讨论具体安排。"
          : "如果希望表达更容易被接受，可以先讲结论，再用具体例子解释原因，最后补一句行动建议。"
    },
    summary: overall >= 75 ? "这次表达已经有基础框架了，继续压缩废话、补强例子会更好。" : "先把“结论先行 + 分点展开”练稳，你的进步会很明显。"
  };
}

function clampDemoScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeDuration(value) {
  return String(value || "").includes("3") ? "3min" : "1min";
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("音频编码失败"));
        return;
      }
      resolve(reader.result.split(",")[1] || reader.result);
    };
    reader.onerror = () => reject(new Error("音频读取失败"));
    reader.readAsDataURL(blob);
  });
}

function typeLabel(type) {
  const map = {
    logic: "逻辑表达",
    improv: "即兴表达",
    scenario: "场景表达",
    debate: "辩论",
    roleplay: "角色扮演"
  };
  return map[type] || type;
}

function durationLabel(dur) {
  const map = { "1min": "1 分钟", "3min": "3 分钟", "5min": "5 分钟" };
  return map[dur] || dur || "--";
}

function difficultyLabel(level) {
  const map = {
    beginner: "初级",
    intermediate: "中级",
    advanced: "高级"
  };
  return map[level] || level;
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
