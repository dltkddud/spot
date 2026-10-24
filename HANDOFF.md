# Spot 인수인계 문서

> 이 파일만 읽으면 어느 컴퓨터에서든 바로 이어서 작업할 수 있게 정리한 문서입니다.
> Claude Code는 `CLAUDE.md`를 통해 이 파일을 자동으로 읽습니다.
> 단계를 끝낼 때마다 아래 **5. 진행 상황**과 **11. 진행 로그**를 업데이트해 주세요.

마지막 업데이트: 2026-10-24 07:21 PT

---

## 0. 30초 요약

- **무엇**: 행사장에서 대화하고 싶은 패널(발표자·프로덕트 제작자)을 놓치지 않게 돕는 실시간 네트워킹 웹앱 **Spot**
- **어디까지**: 화면 전체 완성, 사용자·대화 요청·떠나기 알림·행사 종료 정리까지 Convex로 연결, Vercel 배포 완료 (Stage 0~3). 평면도·파란색 디자인, **Huddle**(같은 줄의 관심사 겹치는 사람끼리 함께 만나기), **Connections**(미리 연결한 사람과 구역 자동 공유) 적용
- **데모 주소**: https://spot-psi-two.vercel.app
- 행사 종료 시각은 일 10/25 16:00 PT로 고정됨 (`EVENT_ENDS_AT`, 8-1 완료)
- **그다음**: Stage 4 AI 추천 (Claude API 키 필요)

---

## 1. 대회 정보

| 항목 | 내용 |
|---|---|
| 대회 | Cal Hacks 13.0, Palace of Fine Arts (SF) |
| 기능 동결 | 토 10/24 19:00 (이후 버그 수정, 영상, Devpost만) |
| 도착 | 일 10/25 08:00까지 행사장 |
| **제출 마감** | **일 10/25 09:00 PT** Devpost (팀원 전원 추가, 테이블 번호 포함). 10:00까지 수정 가능 |
| 심사 | 일 10:30~12:30, 팀원 전원 테이블에 있어야 함. 피치 3분 + 질의응답 2분 |
| 제출물 | 프로젝트 이미지, GitHub 저장소, 데모 영상(유튜브 일부 공개, 2분 안팎), 라이브 데모 |
| 심사 기준 | 실용성, 의도성, 기능성, 창의성, 기술적 복잡도 |
| 노리는 트랙 | Convex, Apify, Anthropic(Claude for Public Benefit), People-First Social Impact |
| 안 쓰는 것 | Meta API, Cartesia, 실제 안경 |

Anthropic 트랙은 Devpost 목록에 아직 없어서 Slack Anthropic 채널에 제출 방법을 문의해 둔 상태.

---

## 2. 제품

**한 줄**: *Find the right person before they leave.* (적절한 사람을 그들이 떠나기 전에 찾으세요.)

**문제**
- 좋은 발표를 듣고 대화하고 싶어도, 그 사람이 어디 있는지 모른다.
- 다른 사람과 이야기하는 사이에 떠나 버린다. 떠나는 쪽은 "더 얻을 게 없다"고 생각해서 먼저 간다.
- 행사장이 넓고, 얼굴이 정확히 기억나지 않는다.

**타깃**: SF 테크 행사에 열정을 갖고 가지만, 인맥이 없어 원하는 사람을 놓치는 비원어민 학생 (우리 팀 자체가 당사자)

**사용자 유형**
- **패널** (`role: "panel"`): 발표자, 패널, 프로덕트 제작자. 위치와 상태를 공개하고 대화 요청을 받는다.
- **참석자** (`role: "attendee"`): 패널을 찾아 대화를 요청한다.

**핵심 기능**
1. 구역 표시: 행사장을 큰 구역 + 눈에 띄는 기물로 나누고, 사용자가 직접 고른다. (GPS 안 씀)
2. 상태: 초록(대화 가능) / 빨강(대화 중) / 노랑(곧 떠남), 원터치
3. 오늘의 인상착의: 옷과 소지품만, 6단어 이하
4. 대화 요청 + 대기 순서, 패널이 요청자 프로필을 보고 수락
5. 패널 화면에 대기 인원 표시 (떠나지 않을 이유)
6. 떠나기 10분 전 알림, 떠나는 시각에 남은 요청은 "놓침"으로
7. 행사 종료 시 구역·상태 자동 삭제 (프로필은 유지)
8. AI 추천: 관심사·상대 소개·상태·구역으로 지금 만나면 좋을 패널 3명과 이유 (Stage 4)
9. **Huddle**: "줄을 서는 앱이 아니라 더 많은 연결을 만드는 앱". 같은 패널을 기다리는 참석자 중 관심사가 겹치는 사람(최대 3명)에게 함께 만나자고 제안. 모두 수락하면 가장 앞선 멤버의 순서로 합쳐지고, 패널은 묶음 카드 하나로 수락·만남 처리
10. **Connections**: 에어태그처럼 미리 연결해 둔 사람에게 내가 고른 구역을 자동 공유 (GPS 없음). 6자리 코드·초대 링크(`?connect=코드`)로 연결, 위치 공개 범위 Everyone / Only my connections / No one

