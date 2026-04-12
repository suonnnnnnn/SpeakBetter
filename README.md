# SpeakBetter MVP

基于你的 PRD 实现的可运行 MVP（移动端优先）：
- 题目生成
- 1/3 分钟训练
- 录音上传
- 转写（OpenAI 可选，失败可手动文本兜底）
- AI 评估（OpenAI 可选 + 本地兜底）
- 结果页（评分/标签/建议/框架/改写/示范）
- 历史记录保存

## 1. 目录结构

```text
speakbetter-mvp/
  public/
    index.html
    styles.css
    app.js
  prompts/
    topic_generation.txt
    evaluation.txt
    rewrite.txt
  data/
    sessions.json
    uploads/
  database/
    schema.sql
  server.js
  package.json
  .env.example
```

## 2. 快速启动

Windows：
- 双击 `start-and-open.bat`
- 会自动启动服务并打开正确地址

Windows / macOS 命令行：
```bash
cd speakbetter-mvp
npm run start
```

macOS 也可以：
```bash
cd speakbetter-mvp
chmod +x start-local.sh
./start-local.sh
```

打开地址：
- 电脑浏览器：`http://localhost:5173`
- 手机浏览器（和电脑在同一个 Wi-Fi）：`http://你的电脑局域网IP:5173`

注意：
- 不要再使用 `http://localhost:3000`
- 如果手机打不开，先确认服务绑定的是 `0.0.0.0`，并允许系统防火墙放行 Node

## 3. 启用 OpenAI（可选）

1. 复制环境变量模板：
```bash
copy .env.example .env
```
2. 在 `.env` 中填入：
```env
PORT=5173
HOST=0.0.0.0
OPENAI_API_KEY=你的key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_ASR_MODEL=gpt-4o-mini-transcribe
```
3. 重启服务。

未配置 key 也可运行，系统会自动使用本地兜底策略。

## 4. 关键 API

- `GET /api/health`
- `POST /api/topic/generate`
- `POST /api/session/create`
- `POST /api/session/upload-audio`
- `POST /api/session/transcribe`
- `POST /api/session/evaluate`
- `GET /api/session/:id/result`
- `GET /api/session/history`

## 5. 当前实现说明

- 当前后端为 Node 单体服务（便于本机无 Python 环境快速跑通）。
- 数据持久化为 `data/sessions.json`，并提供了 PostgreSQL `schema.sql` 便于后续迁移。
- Prompt 已独立在 `prompts/`，可直接迭代调优。

## 6. 下一步建议

1. 接入正式鉴权（Supabase Auth/Firebase Auth）。
2. 替换 `sessions.json` 为 PostgreSQL。
3. 增加辩论模式与角色扮演模式 API（P1）。
4. 增加埋点上报与数据看板。
