#!/bin/bash
# 홍성군 대형폐기물 도우미 — 맥미니 1회 설치 스크립트
# 사용: chmod +x setup-mac.sh && ./setup-mac.sh
set -e
MODEL="${OLLAMA_MODEL:-qwen2.5vl:7b}"

echo "▶ Homebrew 확인"
if ! command -v brew >/dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

echo "▶ Node.js / Ollama / cloudflared 설치"
brew list node >/dev/null 2>&1 || brew install node
brew list ollama >/dev/null 2>&1 || brew install ollama
brew list cloudflared >/dev/null 2>&1 || brew install cloudflared

echo "▶ Ollama 서비스 시작 (로그인 시 자동 실행)"
brew services start ollama || true
sleep 3

echo "▶ 비전 모델 내려받기: $MODEL (수 GB, 수 분 소요)"
ollama pull "$MODEL"

echo "▶ .env 생성"
[ -f .env ] || { cp .env.example .env; sed -i '' "s|^OLLAMA_MODEL=.*|OLLAMA_MODEL=$MODEL|" .env; }

cat <<MSG

완료! 실행:
  npm start                      # http://localhost:8787
외부 공개(임시 주소):
  cloudflared tunnel --url http://localhost:8787
자동 실행 등록(선택): README.md 의 launchd 항목 참고
MSG
