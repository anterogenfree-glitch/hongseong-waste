#!/bin/bash
# 실제 판별 테스트: 사진 1장을 /api/classify 에 보내고 응답(JSON)과 소요 시간을 출력합니다.
# 사용: ./test-classify.sh 사진.jpg [서버주소(기본 http://localhost:8787)]
set -e
IMG="$1"; API="${2:-http://localhost:8787}"
[ -f "$IMG" ] || { echo "사용: $0 사진.jpg [서버주소]"; exit 1; }
case "$IMG" in *.png|*.PNG) MIME=image/png;; *) MIME=image/jpeg;; esac
B64=$(base64 < "$IMG" | tr -d '\n')
printf '{"mode":"sticker","image":"data:%s;base64,%s","names":["냉장고","쇼파","책장","의자","침대","식탁","세탁기","텔레비전","그 외 봉투에 담기 어려운 폐기물"]}' "$MIME" "$B64" > /tmp/hs-classify.json
echo "▶ $API/api/classify 로 전송 중 (첫 요청은 모델 적재로 30~90초 걸릴 수 있음)…"
START=$(date +%s)
curl -s --max-time 180 -H 'content-type: application/json' --data-binary @/tmp/hs-classify.json "$API/api/classify"
echo
echo "소요: $(( $(date +%s) - START ))초"