**원칙**: 동의한 사용자만 표시, 구역 단위로만, 자동 위치 추적·얼굴 인식 없음, 언제든 숨기기, 행사 종료 후 삭제

**화면 문구는 영어** (심사위원용). 대화와 문서는 한국어.

---

## 3. 링크와 계정

| 항목 | 값 |
|---|---|
| 데모 (Production) | https://spot-psi-two.vercel.app |
| GitHub | https://github.com/dltkddud/spot (Private, 브랜치 `main`) |
| Convex 팀 / 프로젝트 | `dltkddud's team` / `spot` |
| Convex Production | `rosy-raccoon-768` (데모 주소가 쓰는 데이터) |
| Convex Development | 사람마다 따로 생김. 예: `clear-duck-485` (dltkddud 노트북) |
| Vercel | 팀 `Spot` (Hobby) / 프로젝트 `spot`. `main`에 push하면 자동 배포 |
| Vercel Build Command | `npx convex deploy --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --cmd 'npm run build'` |
| Vercel 환경 변수 | `CONVEX_DEPLOY_KEY` (Production 배포 키, Secret) |
| Claude API | Anthropic이 팀원당 $50 크레딧 지원. 키는 Convex 환경 변수로만 저장 |

**비밀값 규칙**: API 키, 배포 키는 코드·`.env.local`·GitHub·단톡에 절대 올리지 않는다. Convex 환경 변수와 Vercel 환경 변수에만 저장한다.

---

## 4. 기술 구조

**스택**: Next.js 16.4.3 (App Router), React 19, Tailwind CSS v4, Convex 1.48, TypeScript

**데이터 흐름**
```
화면(src/components/screens/*)
   └─ useApp()  ← src/lib/store.tsx
        ├─ useQuery(api.*)    읽기, 실시간 자동 갱신
        └─ useMutation(api.*) 쓰기
              └─ convex/*.ts  (Convex 서버)
```
- **하단 탭**: 게스트는 Explore / Requests / Me, 패널은 Now / Explore / Requests / Me.
  - Explore: 위쪽 People / Map 전환. People은 Your people, 내 위치, Leaving soon, Picked for you, 전체 목록(필터). Map은 평면도와 구역 목록. 구역·패널 상세도 Explore 탭 안.
  - Requests: 내가 보낸 요청과 그 요청의 Huddle(제안은 카드 안에서 바로 Huddle up).
  - Now: 패널 전용(대기열, 상태, 떠나는 시간, 요청 일시정지, 묶인 Huddle 카드).
  - 패널도 다른 패널에게 요청할 수 있다(자기 자신은 서버에서 막음). Huddle 매칭은 역할과 상관없이 같은 줄에 선 사람끼리.
- **화면은 Convex를 직접 부르지 않는다.** 모든 읽기·쓰기는 `store.tsx`를 거친다. 새 기능도 store에 동작을 추가하고 화면은 `useApp()`으로 쓴다.
- 앱은 클라이언트에서만 렌더링한다 (`src/app/ClientApp.tsx`의 `dynamic(..., { ssr: false })`).
- **노트북에서는 휴대폰 프레임 안에서 동작**한다 (`PhoneFrame.tsx`). 가로 640px 이상이고 홈 화면 앱이 아니면 390×844 프레임을 띄우고, 화면이 낮으면 비율을 유지한 채 줄인다. 폰이나 홈 화면 앱은 프레임 없이 전체 화면.
  - 프레임의 화면 영역에 `transform`이 걸려 있어 `position: fixed`(탭바, 알림 배너)가 브라우저 창이 아니라 프레임에 붙는다. 스크롤은 `#spot-scroll`에서만 일어난다.
  - 화면 높이·안전 영역은 CSS 변수로 쓴다: `min-h-[var(--app-h)]`, `top-[var(--safe-top)]`, `var(--safe-bottom)`. `min-h-dvh`나 `env(safe-area-inset-*)`를 새로 쓰지 말 것.
  - 화면 맨 위로 스크롤할 때는 `window.scrollTo` 대신 `scrollAppToTop()`.
