#!/bin/bash
# 로그인·재부팅 시 서버(node)와 Cloudflare 터널(cloudflared)이 자동 실행되도록 launchd 에 등록합니다.
# 사용: ./install-launchd.sh        (다시 실행하면 재등록)
set -e
cd "$(dirname "$0")"
DIR="$(pwd)"
NODE="$(command -v node || true)"
CF="$(command -v cloudflared || true)"
[ -n "$NODE" ] || { echo "node 를 찾을 수 없습니다. ./setup-mac.sh 를 먼저 실행하세요."; exit 1; }
[ -n "$CF" ]   || { echo "cloudflared 를 찾을 수 없습니다. ./setup-mac.sh 를 먼저 실행하세요."; exit 1; }
AGENTS="$HOME/Library/LaunchAgents"
mkdir -p "$AGENTS"

# 같은 이름으로 손으로 띄워 둔 프로세스가 있으면 정리 (포트 충돌 방지)
pkill -f "node $DIR/server.mjs" 2>/dev/null || true
pkill -f "node server.mjs" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://localhost:8787" 2>/dev/null || true

for name in com.hongseong.waste com.hongseong.tunnel; do
  src="$DIR/$name.plist"; dst="$AGENTS/$name.plist"
  launchctl unload "$dst" 2>/dev/null || true
  sed -e "s|/Users/USERNAME/hongseong-waste|$DIR|g" \
      -e "s|/opt/homebrew/bin/node|$NODE|g" \
      -e "s|/opt/homebrew/bin/cloudflared|$CF|g" "$src" > "$dst"
  launchctl load "$dst"
  echo "등록: $dst"
done

echo "자동 실행 등록 완료. 상태: launchctl list | grep hongseong"
