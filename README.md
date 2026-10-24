# Spot — 0단계 결과물

행사장에서 패널과 관심 있는 사람을 쉽게 찾고 대화를 연결하는 실시간 네트워킹 서비스의 **0단계: 화면과 틀**입니다.

지금은 **가짜 데이터로 끝까지 눌러 볼 수 있는 상태**입니다. 서버(Convex)와 AI(Claude)는 아직 연결되어 있지 않고, 같은 동작을 브라우저 안에서 흉내 냅니다. 1단계부터 이 흉내 부분을 하나씩 진짜로 바꾸면 됩니다.

---

## 실행 방법

1. Node.js 20 이상 설치 (`node -v`로 확인)
2. 압축을 풀고 폴더에서 터미널 열기
3. 설치와 실행
   ```
   npm install
   npm run dev
   ```
4. 브라우저에서 http://localhost:3000 열기
5. 폰처럼 보려면 개발자 도구(F12) → 기기 모드(Ctrl+Shift+M)

---

## 들어 있는 것

| 0단계 할 일 | 위치 |
|---|---|
| 가짜 데이터로 누르면 넘어가는 화면 전체 | `src/components/screens/` |
| 데이터 표: 사용자, 구역, 대화 요청, 행사 (+ 지표 기록용 activity) | `convex/schema.ts` |
| 추천 프롬프트 초안 | `prompts/recommend.md` |

### 화면 목록

- **Welcome**: 시작 화면
- **Onboarding**: 유형 선택(패널 / 참석자) → 프로필, 관심사, 인상착의(6단어 제한), 공개 동의
- **ZonePicker**: 구역 선택 (구역 코드 + 기물 설명)
- **Discover** (참석자 홈): 떠나기 직전 보드, 추천 3명, 전체 패널 목록과 필터
- **Zones / ZoneDetail**: 구역별 패널·참석자
- **PanelDetail**: 패널 상세, 대화 요청, 내 대기 순서
- **MyRequests**: 내 요청 (수락됨 / 대기 중 / 지난 요청)
- **PanelNow** (패널 홈): 원터치 상태 버튼, 떠나는 시간, 요청 받기 일시정지, 대기열 수락
- **Me**: 프로필, 구역, 인상착의 수정, 숨기기, 지표, 데모 컨트롤

### 데모 컨트롤 (Me 화면 맨 아래)

- **View the app as**: 내 계정 / Dana(패널) / Lena(참석자)로 바꿔 보기. 폰 한 대로 양쪽 화면을 다 볼 수 있습니다.
- **A speaker accepts my request**: 내 요청이 수락된 상황 만들기
- **A speaker I'm waiting for leaves in 10 min**: 떠나기 알림 상황 만들기
- **Reset demo**: 처음 상태로

---

## 폴더 구조

```
convex/
  schema.ts            Convex 데이터 표 정의
prompts/
  recommend.md         추천 프롬프트 초안
src/
  app/                 Next.js 진입점 (layout, page, 전역 CSS)
  components/
    App.tsx            화면 전환
    ui.tsx             공통 부품 (상태 표시, 구역 배지, 버튼, 탭바, 알림)
    screens/           화면들
  lib/
    types.ts           데이터 타입 (schema.ts와 같은 모양)
    mockData.ts        가짜 데이터, 구역 목록, 관심사 목록
    store.tsx          지금의 "가짜 서버" (상태와 동작 전부)
    recommend.ts       규칙 기반 추천 (AI 실패 시 대체용으로 계속 사용)
    time.ts            시간 표시, 정보 신선도 기준(15분), 떠나기 알림 기준(10분)
```

---

## 1단계부터 바꿀 곳

화면은 `useApp()` 하나로 데이터를 읽고 동작을 부릅니다. 그래서 `store.tsx`의 동작을 Convex 함수로 하나씩 바꾸면 화면은 거의 그대로 둘 수 있습니다.

| 지금 (`store.tsx`) | 바꿀 Convex 함수 | 단계 |
|---|---|---|
| `completeOnboarding` | mutation `users.create` | 1 |
| `updateMe` (구역, 인상착의, 숨기기, 요청 일시정지) | mutation `users.update` | 1 |
| `setStatus`, `setLeaving` | mutation `users.setStatus` | 1 |
| `state.users` 읽기 | query `users.listByEvent` | 1 |
| `requestChat` | mutation `chatRequests.create` | 2 |
| `setRequestStatus` (수락, 거절, 만남, 취소) | mutation `chatRequests.setStatus` | 2 |
| `state.requests` 읽기 | query `chatRequests.forPanel`, `chatRequests.forAttendee` | 2 |
| `runScheduled` (10초마다 확인하는 흉내) | `ctx.scheduler.runAt`: 떠나기 10분 전 알림, 떠나는 시각에 대기 요청을 missed로 | 3 |
| (없음) | 행사 종료 시각에 위치·상태 삭제하는 예약 작업 | 3 |
| `localRecommendations` | action `recommend.forMe` (Claude 호출, 실패 시 지금 함수로 대체) | 4 |
| `log` | mutation `activity.log` | 5 |
| `viewAs`, `simulate...` | 데모용. 실제 연결 후에는 폰 여러 대로 대신 | — |

알림(Toast)은 지금처럼 앱 화면 안 배너로 둡니다. 알림 권한이 없어도 동작합니다.

---

## 1단계 시작: Convex 연결

```
npx convex dev
```

처음 실행하면 로그인과 프로젝트 생성을 묻습니다. 끝나면 `convex/_generated/` 폴더와 `.env.local`(주소)이 자동으로 생깁니다. 이 명령은 개발하는 동안 켜 둡니다.

`.env.local`과 API 키는 GitHub에 올라가지 않도록 `.gitignore`에 이미 들어 있습니다.

### Claude Code에 줄 지시문 (1단계)

```
이 프로젝트는 Next.js 16 + Convex 앱이야. 먼저 AGENTS.md와 README.md를 읽어줘.
지금 src/lib/store.tsx가 가짜 서버 역할을 하고 있어. 1단계로 사용자 부분만 Convex로 옮겨줘.

1. ConvexReactClient로 Provider를 만들어 src/components/App.tsx의 AppProvider 바깥을 감싸줘.
2. convex/users.ts에 create, update, setStatus mutation과 listByEvent query를 만들어줘.
   필드와 타입은 convex/schema.ts를 그대로 따라.
3. 앱 시작 시 events와 zones 표가 비어 있으면 src/lib/mockData.ts의 ZONES와 행사 정보로 한 번 채우는 mutation을 만들어줘.
4. store.tsx에서 completeOnboarding, updateMe, setStatus, setLeaving과 users 읽기를 위 함수로 바꿔줘.
   대화 요청(requests)은 아직 가짜 데이터 그대로 둬.
5. 화면 파일(src/components/screens)은 꼭 필요한 곳만 고쳐줘.
6. 폰 두 대(브라우저 창 두 개)에서 한쪽이 상태를 바꾸면 다른 쪽에 바로 보이는지 확인하는 방법을 알려줘.
```

---

## 디자인 메모

- 구역은 행사장 안내 표지판처럼 짙은 남색 사각형에 알파벳 코드로 표시합니다.
- 상태 색은 초록(대화 가능) / 빨강(대화 중) / 노랑(곧 떠남) 세 가지만 씁니다.
- "Leaving soon" 보드는 공항 출발 안내판처럼 남은 분을 크게 보여 줍니다.
- 다크 모드는 기기 설정을 자동으로 따릅니다.
- 글꼴은 고속도로 표지판 서체에서 출발한 Overpass(Google Fonts)를 씁니다.