- **로그인 없음**: `users.create`가 돌려준 내 id를 localStorage(`spot.myUserId`)에 저장해 새로고침해도 이어진다. 브라우저마다 다른 계정.
- **행사는 하나라고 가정**: 앱 시작 시 `seed.ensure`가 행사·구역·예시 사람·예시 요청을 비어 있을 때만 채운다.

**폴더**
```
convex/
  schema.ts         표: events, zones, users, chatRequests, activity
  events.ts         current(행사+구역 읽기), scheduleEventEnd, endEvent(종료 시 정리)
  users.ts          create, update, setStatus, listByEvent
  chatRequests.ts   create, setStatus, forPanel, forAttendee, activeByEvent (요청이 바뀌면 Huddle 매칭·해산 호출)
  huddles.ts        proposeFor(매칭), afterRequestChange, dissolveAllFor, respond, setGroupStatus, demoPropose, forAttendee, forPanel
  connections.ts    connect·disconnect, ensureCode, connectByCode, remove, demoFriends, mine
  activity.ts       record (서버 기록), summary (행사 전체 숫자)
  leaving.ts        scheduleLeaving, warn(10분 전), leave(떠나는 시각)
  seed.ts           ensure(처음 채우기), resetDemo(데모 초기화)
  _generated/       자동 생성. 직접 고치지 않음. GitHub에 같이 올림
prompts/
  recommend.md      Stage 4 추천 프롬프트 초안 (입력·출력 JSON 형식 포함)
src/
  app/              layout, page, ClientApp, globals.css(색 토큰), icon.svg(핀 파비콘)
  components/
    App.tsx         ConvexProvider, 화면 전환
    ui.tsx          아이콘, 핀 로고·구역 배지, 버튼, 탭바, 알림 배너
    FloorPlan.tsx   평면도 위 구역 핀, 구역 확대 보기
    Huddle.tsx      참석자용 Huddle 카드(제안·대기·완성), 패널용 묶음 카드
    ZoneIcon.tsx    구역 아이콘 7개(24 격자, 선 두께 2)와 ZoneMark(핀 안 아이콘 + 코드 배지). 구역이 나오는 모든 곳에서 사용
    PhoneFrame.tsx  노트북용 휴대폰 프레임(상태바, 축소 맞춤), scrollAppToTop
    Connections.tsx Your people 줄, 위치 공개 범위 선택, Connect with friends(코드·링크 복사·코드 입력·연결 목록)
    screens/        Welcome, Onboarding, ZonePicker, Explore(People/Map 전환),
                    Discover(Explore의 People), Zones(Explore의 Map, 구역 상세), PanelDetail,
                    MyRequests(Requests 탭), PanelNow(패널 Now 탭), Me(설정·지표·데모 컨트롤)
  lib/
    store.tsx       모든 상태와 동작. Convex 연결 지점
    types.ts        데이터 타입
    mockData.ts     구역 목록, 관심사 목록, 예시 사람·요청, makeEvent(종료 시각 고정)
    floorplan.ts    public/floorplan.png 위 구역 핀 좌표(원본 이미지 픽셀, 구역 코드 기준)와 구역별 아이콘 이름
    recommend.ts    규칙 기반 추천 (AI 실패 시 대체용)
    time.ts         시간 표시, 신선도 기준 15분, 떠나기 알림 기준 10분
```

**Convex 함수 요약**

