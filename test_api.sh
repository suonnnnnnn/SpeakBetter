#!/bin/bash
BASE="https://speak-better-ten.vercel.app"

echo "=== 1. health ==="
curl -s --max-time 10 "$BASE/api/health"
echo ""

echo "=== 2. create session ==="
RESP=$(curl -s --max-time 10 -X POST "$BASE/api/session/create" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","modeType":"logic","durationType":"1min","topic":{"title":"T","content":"Q","topic_type":"logic","difficulty":"intermediate","suggested_framework":"PREP","recommended_duration":"1min","training_goal":"logic"}}')
echo "$RESP"
SESSION_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session',{}).get('id',''))" 2>/dev/null)
echo "session_id: $SESSION_ID"

echo ""
echo "=== 3. transcribe with text ==="
curl -s --max-time 15 -X POST "$BASE/api/session/transcribe" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"transcriptText\":\"我认为团队效率低的原因，首先是目标不清晰，其次是沟通机制缺失\"}"
echo ""

echo "=== 4. evaluate ==="
curl -s --max-time 30 -X POST "$BASE/api/session/evaluate" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}"
echo ""