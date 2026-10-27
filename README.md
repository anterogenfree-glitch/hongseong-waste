# 홍성군 대형폐기물 배출 도우미

스마트폰으로 버릴 물건을 찍으면, 맥미니에서 돌아가는 무료 로컬 AI(Ollama)가 품목을 판별해
**홍성군 조례 별표1의 수수료 스티커 품목·규격·수수료** 또는 **빼기 앱에서 고를 분류 항목**을 안내하는 단계형 웹페이지입니다.
외부 의존성 없이 Node.js 하나로 동작하며, 사진은 맥미니 밖으로 나가지 않습니다.

```
hongseong-waste/
├── server.mjs             정적 파일 서빙 + /api/classify (Ollama 중계)
├── public/                웹페이지 (index.html, styles.css, app.js)
│   ├── data/pricelist.js  조례 별표1 가격표 (품목·규격·수수료·동의어·치수 규칙)
│   ├── data/ppeggi.js     빼기 앱 분류표 (※ 홍성군 분류표 수신 후 교체)
│   ├── data/contacts.js   연락처 (읍·면 번호는 비워 둠 → 채우면 자동 표시)
│   └── assets/symbol.svg  조양문 모티프 심벌
├── setup-mac.sh           맥미니 1회 설치 스크립트
├── com.hongseong.waste.plist  로그인 시 자동 실행(launchd, 선택)
└── .env.example           설정 예시
```

## 1. 맥미니 설치 (한 번만)

```bash
cd ~/hongseong-waste
./setup-mac.sh            # Homebrew → node, ollama, cloudflared 설치 + 모델 다운로드
```

직접 하려면:

```bash
brew install node ollama cloudflared
brew services start ollama
ollama pull qwen2.5vl:7b   # 비전 모델 (약 6GB, 16GB 메모리 권장)
cp .env.example .env
```

| 모델 | 메모리 | 특징 |
|---|---|---|
| `qwen2.5vl:7b` (기본) | 16GB | 한국어·사물 인식 균형 |
| `gemma3:12b` | 24GB 이상 | 더 정확, 느림 |
| `gemma3:4b` | 8GB | 가볍고 빠름, 정확도 낮음 |

모델을 바꾸려면 `.env`의 `OLLAMA_MODEL`만 수정하면 됩니다.

## 2. 실행

```bash
npm start                 # http://localhost:8787
```

같은 와이파이의 스마트폰에서 `http://맥미니IP:8787` 로 접속해 확인하세요.
(맥미니 IP: 시스템 설정 → 네트워크)

AI 없이 화면만 보려면 `npm run mock` (고정 응답).

## 3. 군민에게 공개 (Cloudflare Tunnel, 무료)

임시 주소(재시작할 때마다 바뀜):

```bash
cloudflared tunnel --url http://localhost:8787
```

고정 주소(예: `waste.hongseong.go.kr` 또는 보유 도메인):
1. Cloudflare 계정에 도메인 등록
2. `cloudflared tunnel login` → `cloudflared tunnel create hongseong-waste`
3. `cloudflared tunnel route dns hongseong-waste waste.example.com`
4. `~/.cloudflared/config.yml` 에 `ingress: - hostname: waste.example.com  service: http://localhost:8787`
5. `cloudflared service install` (자동 실행)

터널은 HTTPS를 자동 제공하므로 스마트폰 카메라 촬영(`capture`)이 정상 동작합니다.

## 4. 재부팅해도 자동 실행 (선택)

`com.hongseong.waste.plist`의 `USERNAME`과 경로를 고친 뒤:

```bash
cp com.hongseong.waste.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.hongseong.waste.plist
```

Ollama는 `brew services start ollama` 로 이미 자동 실행됩니다.

## 5. 데이터 수정

- **가격표** `public/data/pricelist.js`: `specs: [["규격", 수수료]]`, 수수료 `null` = 면제.
  `aliases`에 군민이 쓰는 다른 이름(소파/쇼파 등)을 넣으면 AI 결과 매칭과 검색에 사용됩니다.
  `sizeRule`은 입력 치수(cm)로 규격을 자동 추천하는 규칙입니다.
- **빼기 분류표** `public/data/ppeggi.js`: 대분류 → 타일 → 품목. `ref`는 조례 품목 id(수수료·규격 공유), `inferred: true`는 캡처에서 가려져 추정한 위치입니다. 앱과 다르면 해당 품목을 다른 타일로 옮기세요.
- **연락처** `public/data/contacts.js`: 읍·면 `phone`을 채우면 메인·완료 화면에 표시됩니다.

## 6. 동작 방식

1. 메인에서 스티커 / 빼기 앱 선택
2. 연락처·법적 안내 확인 후 체크박스 동의 → 시작
3. 사진 촬영(브라우저에서 1024px로 축소) + 치수(선택) 입력
4. `/api/classify` → Ollama 비전 모델이 **목록 안에서만** 품목을 고름(JSON 강제)
5. 결과 카드: 품목·규격 칩(치수로 자동 추천)·수수료, 다른 후보, 목록 직접 찾기
6. 다음 할 일 + 요약 복사

AI가 꺼져 있거나 느리면 자동으로 "목록에서 직접 찾기"로 안내해 서비스가 끊기지 않습니다.

## 7. 문제 해결

| 증상 | 조치 |
|---|---|
| 입력 화면에 "AI 서버에 연결되지 않았습니다" | `brew services restart ollama`, `.env`의 `OLLAMA_URL` 확인 |
| "모델이 설치되지 않았습니다" | `ollama pull qwen2.5vl:7b` |
| 판별이 60초 이상 | 더 작은 모델(`gemma3:4b`)로 변경 |
| 스마트폰에서 카메라가 안 열림 | HTTP(내부망)에서는 사진 선택만 가능. Cloudflare Tunnel(HTTPS)로 접속 |
| 로그 | `server.log` 또는 터미널 출력 |

## 8. 외부 호스팅(GitHub Pages) + 맥미니 AI 조합

웹페이지를 GitHub Pages에 올리고(저장소에 push 하면 `.github/workflows/pages.yml`이 자동 배포), AI만 맥미니에서 돌릴 수도 있습니다.

1. 맥미니: `npm start` 후 `cloudflared tunnel --url http://localhost:8787` → 터널 주소 확인
2. 스마트폰에서 Pages 주소 뒤에 한 번만 `?api=터널주소` 를 붙여 엽니다.
   예: `https://아이디.github.io/hongseong-waste/?api=https://xxxx.trycloudflare.com`
3. 이후에는 주소 없이 열어도 저장된 AI 서버로 연결됩니다. (서버는 CORS 허용 설정됨)

맥미니가 꺼져 있으면 AI 판별만 비활성화되고 목록 조회는 계속 동작합니다.