| 함수 | 종류 | 하는 일 |
|---|---|---|
| `events.current` | query | 행사와 구역 |
| `users.create` | mutation | 가입. 인상착의 1~6단어 검사 |
| `users.update` | mutation | 구역, 인상착의, 공개 여부, 요청 일시정지 |
| `users.setStatus` | mutation | 대화 가능/대화 중/떠남(`leavingInMin`). 떠남이면 예약 2개 생성 |
| `users.listByEvent` | query | 행사 참가자 전체. `visible`을 보는 사람 기준으로 계산(모두 공개 또는 연결된 사람에게만 공개면 true), 안 보이면 구역을 지워서 반환. 연결 코드는 본인에게만 |
| `connections.connectByCode` | mutation | 친구 코드 입력·초대 링크로 연결 (코드를 건넨 쪽이 동의한 것으로 봄) |
| `connections.remove` / `ensureCode` / `demoFriends` | mutation | 연결 끊기 / 예전 계정에 코드 만들기 / 데모 친구 2명(Maya, Leo) 연결 |
| `connections.mine` | query | 내 연결 목록 (누가 연결했는지 `by` 포함) |
| `chatRequests.create` | mutation | 요청. 중복·일시정지·떠난 패널 서버에서 차단 |
| `chatRequests.setStatus` | mutation | 수락/거절/만남/취소/놓침. 누가 무엇을 바꿀 수 있는지 서버에서 검사 |
| `chatRequests.forPanel` | query | 패널의 대기열 (메모 포함) |
| `chatRequests.forAttendee` | query | 참석자 본인의 요청 전체 |
| `chatRequests.activeByEvent` | query | 행사 전체의 열린 요청 (누가 했는지·메모 제외). 대기 인원·순서 계산용 |
| `leaving.warn` / `leaving.leave` | internal | 떠나기 10분 전 표시 / 떠나는 시각에 Huddle 해산, 요청 missed, 패널 숨김 |
| `huddles.respond` | mutation | "Huddle up" / "Not this time". 모두 Yes면 formed, 한 명이라도 No면 declined |
| `huddles.setGroupStatus` | mutation | 패널이 Huddle 전체를 한 번에 수락/거절/만남/놓침 |
| `huddles.demoPropose` | mutation | 데모 버튼. 내 줄에 관심사가 겹치는 예시 참석자를 넣고 제안 |
| `huddles.forAttendee` / `forPanel` | query | 내 Huddle(제안·완성·연결 질문 대기) / 패널 줄의 완성된 Huddle |
| `activity.summary` | query | 행사 전체 활동 숫자 (Me 화면 Huddles formed, Connections made) |
| `events.endEvent` | internal | 종료 시각에 모두의 구역·상태·떠나는 시간 삭제 |
| `seed.ensure` / `seed.resetDemo` | mutation | 처음 채우기(기존 행사는 종료 시각·구역 이름만 맞춤) / 데모 초기화(빠진 예시 사람 추가, 실제 가입자는 건드리지 않음) |

**예약 작업 설계**: 떠나는 시간이나 종료 시각이 바뀌면 새로 예약하고, 예전 예약은 실행될 때 값이 다르면 아무것도 하지 않는다. Convex 대시보드 → Schedules에서 볼 수 있다.

**알림**: 앱 화면 안 배너(Toast)만 쓴다. 폰 푸시 알림 없음.

**Huddle 설계**
- 표: `huddles`(패널, 상태 proposed/formed/met/declined/dissolved, 겹치는 관심사), `huddleMembers`(멤버별 요청 id, 응답), `connections`(연결, 방향마다 한 줄).
- 매칭(`proposeFor`)은 요청 생성·취소·거절, Huddle 거절, "Open to huddles" 켜기 때 서버가 다시 돌린다. 먼저 진행 중인 제안(3명 미만)에 합류시키고, 그다음 가장 오래 기다린 사람부터 관심사가 가장 많이 겹치는 사람과 묶는다. 같은 패널에서 이미 제안된 두 사람은 다시 묶지 않는다.
- 완성되면 멤버 요청에 `huddleId`와 `lineAt`(가장 앞선 멤버의 요청 시각)이 붙고, 대기 순서는 Huddle을 한 자리로 계산한다(`store.tsx`의 `positionInQueue`).
- 멤버가 취소되거나 거절·놓침되면, 또는 패널이 떠나면 해산되고 각자 원래 요청으로 돌아간다.
- 제안에는 이름·한 줄 소개·겹치는 관심사·인상착의만 보이고, 메모는 패널만 본다.

**Connections 설계**
- `users.shareWith`(everyone/connections/nobody)와 기존 `visible`은 항상 같이 바뀐다. `visible`은 "모두에게 보임"이고, 서버 검사(요청 받기 등)는 지금처럼 `visible`을 쓴다.
- `listByEvent`가 보는 사람(`viewerId`, View as 중이면 그 사람) 기준으로 `visible`을 다시 계산하므로, 화면은 지금처럼 `u.visible`만 보면 된다.
- 초대 링크로 들어오면 `?connect=`를 localStorage(`spot.pendingConnect`)에 옮기고 주소에서 지운 뒤, 계정이 생기면 자동으로 연결한다.
- `connections`는 방향마다 한 줄. `by`가 연결을 만든 사람이라 상대에게만 "… connected with you" 배너가 뜬다.

**데이터 마이그레이션**: 구조를 바꾸면 `seed.ts`의 `runOnce(ctx, "이름", ...)`로 `seed.ensure` 안에 넣는다. 앱을 여는 순간 Development·Production 모두 한 번씩 실행되고 `migrations` 표에 기록돼 다시 돌지 않는다. 지운 필드는 스키마에 optional로 남겨 두고(주석 참고), 두 곳 모두 마이그레이션이 돈 뒤 스키마에서 지운다.

**디자인 토큰**: 색은 `globals.css`의 변수만 쓴다. 주요 버튼·강조 `primary`(파랑), 보조 `primary-soft`(연한 파랑), 상태 3색(초록·빨강·노랑)은 그대로. 다크 모드에서는 평면도 이미지를 반전(`.floorplan-img`).

