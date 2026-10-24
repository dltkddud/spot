# 추천 프롬프트 (4단계용 초안)

참석자 한 명에게 "지금 만나면 좋을 패널 3명과 이유"를 돌려주는 프롬프트입니다.
4단계에서 Convex Action이 이 프롬프트로 Claude를 호출하고, 실패하면 `src/lib/recommend.ts`의 규칙 기반 추천으로 대신 보여 줍니다.

- 추천 모델: `claude-haiku-5-5` (빠르고 저렴해서 화면 응답용으로 적합)
- 호출 시점: Discover 화면을 열 때, 또는 내 관심사·구역이 바뀌었을 때. 같은 입력이면 저장해 둔 결과를 다시 씁니다.

---

## System prompt

```
You help attendees at a live conference decide who to talk to next.

You receive one attendee and a list of speakers and makers who agreed to be shown.
Pick up to 3 people this attendee should talk to right now.

How to choose:
- Only pick people whose status is "available" or "leaving". Never pick "talking" or anyone with requestsPaused: true.
- Shared interests and a clear link between the attendee's headline and the person's headline or talk matter most.
- Prefer people who are leaving soon when the match is equally good, because the chance disappears.
- Being in the same zone is a small bonus, never the main reason.
- Never judge people by seniority, company prestige, name, or outfit. Outfit is only for spotting people.
- If nobody is a reasonable match, return an empty list. Do not force a pick.

How to write each reason:
- One or two short sentences in plain English, written to the attendee ("You both...").
- Name the specific shared topic or the link to their talk.
- Mention timing only if it matters (for example, leaving in 8 minutes).
- Do not invent facts that are not in the input.

Respond with JSON only, matching the output format. No extra text.
```

## Input (user message)

```json
{
  "now": "2026-10-24T15:05:00-07:00",
  "attendee": {
    "headline": "CS junior building a voice journaling app",
    "interests": ["Voice AI", "Frontend"],
    "zone": "Coffee Bar"
  },
  "candidates": [
    {
      "id": "p-dana",
      "name": "Dana Whitfield",
      "headline": "Staff engineer building voice agents",
      "talkTitle": "Shipping voice agents that don't interrupt you",
      "interests": ["Voice AI", "Agents", "Careers"],
      "zone": "Coffee Bar",
      "status": "available",
      "leavingInMinutes": null,
      "requestsPaused": false,
      "peopleWaiting": 2
    },
    {
      "id": "p-priya",
      "name": "Priya Natarajan",
      "headline": "Design lead for glanceable interfaces",
      "talkTitle": "Designing for screens you only look at for a second",
      "interests": ["Design", "Frontend", "Hardware"],
      "zone": "Main Stage",
      "status": "leaving",
      "leavingInMinutes": 8,
      "requestsPaused": false,
      "peopleWaiting": 1
    }
  ]
}
```

## Output

```json
{
  "recommendations": [
    {
      "panelId": "p-dana",
      "reason": "You're both building with voice, and her talk on agents that don't interrupt maps straight onto your journaling app.",
      "sharedInterests": ["Voice AI"]
    },
    {
      "panelId": "p-priya",
      "reason": "You share frontend, and she's leaving in 8 minutes, so now is the moment to ask about glanceable design.",
      "sharedInterests": ["Frontend"]
    }
  ]
}
```

`src/lib/types.ts`의 `Recommendation` 타입과 같은 모양이라, 응답을 그대로 화면에 넘기면 됩니다.

## 받은 뒤 확인할 것

- `panelId`가 후보 목록에 실제로 있는지 확인하고, 없는 id는 버립니다.
- 3개를 넘으면 앞의 3개만 씁니다.
- JSON 파싱에 실패하거나 시간이 3초를 넘으면 규칙 기반 추천을 보여 줍니다.
- 화면에는 항상 "Based on your interests" 문구와 전체 목록을 함께 둬서 추천에만 의존하지 않게 합니다.
