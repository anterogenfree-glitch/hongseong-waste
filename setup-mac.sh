#!/bin/bash
# 홍성군 대형폐기물 도우미 — 맥미니 1회 설치 + 실행 + 자동 실행 등록 스크립트 (모두 무료)
# 사용: chmod +x setup-mac.sh && ./setup-mac.sh
#   모델 지정:  OLLAMA_MODEL=gemma3:4b ./setup-mac.sh
#   설치만:     SKIP_LAUNCHD=1 ./setup-mac.sh
set -e
cd "$(dirname "$0")"

# 메모리에 따라 모델 자동 선택 (8GB 이하 → gemma3:4b, 그 외 → qwen2.5vl:7b)
MEM_GB=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1024 / 1024 / 1024 ))
if [ -z "$OLLAMA_MODEL" ]; then
  if [ "$MEM_GB" -gt 0 ] && [ "$MEM_GB" -le 8 ]; then OLLAMA_MODEL="gemma3:4b"; else OLLAMA_MODEL="qwen2.5vl:7b"; fi
fi
MODEL="$OLLAMA_MODEL"
echo "▶ 메모리 ${MEM_GB}GB → 모델 $MODEL"

echo "▶ Homebrew 확인"
if ! command -v brew >/dev/null; then
  echo "  Homebrew 설치 중 (관리자 비밀번호를 물어볼 수 있습니다)"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
[ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"

echo "▶ Node.js / Ollama / cloudflared 설치"
brew list node >/dev/null 2>&1 || brew install node
brew list ollama >/dev/null 2>&1 || brew install ollama
brew list cloudflared >/dev/null 2>&1 || brew install cloudflared

echo "▶ Ollama 서비스 시작 (로그인 시 자동 실행)"
brew services start ollama || true
for i in $(seq 1 20); do curl -s localhost:11434/api/tags >/dev/null 2>&1 && break; sleep 1; done

echo "▶ 비전 모델 내려받기: $MODEL (수 GB, 수 분 소요)"
ollama pull "$MODEL"

echo "▶ .env 생성"
[ -f .env ] || cp .env.example .env
sed -i '' "s|^OLLAMA_MODEL=.*|OLLAMA_MODEL=$MODEL|" .env

if [ "$SKIP_LAUNCHD" = "1" ]; then
  cat <<MSG

설치 완료. 실행:
  npm start                                        # http://localhost:8787
  cloudflared tunnel --url http://localhost:8787   # 외부 공개(임시 주소)
자동 실행 등록: ./install-launchd.sh
MSG
  exit 0
fi

echo "▶ 서버 + 터널 자동 실행 등록 (launchd)"
chmod +x install-launchd.sh test-classify.sh
./install-launchd.sh

echo "▶ 서버 상태 확인"
HEALTH=""
for i in $(seq 1 30); do HEALTH=$(curl -s localhost:8787/api/health || true); [ -n "$HEALTH" ] && break; sleep 1; done
echo "  $HEALTH"
echo "$HEALTH" | grep -q '"modelInstalled":true' || echo "  ⚠ modelInstalled 가 true 가 아닙니다. 'ollama list' 로 모델명을 확인해 .env 의 OLLAMA_MODEL 을 고친 뒤 ./install-launchd.sh 를 다시 실행하세요."

echo "▶ 터널 주소 확인 (최대 60초)"
URL=""
for i in $(seq 1 60); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' tunnel.log 2>/dev/null | tail -1)
  [ -n "$URL" ] && break; sleep 1
done
if [ -n "$URL" ]; then
  echo "  $URL"
  echo "  외부 접속 확인: $(curl -s --max-time 15 "$URL/api/health" || echo '(아직 응답 없음 — 몇 초 뒤 다시 시도)')"
else
  echo "  ⚠ 아직 주소가 없습니다. 잠시 후: grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' tunnel.log | tail -1"
fi

cat <<MSG

======================================================================
완료!
 1) AI 서버 터널 주소:  ${URL:-(tunnel.log 참고)}
 2) 스마트폰에서 https://anterogenfree-glitch.github.io/hongseong-waste/ 열기
    → 사진 입력 화면 → "서버 주소 설정"에 위 주소 붙여넣기 → "연결"
    → 초록 점 "AI 서버 연결됨" 으로 바뀌면 끝
 3) 맥미니를 재부팅해도 서버·터널·Ollama 가 자동 실행됩니다.
    (임시 터널 주소는 재시작 때마다 바뀜 → 주소 확인:
     grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' ~/hongseong-waste/tunnel.log | tail -1)
 판별 테스트:  ./test-classify.sh 사진.jpg
======================================================================
MSG