**평면도**: `public/floorplan.png`(1622×1252)를 SVG로 잘라 보여 주고, `src/lib/floorplan.ts`의 좌표에 핀을 그린다. 구역을 바꾸면 `mockData.ts`의 ZONES(코드 유지)와 `floorplan.ts`의 좌표를 같이 고친다. 앱을 열면 `seed.ensure`가 코드 기준으로 DB의 구역 이름을 맞춘다.

**활동 기록**: `activity` 표는 만들어져 있지만 아직 브라우저 안에서만 센다 (Stage 5에서 Convex로).

---

## 5. 진행 상황

- [x] Stage 0: 클릭형 화면 전체, 데이터 구조, 추천 프롬프트 초안
- [x] Stage 1: 사용자 정보 Convex 연결
- [x] Stage 2: 대화 요청과 수락
- [x] Stage 3: 떠나기 알림, 행사 종료 정리 (스케줄러)
- [x] Vercel + Convex Production 배포
- [x] 긴급: 행사 종료 시각을 일 10/25 16:00 PT로 고정 (8-1) — 배포 후 데모 주소를 한 번 열면 Production도 고쳐짐
- [ ] Stage 4: AI 추천 (8-2) — Claude API 키 필요
- [ ] Stage 5: 지표 기록 (8-3)
- [x] 실제 구역 이름으로 바꾸기 (8-4) — Palace of Fine Arts 1층 평면도 기준 7개 구역
- [x] 디자인 개선: 평면도 위치 선택, 구역별 사람 카드(좌우 넘김), 파란색 테마·둥근 버튼·핀 로고
- [x] Huddle: 같은 줄 관심사 매칭, 함께 수락·만남, Open to huddles, 데모 버튼
- [x] 팀 피드백 1: 구역 혼잡도, Huddle 후 "Stay connected?", Still here? 제거
- [x] 팀 피드백 2: 하단 탭 정리(Explore 통합), 패널도 다른 패널에게 요청
- [x] Connections: 연결 코드·초대 링크, 위치 공개 범위(Everyone / Only my connections / No one), Your people, Zones 표시, 데모 버튼
- [x] 구역 아이콘 통일: Pavilion 텐트, Atrium 기둥 홀, Breakouts 1–4 문 2개, Broadway 복도·화살표, Broadway 3 출입문, Breakouts 5–7 문 3개, Theater 무대·커튼
- [x] 노트북용 휴대폰 화면 프레임 (라이트·다크, 낮은 화면 축소, 폰에서는 전체 화면)
- [ ] 폰 홈 화면 앱(PWA) (8-5)
- [ ] Stage 6-1: 패널 쪽 3줄 브리핑 (8-6)
- [ ] Stage 6-2: 놓쳤을 때 후속 메시지 (8-6)
- [ ] Stage 6-3: 링크로 가입 (Apify) (8-6)
- [ ] 데모 영상 촬영·편집 (워크숍 네트워킹 시간 실사용 장면)
- [ ] Devpost 초안 (토요일 밤), 최종 제출 (일 09:00 전)
- [ ] 3분 영어 피치와 예상 질문 리허설

---

## 6. 다른 컴퓨터에서 처음 시작하기

**준비물**: Node.js 20 이상, Git, Claude Code. GitHub 저장소 초대와 Convex 팀 초대(Developer)를 수락한 상태.

```
cd Desktop
git clone https://github.com/dltkddud/spot.git
cd spot
npm install
```

터미널 탭 3개를 씁니다.

| 탭 | 명령 | 상태 |
|---|---|---|
| 1 | `npx convex dev` | 계속 켜 둠. 처음엔 로그인 → **기존 프로젝트 `spot`** 선택 → 내 개발용 데이터베이스가 생김 |
| 2 | `npm run dev` | 계속 켜 둠. http://localhost:3000 |
| 3 | `claude` | 작업 지시 |

- 탭 1을 처음 켜면 `.env.local`이 자동으로 생긴다. 그 뒤에 탭 2를 켠다.
- 내 개발용 데이터베이스는 다른 사람과 따로다. 내 노트북에서 가입한 계정은 데모 주소에 안 보이는 게 정상.
- AI 기능을 테스트하려면 내 개발용 데이터베이스에도 키를 넣는다: `npx convex env set ANTHROPIC_API_KEY 키값` (Claude Code 창이 아니라 일반 터미널에서)

