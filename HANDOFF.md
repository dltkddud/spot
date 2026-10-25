# Spot 인수인계 문서

> 이 파일만 읽으면 어느 컴퓨터에서든 바로 이어서 작업할 수 있게 정리한 문서입니다.
> Claude Code는 `CLAUDE.md`를 통해 이 파일을 자동으로 읽습니다.
> 단계를 끝낼 때마다 아래 **5. 진행 상황**과 **11. 진행 로그**를 업데이트해 주세요.

마지막 업데이트: 2026-10-25 03:40 PT

---

## 0. 30초 요약

- **무엇**: 행사장에서 대화하고 싶은 패널(발표자·프로덕트 제작자)을 놓치지 않게 돕는 실시간 네트워킹 웹앱 **Spot**
- **어디까지**: 화면 전체 완성, 사용자·대화 요청·떠나기 알림·행사 종료 정리까지 Convex로 연결, Vercel 배포 완료 (Stage 0~3). 평면도·파란색 디자인, **Huddle**(같은 줄의 관심사 겹치는 사람끼리 함께 만나기), **Connections**(미리 연결한 사람과 구역 자동 공유), **여러 행사·행사별 역할·프로필 수정**, **패널이 떠난 뒤 LinkedIn + Claude 후속 메시지** 적용
- **데모 주소**: https://spot-psi-two.vercel.app
- 행사 종료 시각은 일 10/25 16:00 PT로 고정됨 (`EVENT_ENDS_AT`, 8-1 완료)
- **10/25 실데모 준비**: 가상 인물 전부 삭제(예시 게스트 Jimin Kim·Logan Kim 2명만), LinkedIn 필수 + LinkedIn으로 로그인·로그아웃, Demo controls 삭제, 떠나는 시간 10분/30분/Other(시각 입력)
- **10/25 새벽 핵심 다듬기**: Claude 동작 확인 명령(`aiCheck:ping`), 대화를 못 한 모든 경우(떠남·Leaving now·Guest로 전환·거절·Didn't show·Huddle 해산)에 패널 LinkedIn + Claude 메시지, 패널 Now에 Leaving now·I'm back·People you missed, **Huddle을 Claude가 묶음**(이유·whyYou·패널용 공통 질문, 실패 시 관심사 겹침), 떠나는 시간 10/30/60분 + 분 직접 입력(서버 시각 기준), 관리 명령 `admin:*`
- **그다음**: 기능 동결 04:30 → 데모 영상, Devpost(09:00 마감), 피치 리허설

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
11. **떠난 뒤 이어가기**: 패널이 떠나서(또는 Speaker→Guest로 바꿔서) 요청이 missed가 된 게스트에게 "Dana has left. Keep the conversation going on LinkedIn." 배너, Requests 카드에 패널 LinkedIn 버튼·Claude(`claude-haiku-5-5`)가 쓴 3~4문장 영어 메시지 초안·Copy·기타 링크

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
  - Explore: 위쪽 People / Map 전환. People은 핵심부터: 내 위치, Leaving soon, Speakers(필터), Guests(같은 카드·필터, 대기 인원 없음. Jimin·Logan도 여기) → 보조: Your people, AI matches(카드 버튼 → 상대 페이지에서 Request to chat). Map은 평면도와 구역 목록. 구역·패널 상세도 Explore 탭 안. 패널 상세(`panelDetail`, 게스트 페이지도 같은 화면)는 구역·인상착의 바로 아래 요청 박스(Speaker면 #순서, 게스트면 "Request sent"), 떠난 패널이면 내 LinkedIn+메시지 카드. Map의 구역 카드에서 게스트는 다른 게스트에게 "Request to chat".
  - Requests: **Requests to you**(나에게 온 요청: Accept/Not now, We met/Didn't show. Speaker면 번호와 Huddle 묶음 카드, 게스트면 1:1) → Ready for you → In line("You're #2 · Dana leaves in 9 min", 게스트에게 보낸 건 "Waiting for … to accept") → Keep in touch → Earlier. 탭 배지 = 나에게 온 대기 요청 + 내가 보낸 열린 요청. 새 요청이 오면 "… wants to chat. See Requests." 배너.
  - Now: 패널 전용. 상태 큰 버튼, 떠나는 시간(10/30/60·직접 입력·Leaving now), 내 위치, Your line(Taking requests 스위치 + "N people are waiting" 요약, 누르면 Requests), People you missed. 떠난 뒤에는 "You've left" + I'm back.
  - 패널도 다른 패널에게 요청할 수 있다(자기 자신은 서버에서 막음). 게스트끼리도 1:1 요청 가능(패널 → 게스트는 서버에서 막음). Huddle은 **Speaker 줄에서만**(`proposeFor`가 받는 사람이 패널이 아니면 건너뜀): 같은 설명을 여러 번 하지 않게 하려는 기능.
- **화면은 Convex를 직접 부르지 않는다.** 모든 읽기·쓰기는 `store.tsx`를 거친다. 새 기능도 store에 동작을 추가하고 화면은 `useApp()`으로 쓴다.
- 앱은 클라이언트에서만 렌더링한다 (`src/app/ClientApp.tsx`의 `dynamic(..., { ssr: false })`).
- **노트북에서는 휴대폰 프레임 안에서 동작**한다 (`PhoneFrame.tsx`). 가로 640px 이상이고 홈 화면 앱이 아니면 390×844 프레임을 띄우고, 화면이 낮으면 비율을 유지한 채 줄인다. 폰이나 홈 화면 앱은 프레임 없이 전체 화면.
  - 프레임의 화면 영역에 `transform`이 걸려 있어 `position: fixed`(탭바, 알림 배너)가 브라우저 창이 아니라 프레임에 붙는다. 스크롤은 `#spot-scroll`에서만 일어난다.
  - 화면 높이·안전 영역은 CSS 변수로 쓴다: `min-h-[var(--app-h)]`, `top-[var(--safe-top)]`, `var(--safe-bottom)`. `min-h-dvh`나 `env(safe-area-inset-*)`를 새로 쓰지 말 것.
  - 화면 맨 위로 스크롤할 때는 `window.scrollTo` 대신 `scrollAppToTop()`.
- **프로필과 행사 참가가 따로다**:
  - `profiles`(계정 단위): 이름, 한 줄 소개, 관심사, LinkedIn, 기타 링크, 연결 코드, Open to huddles. 모든 행사 공통.
  - `users`(행사 참가 단위): 행사, profileId, 역할(panel/attendee = Speaker/Guest), 발표·프로덕트 제목, 오늘의 인상착의, 구역, 상태, 떠나는 시간, 공개 범위, 요청 일시정지. `chatRequests`와 `huddles`는 이 참가 id를 쓴다.
  - `users.listByEvent`가 참가 기록에 프로필을 붙여서 돌려주므로, 화면의 `User`는 예전처럼 이름·관심사까지 다 들어 있다.
  - 연결(`profileConnections`)은 프로필끼리라, 한 번 연결하면 같이 들어간 모든 행사에서 구역이 공유된다.
- **간단 로그인**: 비밀번호 없음. LinkedIn이 필수이고 사람마다 하나라서(`profiles.by_linkedin`, `cleanLinkedin`이 http·www·끝 슬래시·?쿼리·대소문자를 하나로 맞춤) Welcome → "I already have a profile. Log in"에서 LinkedIn 주소로 프로필을 다시 찾는다(`profiles.logIn`). 브라우저는 localStorage `spot.profileId`(내 프로필)와 `spot.eventId`(마지막으로 본 행사)를 기억한다. Me 맨 아래 **Log out**은 `spot.profileId`를 지우고 Welcome으로 돌아간다. 예전 브라우저에 `spot.myUserId`(참가 id)만 있으면 `profiles.claimFromParticipation`이 그 참가 기록의 프로필로 이어 준다.
- **화면 흐름**: Welcome → 프로필 만들기(처음 한 번, 또는 Log in) → Events 목록 → 행사 들어가기 → 역할 선택 → (Speaker면 발표 제목) → 인상착의 → 구역 선택. 홈 위쪽 헤더에 행사 이름과 역할(Speaker/Guest), 누르면 Events 목록. Me → Edit profile에서 공통 정보와 이 행사 정보를 고친다. Speaker → Guest로 바꿀 때 줄에 사람이 있으면 화면에서 확인을 받고, 그 요청들은 떠났을 때와 같이 missed가 된다.
- **행사 여러 개**: `mockData.ts`의 `EVENTS`(Cal Hacks 13.0, Founders & Coffee SF, Bay Area Robotics Expo). 앱을 열면 `seed.ensure`가 key로 찾아 없으면 만들고(구역·예시 사람 포함), 있으면 이름·시간·구역·예시 프로필을 맞추고 없는 예시 사람만 새로 넣는다. 예시 사람은 Cal Hacks의 게스트 Jimin Kim·Logan Kim 2명뿐이고 예시 요청은 없다. 행사마다 종료 시각과 종료 정리 예약이 따로다. 평면도는 `floorPlan`이 있는 행사(Cal Hacks)만, 나머지는 Map에서 구역 목록만.

**폴더**
```
convex/
  schema.ts         표: events, zones, users, chatRequests, activity
  profiles.ts       create, update, logIn(LinkedIn으로 찾기), get, participations(내가 들어간 행사와 역할), claimFromParticipation, ensureCode.
                    LinkedIn은 linkedin.com/in/… 프로필 주소만(서버·화면 같은 검사)
  events.ts         list, get(행사+구역), join(행사 참가), scheduleEventEnd, endEvent(행사별 종료 정리)
  users.ts          update(구역·인상착의·공개 범위·일시정지·역할·발표 제목), setStatus, listByEvent(참가+프로필)
  chatRequests.ts   create, setStatus, forPanel, missedForPanel(People you missed), forAttendee, activeByEvent
                    (요청이 바뀌면 Huddle 매칭·해산 호출, 거절·Didn't show면 후속 메시지 예약)
  huddles.ts        proposeFor(Claude 매칭 예약), proposeByInterests(대체: 관심사 겹침), lineFor·applyMatch(Claude 입력·결과 반영),
                    afterRequestChange, dissolveAllFor, respond, setGroupStatus, forAttendee, forPanel
  huddlesNode.ts    "use node" action match: claude-haiku-5-5가 줄을 2~3명씩 묶음(prompts/huddle.md). 8초·실패면 대체
  matches.ts        AI 매칭(learnToday/canShare, 추천 카드만. 10분 대화는 삭제, 예약돼 있던 finish·expire만 남김), matchesNode.ts: Claude 매칭 action (prompts/match.md)
  aiCheck.ts        "use node" internal ping: Claude가 이 배포에서 도는지 { ok, model, error }만 (키는 안 돌려줌)
  clock.ts          now: 서버 시각 (폰 시계 차이 보정용)
  connections.ts    프로필끼리 connect·disconnect, connectByCode, remove, mine
  activity.ts       record (서버 기록), summary (행사 전체 숫자)
  followUps.ts      closeWithoutChat(요청을 missed/declined로 닫고 closedBecause 표시 + 초안 예약), context, save, templateMessage
  followUpsNode.ts  "use node" action draft: claude-haiku-5-5로 후속 메시지 초안 ("Hi …"로 시작 안 하거나 실패면 기본 문장)
  leaving.ts        scheduleLeaving, warn(10분 전), leave(떠나는 시각), leaveNow(지금 떠남), comeBack(I'm back),
                    closeLine(줄 닫기: 떠날 때·Speaker→Guest)
  seed.ts           ensure(마이그레이션 + 행사·구역 맞추기 + 예시 게스트 추가). remove-demo-people-v1(예전 예시 사람 삭제) 다음에
                    wipe-people-v1이 사람 데이터(실제 가입자, AI 매칭 matches·matchSets 포함)를 한 번 전부 지움
  cleanup.ts        참가·프로필과 거기 딸린 요청·Huddle·매칭·활동 지우기 (seed, admin이 사용)
  admin.ts          터미널 전용 internal: listParticipants, removeParticipants(테스트 가입자 지우기), resetActivity(데모 전 요청·Huddle·매칭·떠남 초기화)
  _generated/       자동 생성. 직접 고치지 않음. GitHub에 같이 올림
prompts/
  huddle.md         Claude Huddle 묶기 프롬프트·입출력 JSON·대체 규칙
  match.md          AI 매칭 프롬프트
src/
  app/              layout, page, ClientApp, globals.css(색 토큰), icon.svg(핀 파비콘)
  components/
    App.tsx         ConvexProvider, 화면 전환
    ui.tsx          아이콘, 핀 로고·구역 배지, 버튼, 탭바, 알림 배너
    FloorPlan.tsx   평면도 위 구역 핀, 구역 확대 보기
    Huddle.tsx      참석자용 Huddle 카드(제안·대기·완성), 패널용 묶음 카드
    ZoneIcon.tsx    구역 아이콘 7개(24 격자, 선 두께 2)와 ZoneMark(핀 안 아이콘 + 코드 배지). 구역이 나오는 모든 곳에서 사용
    PhoneFrame.tsx  노트북용 휴대폰 프레임(상태바, 축소 맞춤), scrollAppToTop
    FollowUp.tsx    못 만난 패널의 LinkedIn 버튼, 메시지 초안(고쳐 쓰기 가능, Claude/Template 표시), Copy(실패 시 텍스트 선택), 기타 링크
    Matches.tsx     AI matches 카드(Request to chat / Not now)
    Connections.tsx Your people 줄, 위치 공개 범위 선택, Connect with friends(코드·링크 복사·코드 입력·연결 목록)
    screens/        Welcome, Onboarding(ProfileSetup·JoinEvent와 공통 입력칸), Events, EditProfile,
                    ZonePicker, Explore(People/Map 전환),
                    Discover(Explore의 People), Zones(Explore의 Map, 구역 상세), PanelDetail,
                    MyRequests(Requests 탭), PanelNow(패널 Now 탭), Me(설정·지표·Log out)
  lib/
    store.tsx       모든 상태와 동작. Convex 연결 지점
    types.ts        데이터 타입
    mockData.ts     EVENTS(행사 3개: 구역, Cal Hacks 예시 게스트 2명), 관심사 목록
    links.ts        LinkedIn 주소 확인, 링크 href
    floorplan.ts    public/floorplan.png 위 구역 핀 좌표(원본 이미지 픽셀, 구역 코드 기준)와 구역별 아이콘 이름
    recommend.ts    규칙 기반 추천 (AI 실패 시 대체용)
    time.ts         시간 표시, 신선도 기준 15분, 떠나기 알림 기준 10분, timeLeft/timeLeftLabel(남은 시간 공통 표시)
```

**Convex 함수 요약**

| 함수 | 종류 | 하는 일 |
|---|---|---|
| `profiles.create` / `update` | mutation | 프로필 만들기 / 고치기(모든 행사에 반영). LinkedIn 필수, linkedin.com 주소만, 한 사람당 하나 |
| `profiles.logIn` | mutation | LinkedIn 주소로 내 프로필 찾기(없으면 "No profile with that LinkedIn yet.") |
| `profiles.get` / `participations` | query | 내 프로필 / 내가 들어간 행사와 역할 |
| `profiles.claimFromParticipation` | mutation | 예전 브라우저의 참가 id로 프로필 찾기(없으면 만들기) |
| `profiles.ensureCode` | mutation | 코드가 없는 프로필에 연결 코드 만들기 |
| `events.list` / `get` | query | 행사 목록(가까운 순) / 행사 하나와 구역 |
| `events.join` | mutation | 행사 참가(역할, 발표 제목, 인상착의, 지도 공개). 이미 있으면 그 참가 id |
| `users.update` | mutation | 구역, 인상착의, 공개 범위, 요청 일시정지, 역할, 발표 제목. Speaker→Guest면 줄을 닫음 |
| `users.setStatus` | mutation | 대화 가능/대화 중/떠남. 떠남은 `leavingInMin`(1~180분, 서버 시각 기준, 화면이 쓰는 방식) 또는 `leavingAt`(시각). 지금 이후·행사 종료 전만. 예약 2개 생성 |
| `leaving.leaveNow` / `comeBack` | mutation | Leaving now: 바로 떠난 것으로 처리(줄 닫기·LinkedIn·메시지) / I'm back: 떠나기 전 구역·공개 범위로 복귀 |
| `clock.now` | mutation | 서버 시각. store가 시작할 때·5분마다·앱이 앞으로 올 때 폰 시계와의 차이를 잼 |
| `users.askStillHere` / `confirmStillHere` | mutation | 오래된 구역에 "Still here?" 묻기(`stillHereAskedAt`, 답하기 전엔 한 번만) / 같은 구역 그대로 확인. 다른 업데이트(구역·상태·떠남·행사 종료)도 질문을 지움 |
| `users.listByEvent` | query | 행사 참가자 전체에 프로필을 붙여서. `visible`은 보는 사람 기준(모두 공개, 또는 연결된 사람에게만 공개인데 내 프로필과 연결됨). 안 보이면 구역을 지워서 |
| `connections.connectByCode` | mutation | 친구 코드 입력·초대 링크로 프로필끼리 연결 (코드를 건넨 쪽이 동의한 것으로 봄) |
| `connections.remove` | mutation | 연결 끊기 |
| `connections.mine` | query | 내 연결 목록 (누가 연결했는지 `by` 포함) |
| `chatRequests.create` | mutation | 요청. 중복·일시정지·떠난 패널 서버에서 차단 |
| `chatRequests.setStatus` | mutation | 수락/거절/만남/취소/놓침. 누가 무엇을 바꿀 수 있는지 서버에서 검사 |
| `chatRequests.forPanel` | query | 패널의 대기열 (메모 포함) |
| `chatRequests.missedForPanel` | query | 패널이 못 만난 게스트(떠남·거절·놓침) — Now의 People you missed |
| `chatRequests.forAttendee` | query | 참석자 본인의 요청 전체 |
| `chatRequests.activeByEvent` | query | 행사 전체의 열린 요청 (누가 했는지·메모 제외). 대기 인원·순서 계산용 |
| `leaving.warn` / `leaving.leave` | internal | 떠나기 10분 전 표시 / 떠나는 시각에 Huddle 해산, 요청 missed, 패널 숨김 |
| `huddles.respond` | mutation | "Huddle up" / "Not this time". 모두 Yes면 formed, 한 명이라도 No면 declined |
| `huddles.setGroupStatus` | mutation | 패널이 Huddle 전체를 한 번에 수락/거절/만남/놓침 |
| `huddles.forAttendee` / `forPanel` | query | 내 Huddle(reason·내 whyYou) / 패널 줄의 완성된 Huddle(sharedQuestion 포함) |
| `huddlesNode.match` | internal action | 줄이 바뀔 때마다 예약됨. Claude가 묶고 `huddles.applyMatch`가 다시 검사해 반영. 같은 줄이면 안 부름(`huddleChecks`) |
| `followUpsNode.draft` | internal action | 대화를 못 하고 끝난 요청(`closedBecause`)마다 Claude로 후속 메시지 초안을 만들어 `chatRequests.followUp`에 저장 |
| `aiCheck.ping` | internal action | `npx convex run aiCheck:ping` (`--prod`) → `{ ok, model, error }` |
| `admin.listParticipants` / `removeParticipants` / `resetActivity` | internal | 터미널 전용 관리 명령 (9장) |
| `activity.summary` | query | 행사 전체 활동 숫자 (Me 화면 Huddles formed, Connections made) |
| `events.endEvent` | internal | 종료 시각에 모두의 구역·상태·떠나는 시간 삭제 |
| `seed.ensure` | mutation | 마이그레이션 실행 + EVENTS 행사 채우기·맞추기(없는 예시 사람만 추가) |

**예약 작업 설계**: 떠나는 시간이나 종료 시각이 바뀌면 새로 예약하고, 예전 예약은 실행될 때 값이 다르면 아무것도 하지 않는다. Convex 대시보드 → Schedules에서 볼 수 있다.

**떠나는 시간(패널 타이머)**: 10/30/60분 또는 1~180분 직접 입력 → 서버가 `Date.now() + 분`으로 `leavingAt`을 정하고 그 시각에 `leave`, 10분 전에 `warn`을 예약(10분 이하면 알림 바로). 화면의 `state.now`는 서버 시각(폰 시계 + `clock.now`로 잰 차이)이고, 카운트다운이 있으면 1초마다, 누가 바뀌면 즉시 다시 잰다. 남은 시간은 어디서나 `timeLeftLabel`: 설정 직후 "10 min", 1분 뒤 "9 min", 마지막 1분은 초. 예전 "11 min" 원인: 올림(`ceil`) + 10초마다만 갱신된 `now`(최대 10초 전) + 폰과 서버 시계 차이.

**대화를 못 했을 때**: `chatRequests.closedBecause` = `speaker_left`(떠남·Leaving now·Guest로 전환·Huddle이 떠남으로 해산) / `declined`(거절) / `missed`(Didn't show). 모두 `followUps.closeWithoutChat`을 거쳐 Claude 초안이 예약되고, 게스트는 배너("Dana has left. Keep the conversation going on LinkedIn.")와 Requests의 Keep in touch 카드(LinkedIn·메시지·Copy), 패널은 People you missed를 본다.

**알림**: 앱 화면 안 배너(Toast)만 쓴다. 폰 푸시 알림 없음.

**Huddle 설계**
- 표: `huddles`(패널, 상태 proposed/formed/met/declined/dissolved, 겹치는 관심사), `huddleMembers`(멤버별 요청 id, 응답), `connections`(연결, 방향마다 한 줄).
- 매칭(`proposeFor`)은 요청 생성·취소·거절, Huddle 거절, "Open to huddles" 켜기·관심사 수정 때 `huddlesNode.match`를 `runAfter(0)`로 예약한다. Claude가 같은 줄 사람들의 headline·관심사·learnToday·canShare·메모와 패널의 발표 제목을 보고 2~3명씩 묶는다(비슷한 관심 + 한쪽이 찾는 걸 다른 쪽이 줄 수 있는 보완 관계). 맞는 사람이 없으면 안 묶는다. 결과는 `applyMatch`가 줄 상태로 다시 검사해 넣는다.
- 실패·8초 초과·키 없음이면 예전 방식(`proposeByInterests`): 진행 중인 제안(3명 미만, Claude가 만든 것 제외)에 합류, 그다음 오래 기다린 사람부터 관심사가 가장 많이 겹치는 사람과. 화면에 "Based on shared interests".
- 같은 패널에서 이미 제안된 두 사람은 다시 묶지 않는다(`neverTogether`). 최대 3명, Open to huddles 끈 사람 제외.
- 화면: 게스트 카드는 reason + 내 whyYou + "Claude" 표시, 패널 카드는 "They all want to know: {sharedQuestion}" + 멤버·메모. reason·whyYou에는 메모를 쓰지 않게 했다(메모는 패널만 봄).
- 완성되면 멤버 요청에 `huddleId`와 `lineAt`(가장 앞선 멤버의 요청 시각)이 붙고, 대기 순서는 Huddle을 한 자리로 계산한다(`store.tsx`의 `positionInQueue`).
- 멤버가 취소되거나 거절·놓침되면, 또는 패널이 떠나면 해산되고 각자 원래 요청으로 돌아간다.
- 제안에는 이름·한 줄 소개·겹치는 관심사·인상착의만 보이고, 메모는 패널만 본다.

**Connections 설계**
- `users.shareWith`(everyone/connections/nobody)와 기존 `visible`은 항상 같이 바뀐다. `visible`은 "모두에게 보임"이고, 서버 검사(요청 받기 등)는 지금처럼 `visible`을 쓴다.
- `listByEvent`가 보는 사람(`viewerId`)의 프로필 기준으로 `visible`을 다시 계산하므로, 화면은 지금처럼 `u.visible`만 보면 된다.
- 초대 링크로 들어오면 `?connect=`를 localStorage(`spot.pendingConnect`)에 옮기고 주소에서 지운 뒤, 계정이 생기면 자동으로 연결한다.
- `profileConnections`는 방향마다 한 줄. `by`가 연결을 만든 프로필이라 상대에게만 "… connected with you" 배너가 뜬다. 예전 `connections` 표(참가 id끼리)는 마이그레이션이 옮기고 비웠다.

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
- [x] 팀 피드백 4: 패널이 떠난 뒤 LinkedIn 버튼 + Claude 후속 메시지 초안 + Copy, 프로필 LinkedIn 칸 안내, Now 화면 안내, 데모 버튼
- [x] 팀 피드백 3: 여러 행사(예시 2개 추가), 행사별 역할(Speaker/Guest), 프로필(profiles) 분리, Edit profile, LinkedIn 칸
- [x] Connections: 연결 코드·초대 링크, 위치 공개 범위(Everyone / Only my connections / No one), Your people, Zones 표시, 데모 버튼
- [x] 구역 아이콘 통일: Pavilion 텐트, Atrium 기둥 홀, Breakouts 1–4 문 2개, Broadway 복도·화살표, Broadway 3 출입문, Breakouts 5–7 문 3개, Theater 무대·커튼
- [x] 노트북용 휴대폰 화면 프레임 (라이트·다크, 낮은 화면 축소, 폰에서는 전체 화면)
- [x] Still here? 다시 추가 (새 방식): 오래된 구역에 게스트가 "Still here?" → 상대 화면 위에 "Still here / I moved" 알림 → 답하면 물어본 사람에게 배너
- [x] 실데모 준비: 가상 인물 삭제(Jimin·Logan만), LinkedIn 필수·로그인·로그아웃, Demo controls 삭제, 떠나는 시간 10/30/Other·남은 시간 정확히
- [x] 핵심 다듬기 0: AI 매칭 WIP 브랜치(ai-matching-wip)와 main 합치기, 팀원 실데모 준비와 다시 합치기
- [x] 핵심 다듬기 1: Claude 동작 확인 `aiCheck:ping`(Dev·Prod 모두 ok), AI 글에 "Claude" / 대체 표시
- [x] 핵심 다듬기 2: 예시 인물·Demo controls 삭제(remove-demo-people-v1), `admin:*` 관리 명령
- [x] 핵심 다듬기 3: LinkedIn 필수(프로필 주소만, 없던 프로필은 Add your LinkedIn 화면), 대화 못 한 모든 경우 LinkedIn+Claude 메시지, People you missed, Leaving now·I'm back
- [x] 핵심 다듬기 4: Huddle을 Claude가 묶기(reason·whyYou·sharedQuestion, prompts/huddle.md)
- [x] 핵심 다듬기 5: 떠나는 시간 10/30/60 + 직접 입력, 서버 시각 기준, 모든 화면 같은 남은 시간, Requests에 "#2 · leaves in 9 min"
- [x] 핵심 다듬기 6·7: Explore 핵심 먼저, 패널 상세 요청 박스 위로, 입력 안내 문구, 빈 상태·로딩 문구
- [ ] 폰 홈 화면 앱(PWA) (8-5)
- [ ] Stage 6-1: 패널 쪽 3줄 브리핑 (8-6)
- [x] Stage 6-2: 놓쳤을 때 후속 메시지 (8-6) — 위 핵심 다듬기 3
- [ ] Stage 6-3: 링크로 가입 (Apify) (8-6)
- [ ] 데모 영상 촬영·편집 (워크숍 네트워킹 시간 실사용 장면)
- [ ] Devpost 초안 (토요일 밤), 최종 제출 (일 09:00 전)
- [ ] 3분 영어 피치와 예상 질문 리허설

---
- [x] 요청 받기를 Requests 탭으로(Now는 요약만), 게스트끼리 1:1 요청, 10분 대화 삭제
- [x] Explore → People에 Guests 목록(Speakers 아래, 같은 형식)

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
- **사람 데이터 초기화(wipe-people-v1)**: 이 버전을 배포한 뒤 앱을 처음 여는 순간 Development·Production 각각에서 프로필·참가·요청·Huddle·연결·활동 기록이 **한 번 전부 지워진다**(행사·구역은 유지). 그 전에 가입한 팀원 계정도 사라지니 배포 후 다시 가입. 지워진 계정을 기억하던 브라우저는 새로고침하면 Welcome으로 돌아간다.
- **예시 사람은 Jimin Kim·Logan Kim 두 게스트뿐**(Cal Hacks, Atrium·Theater). AI 매칭용 learnToday·canShare는 `mockData.ts`의 `MATCH_INPUTS`에 이 둘만 있다. 요청을 보내지 않으니 Huddle에는 들어가지 않는다(자동 Yes 기능은 없앴다). 패널·요청 예시는 없으니 데모는 실제로 가입한 사람끼리 한다(예: 한 사람은 Speaker, 두 사람은 Guest).
- **로그인은 LinkedIn 주소만으로 된다**(비밀번호 없음). 해커톤 범위의 단순화라, 남의 LinkedIn 주소를 알면 그 사람으로 들어갈 수 있다. 심사 질문이 나오면 "실서비스에서는 LinkedIn OAuth로 바꿀 부분"이라고 답한다.
- **데모 전 초기화**는 화면 대신 터미널에서(일반 터미널, 프로젝트 폴더):
  - 참가자 보기: `npx convex run admin:listParticipants '{"eventKey":"calhacks-13"}' --prod`
  - 테스트 참가 기록 지우기(프로필은 남음): `npx convex run admin:removeParticipants '{"userIds":["id1","id2"]}' --prod`
  - 활동 초기화(프로필·참가·구역·연결은 두고 요청·Huddle·매칭·떠나는 시간·후속 메시지·활동 기록 삭제, 모두 Free to talk, 떠난 패널은 원래 구역으로): `npx convex run admin:resetActivity '{"eventKey":"calhacks-13"}' --prod`
  - PowerShell에서 따옴표가 깨지면 Git Bash에서 실행하거나 `'{\"eventKey\":\"calhacks-13\"}'`처럼 쓴다.
- **Claude가 도는지 확인**: `npx convex run aiCheck:ping` (Development), `npx convex run aiCheck:ping --prod` (Production). `{ "ok": true }`면 정상. 화면에서는 Claude가 쓴 글에 파란 "Claude" 표시, 대체 문장에는 "Based on shared interests"/"Template".
- **LinkedIn 없이 만든 예전 프로필**은 앱을 열면 "Add your LinkedIn to continue" 화면이 먼저 나온다(linkedin.com/in/… 만 통과).
- **Demo controls(View as, 데모 버튼, Reset demo)는 없앴다.** 두 사람 화면을 같이 보려면 일반 창 + 시크릿 창(또는 폰 두 대)으로 각각 로그인한다.
- **Claude 키**: `ANTHROPIC_API_KEY`는 Development와 Production Convex 환경 변수에 모두 들어가 있다(코드·파일에는 없음, 10/25 02:20 ping으로 둘 다 확인). 키가 없거나 호출이 실패하면 후속 메시지는 기본 문장(`templateMessage`, "Template" 표시), Huddle은 관심사 겹침("Based on shared interests"), AI 매칭은 관심사 매칭으로 나온다.
- **후속 메시지는 대화를 못 하고 끝난 모든 경우**: 떠남·Leaving now·Speaker→Guest·거절(Not now)·Didn't show. 게스트가 스스로 Cancel한 경우는 없음. 구분은 `chatRequests.closedBecause`.
- **예시 LinkedIn 주소**는 `linkedin.com/in/spot-demo-…` 형식이라 실제 페이지가 아니다.
- **예시 행사 2개**(Founders & Coffee SF, Bay Area Robotics Expo)는 앱을 처음 열 때 자동으로 생긴다. 사람은 없다.
- **떠나는 시간**: Now 화면에서 In 10 min / In 30 min / In 1 hour, 또는 Other 칸에 1~180분 입력 후 Set. 행사 종료 뒤로는 막는다. 서버 시각 기준이라 폰 시계가 틀려도 모든 화면에서 같은 값(4장 "떠나는 시간"). Leaving now는 화면 안에서 한 번 확인한 뒤 바로 줄을 닫는다. (팀원이 만든 "시각 입력" 방식은 서버에 `leavingAt` 인자로 남아 있지만 화면은 분 입력을 쓴다.)
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
| 프로필(계정)과 행사 참가를 분리 | 같은 사람이 행사마다 Speaker/Guest가 다르고, 인상착의는 그날만 유효. 요청·Huddle은 참가 id 그대로라 변경 최소 |
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
- 10/24 07:43 팀 피드백 3: profiles 분리·여러 행사·행사별 역할·Edit profile·LinkedIn, 마이그레이션 profiles-and-events-v1, 예시 행사 2개
- 10/24 09:59 팀 피드백 4: 떠난 패널의 LinkedIn + Claude(haiku 5.5) 후속 메시지 초안·Copy, Speaker→Guest 때도 같은 흐름, 데모 "leaves now" 버튼
- 10/24 19:51 PanelDetail의 "may have moved" 문구를 "Still here?" 버튼으로 교체, 상대에게 Still here / I moved 알림, 답하면 물어본 사람에게 배너 (users.stillHereAskedAt 추가)
- 10/25 02:20 실데모 준비: 가상 인물 전부 삭제(wipe-people-v1, 예시 게스트 Jimin Kim·Logan Kim만), LinkedIn 필수·중복 불가·LinkedIn으로 Log in, Me의 Demo controls 삭제·Log out 추가, 모든 사용자 Edit profile, 떠나는 시간 10/30/Other(시각 입력)·남은 시간 오차 수정. 로컬 Convex로 두 브라우저 실시간 요청·수락 확인. main의 AI 매칭(WIP)과 dltkddud의 remove-demo-people-v1·admin 명령 위에 merge, Demo controls의 Match 데모 버튼도 같이 뺌(서버 함수 demoTheySayYes·demoIncoming은 남아 있지만 화면에서 안 씀)
- 10/25 02:15 AI 매칭 WIP(ai-matching-wip 브랜치)와 GitHub main(Still here 등) 합침, `aiCheck:ping` 추가(Dev·Prod ok), Claude / 대체 표시
- 10/25 02:25 예시 인물·Demo controls 삭제(remove-demo-people-v1, Prod 실행됨), `admin:listParticipants`·`removeParticipants`·`resetActivity`
- 10/25 02:35 LinkedIn 필수(프로필 주소만)·Add your LinkedIn 화면, 대화 못 한 모든 경우 LinkedIn+Claude 메시지(closedBecause speaker_left/declined/missed), Requests의 Keep in touch, Now의 Leaving now·I'm back·People you missed
- 10/25 02:40 팀원의 실데모 준비(LinkedIn 로그인, wipe-people-v1, Jimin·Logan)와 다시 합침. 떠나는 시간은 10/30/60 + 분 입력·서버 시각 기준으로(원인: ceil + 10초마다 갱신된 now + 시계 차이)
- 10/25 02:45 Huddle을 Claude가 묶음(huddlesNode.match, reason·whyYou·sharedQuestion, prompts/huddle.md, 8초·실패 시 관심사 겹침)
- 10/25 02:50 Explore 핵심 먼저(Speakers → Your people → AI matches), 패널 상세 요청 박스 위로·떠난 패널 페이지에 후속 메시지, 입력 안내 "Spot uses this to match you and form huddles.", 로딩 문구
- 10/25 03:30 나에게 온 요청은 Requests 탭 "Requests to you"로(Now는 상태·떠나는 시간·요약), 게스트끼리 1:1 요청(Huddle은 Speaker만), 10분 대화(제안·타이머) 삭제·AI 매치 카드는 Request to chat으로
- 10/25 03:40 Explore → People의 Speakers 아래에 Guests 목록(같은 필터·카드, 누르면 프로필 → Request to chat)