**Claude Code 첫 메시지**
```
HANDOFF.md, AGENTS.md, CLAUDE.md, convex/_generated/ai/guidelines.md를 읽고 지금 상황을 한국어로 5줄 요약해줘.
그다음 HANDOFF.md 5장 진행 상황에서 다음 할 일을 알려줘. 내가 지시하기 전에는 코드를 바꾸지 마.
```

---

## 7. 작업 규칙

**매번**
1. 시작 전: `git pull`
2. 작업 → `npx tsc --noEmit`과 `npm run build`로 오류 확인
3. 크롬 일반 창 + 시크릿 창으로 양쪽 화면 확인 (예: 패널 한 명, 참석자 한 명)
4. HANDOFF.md 5장 체크, 11장 로그 한 줄 추가
5. `git add .` → `git commit -m "무엇을 했는지 한 줄"` → `git push`
6. push하면 Vercel이 자동 배포. 1~3분 뒤 데모 주소에서 확인

**지킬 것**
- 디자인, 영어 문구, 화면 구조는 필요한 만큼만 바꾼다.
- 화면에서 Convex를 직접 부르지 않고 `store.tsx`를 거친다.
- `convex/` 코드를 고치기 전에 `convex/_generated/ai/guidelines.md`를 읽는다.
- 같은 파일을 두 사람이 동시에 고치지 않는다. 시작 전에 단톡에 "지금 ○○ 파일 작업 중" 공유.
- 비밀값은 Convex·Vercel 환경 변수에만.
- 데모 주소(Production)에 실제로 영향을 주는 작업(예: Production 데이터 수정)은 팀에 먼저 알린다.

**윈도우 명령 프롬프트 팁**
- 명령어는 한 줄로 붙여서 입력. 주소가 줄바꿈되면 두 명령으로 나뉜다.
- `git`을 `it`처럼 앞 글자를 빠뜨리는 오타가 잦다.
- "스크립트를 실행할 수 없으므로…"가 나오면 PowerShell에서 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

---

## 8. 다음 작업별 Claude Code 지시문

### 8-1. 긴급: 행사 종료 시각 고정
```
행사 종료 시각이 "지금부터 3시간 뒤 정각"으로 잡혀 있어서, Production은 오늘 밤 12시에 모든 구역·상태가 지워져. 고쳐줘.
1. src/lib/mockData.ts의 makeEvent가 고정값을 쓰게 해: 2026-10-25 16:00 America/Los_Angeles (= 2026-10-25T23:00:00Z).
2. seed.ensure에서 기존 행사의 endsAt이 이 값과 다르면 고치고 scheduleEventEnd로 다시 예약해. 예전 예약은 endsAt이 달라서 자동으로 아무것도 안 하게 돼 있어.
   이렇게 하면 배포 후 앱을 한 번 열기만 해도 Production이 고쳐져.
3. seed.resetDemo는 더 이상 종료 시각을 옮기지 않게 해.
4. src/lib/time.ts의 clockTime이 브라우저 언어와 상관없이 영어 형식, 태평양 시간으로 보이게 해 (예: Sun 4:00 PM). Welcome과 Me 화면 문구가 자연스러운지 확인해.
5. tsc, build 확인 → HANDOFF.md 업데이트 → 커밋 → push.
6. push 후 내가 데모 주소에서 확인할 방법을 알려줘.
```

### 8-2. Stage 4: AI 추천
먼저 일반 터미널에서 (Claude Code 창 말고):
```
npx convex env set ANTHROPIC_API_KEY 본인_키
```
데모 주소에서도 AI가 돌게: Convex 대시보드 → `spot` → **Production** → Settings → Environment Variables → `ANTHROPIC_API_KEY` 추가.

```
Stage 4: AI 추천을 만들어줘.
- convex/recommend.ts에 action forMe(viewerId)를 만들어. prompts/recommend.md의 시스템 프롬프트와 입력·출력 JSON 형식을 그대로 써.
- 키는 process.env.ANTHROPIC_API_KEY로만 읽어. 모델은 claude-haiku-5-5. 필요하면 @anthropic-ai/sdk 설치.
- 후보는 같은 행사의 visible이고 requestsPaused가 아니고 talking이 아닌 패널. 대기 인원도 같이 넘겨.
- 응답 검증: 후보에 없는 panelId는 버리고 최대 3개. 실패하거나 5초가 넘으면 src/lib/recommend.ts의 localRecommendations로 대체.
- 같은 입력(내 관심사·후보 상태)이면 다시 부르지 말고 저장된 결과를 써. 저장 위치는 Convex 표나 store 상태 중 단순한 쪽으로.
- store.tsx에서 useAction으로 부르고, Discover의 "Picked for you"가 이 결과를 쓰게 해. 화면에서 Convex를 직접 부르지 마.
- 키가 없을 때도 화면이 깨지지 않고 규칙 기반 추천이 나와야 해.
- tsc, build 확인 → HANDOFF.md 업데이트 → 커밋 → push. 내가 확인할 방법을 알려줘.
```

### 8-3. Stage 5: 지표 기록
```
Stage 5: 지표 기록을 Convex로 옮겨줘.
- convex/activity.ts: log mutation, summary query (행사 전체 기준 숫자)
- store.tsx의 log 동작(패널 조회, 요청, 수락, 만남, 놓침, 추천 클릭)을 이걸로 바꿔.
  놓침은 leaving.leave와 chatRequests.setStatus에서 서버가 기록해.
- Me 화면 Activity 숫자가 summary를 쓰게 해. 피치용으로 "요청 → 수락 → 만남" 전환율도 한 줄 보여줘.
- tsc, build → HANDOFF.md → 커밋 → push.
```

### 8-4. 실제 구역 이름
```
src/lib/mockData.ts의 ZONES를 아래 실제 구역으로 바꿔줘. 이미 Development와 Production에 들어간 zones도
코드(code) 기준으로 이름과 기물 설명을 업데이트하는 방법(seed.ensure에서 맞추기)으로 반영해. 구역 id가 바뀌어 사용자 위치가 깨지지 않게.
A: (이름) / (눈에 띄는 기물)
B: ...
```

### 8-5. 폰 홈 화면 앱 (PWA)
```
폰에서 "홈 화면에 추가"하면 앱처럼 열리게 PWA 설정을 해줘.
1. 웹 앱 매니페스트: 이름 Spot, standalone, 배경색·테마색은 globals.css의 --bg, --ink
2. 앱 아이콘: 남색 사각형에 흰색 굵은 S (화면 로고와 같은 모양), 192px·512px·애플 터치 아이콘
3. 아이폰에서도 주소창 없이 열리게 메타 태그
Next.js 16 방식대로. tsc, build → HANDOFF.md → 커밋 → push. 폰에서 확인하는 방법을 알려줘.
```

### 8-6. Stage 6 (시간 남으면, 하나씩)
```
Stage 6-1: 패널 쪽 브리핑. 대기 신청이 생기면 Claude(claude-haiku-5-5)가 요청자 프로필과 메모로
"누구이고 왜 대화하고 싶은지" 3줄 영어 요약을 만들어 PanelNow의 요청 카드에 보여줘. 실패하면 메모만 보여줘.
```
```
Stage 6-2: 후속 메시지. 내 요청이 missed가 되면 MyRequests에 Claude가 쓴 짧은 영어 메시지 초안,
복사 버튼, 상대 연락처 링크를 보여줘. 복사는 navigator.clipboard를 쓰고 실패하면 텍스트를 선택해줘.
```
```
Stage 6-3: 링크로 가입. 온보딩에 "Fill from a link" 옵션을 추가해. 개인 사이트·GitHub·Devpost 링크를 받으면
Convex action에서 Apify Website Content Crawler로 페이지 내용을 가져오고, Claude가 한 줄 소개와 관심사를 제안해.
사용자는 확인하고 고칠 수 있어야 해. 키는 APIFY_TOKEN 환경 변수.
LinkedIn과 Instagram 링크는 내용을 가져오지 말고 연락처로만 저장해 (이용약관).
```

---

## 9. 주의할 점

- **Production과 Development는 데이터가 따로**다. 데모 주소에서 보이는 사람과 노트북에서 보이는 사람이 다른 게 정상.
- **예시 사람은 Huddle에서 자동으로 Yes**: 실제 사용자가 낀 Huddle 제안에서 예시 사람은 버튼을 누를 수 없어 자동으로 Yes 처리된다. seed/Reset demo 직후에는 Dana의 줄에 Lena·Aisha(둘 다 Frontend) 제안이 있고 Aisha만 Yes 상태라, View as Lena로 바로 "Huddle up"을 보여줄 수 있다. Frontend 관심사로 가입해 Dana에게 요청하면 이 제안에 3번째로 합류한다.
- **Leo는 "Only my connections" 공개**: 기본으로는 지도에 안 보이고, "Connect me with demo friends"를 누르면 Your people과 Theater에 나타난다 (연결 공개 시연용).
- **새 예시 참석자 6명**(Maya, Omar, Jin, Sara, Leo, Nina)은 기존 DB에는 자동으로 안 들어간다. Production에서 Me → Demo controls → **Reset demo**를 한 번 눌러야 추가된다. Jin·Sara·Nina는 위치 숨김 상태다.
- **예시 사람은 시간이 지나면 떠난다**: seed 직후 Priya는 8분 뒤, Ahmed는 25분 뒤 떠나도록 예약된다. 데모 전에 Me → Demo controls → **Reset demo**로 초기화.
- **Vercel 배포가 "Blocked"**로 막히면 (무료 플랜 + Private 저장소 + 다른 사람 커밋) GitHub 저장소를 Public으로 바꾼다. 비밀값은 저장소에 없어서 안전하고, Devpost 제출 때도 공개가 필요하다.
- **Vercel에서 Convex "Add" 연동은 누르지 않는다.** 새 Convex 프로젝트가 따로 생겨 지금 데이터와 끊긴다. 배포 키 방식을 쓰고 있다.
- `next dev`가 `AGENTS.md`를 다시 쓰고, `npx convex dev`가 `CLAUDE.md`의 Convex 블록을 다시 쓸 수 있다. 바뀌면 그냥 같이 커밋한다.
- 행사장 와이파이는 기기끼리 연결을 막을 수 있다. 폰 테스트는 `localhost`나 내부 IP 대신 데모 주소로 한다.
- 개인 핫스팟은 행사장 반입 금지. 데모 영상은 와이파이가 불안할 때를 대비해 일찍 찍어 둔다.

---

## 10. 결정 기록 (왜 이렇게 했나)

| 결정 | 이유 |
|---|---|
| GPS·자동 위치 추적 안 씀, 구역 직접 선택 | 실내에서 GPS 오차가 수십 m, 웹앱은 화면이 꺼지면 위치가 멈춤, 동의 없는 추적은 거부감 |
| 얼굴 인식 안 씀, 인상착의는 옷·소지품만 | 프라이버시. 신체 특징은 받지 않음 |
| AI는 추천·브리핑·후속 메시지에만 | 사람이 직접 하기 번거로운 판단에만 쓰고 억지로 넣지 않기 |
| 네이티브 앱 대신 웹앱 + PWA | 윈도우로 아이폰 빌드 불가, 앱스토어 심사 불가. PWA로 앱처럼 보임 |
| Meta API, Cartesia 안 씀 | 이 제품에 자연스럽게 필요하지 않음 |
| 로그인 없음 (localStorage) | 해커톤 범위. 가입 마찰 최소화 |
| Next.js + Convex + Vercel | 실시간 반영이 핵심이라 Convex. push만 하면 자동 배포 |

**심사 예상 질문**
- "사람들이 업데이트할까요?" → 상태는 원터치, 떠나는 시간은 한 번. 패널은 대기 인원과 브리핑을 보는 게 업데이트할 이유.
- "사람이 모여야 쓸모 있지 않나요?" → 주최 측이 입구 QR로 가입을 받고, 행사 페이지로 연사를 미리 세팅(Stage 6-3 확장).
- "위치가 틀리면요?" → 마지막 업데이트 시각을 보여 주고 15분 넘으면 흐리게 표시.

---

## 11. 진행 로그

새 항목은 맨 아래에 한 줄씩 추가.

- 10/23 19:45 Stage 0 GitHub 업로드 (dltkddud)
- 10/23 20:06 Stage 1 사용자 Convex 연결
- 10/23 20:17 Stage 2 대화 요청·수락
- 10/23 20:24 Stage 3 떠나기 알림·행사 종료 정리
- 10/23 21:05 Vercel + Convex Production 배포 → https://spot-psi-two.vercel.app
- 10/23 21:20 HANDOFF.md 작성
- 10/23 22:15 8-1 행사 종료 시각 일 16:00 PT 고정, 시간 표시를 영어·태평양 시간으로
- 10/23 22:45 디자인 개선 (평면도·혼잡도·사람 카드·Still here?·파란색 테마·핀 로고), 구역 이름 실제 평면도 기준으로, 예시 참석자 6명 추가
- 10/23 23:50 Huddle (관심사 겹치는 대기자끼리 함께 만나기, 묶음 수락, Stay connected, 활동 숫자)
- 10/23 23:54 Connections (연결 코드·초대 링크, 위치 공개 범위, Your people)
- 10/23 23:58 구역 아이콘 통일 (평면도 핀·구역 배지·카드에 같은 아이콘 + 코드 배지)
- 10/24 00:04 노트북용 휴대폰 화면 프레임 (탭바·알림·스크롤이 프레임 안에서 동작)
- 10/24 07:16 팀 피드백 1: 혼잡도·Stay connected·Still here 제거, 한 번만 도는 마이그레이션 장치(runOnce) 추가
- 10/24 07:21 팀 피드백 2: 탭 정리(게스트 Explore/Requests/Me, 패널 Now 추가), Explore에 People/Map 전환, Huddle은 Requests로, 패널끼리 요청 가능
