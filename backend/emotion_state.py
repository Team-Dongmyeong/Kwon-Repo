"""마이페이지 > 감정상태 : 기본 감정 점수 + 상담에 따른 변화

규칙
- 6개 감정(공포·놀람·분노·슬픔·행복·혐오)은 모두 기본 25점(0.25)에서 시작한다. (합계 150점)
- 사용자 메시지 1개마다 감정 모델이 준 7개 감정 확률(chat_messages.emotion_probs)을 반영한다.
    · 확률이 FEEL_MIN(0.10) 이상인 감정 = 그 메시지에서 '느껴진 감정' → 모두 오른다.
      오르는 양은 각자의 확률에 비례 (STEP × 확률) → 감정마다 오르는 폭이 다름
    · 느껴지지 않은 감정은 오른 양의 합만큼 나눠서 조금씩 내려간다 → 합계 150점 유지
    · '중립' 확률은 어느 감정도 올리지 않으므로, 중립적인 질문은 점수가 거의 안 바뀐다.
- 상담 기록이 없으면 6개 모두 25점.
- 별도 테이블 없이, /emotions/summary 요청 때 chat_messages 기록을 처음부터 다시 계산한다.

예) "면접에 또 떨어져서 슬프고, 다음 면접도 무섭고 화가 나요"
    확률: 슬픔 0.55 · 공포 0.25 · 분노 0.12 · 나머지 작음
    → 슬픔 +11.0, 공포 +5.0, 분노 +2.4 / 나머지 3개 감정은 각 -6.1

※ 7개 확률을 저장하기 전에 쌓인 예전 메시지(emotion, emotion_conf만 있음)는
  '가장 큰 감정 = 확신도, 나머지 = 남은 확률을 똑같이 나눔'으로 추정해서 계산한다.
"""
from __future__ import annotations

EMOTIONS = ("공포", "놀람", "분노", "슬픔", "행복", "혐오")   # 중립 제외 6개 (육각형 축)
ALL_LABELS = EMOTIONS + ("중립",)
BASE_SCORE = 25.0      # 모든 감정의 기본 점수 (0.25)
STEP = 20.0            # 확률 1.0인 감정이 한 메시지에 오르는 최대 폭 (클수록 빨리 변함)
FEEL_MIN = 0.10        # 이 확률 이상이면 '느껴진 감정'으로 보고 점수를 올림
MIN_SCORE, MAX_SCORE = 0.0, 100.0


def default_scores() -> dict:
    return {e: BASE_SCORE for e in EMOTIONS}


def probs_from_label(emotion, conf) -> dict:
    """(예전 기록용) 저장된 (감정, 확신도) → 7개 감정 확률 추정"""
    if emotion not in ALL_LABELS:
        return {}
    try:
        c = float(conf) if conf is not None else 1.0
    except (TypeError, ValueError):
        c = 1.0
    c = min(1.0, max(0.0, c))
    rest = (1.0 - c) / (len(ALL_LABELS) - 1)
    return {label: (c if label == emotion else rest) for label in ALL_LABELS}


def clean_probs(probs) -> dict:
    """모델/GPT가 준 확률 dict → 7개 라벨, 0~1, 합 1로 정리 (이상하면 빈 dict)"""
    if not isinstance(probs, dict):
        return {}
    out = {}
    for label in ALL_LABELS:
        try:
            out[label] = max(0.0, float(probs.get(label, 0.0) or 0.0))
        except (TypeError, ValueError):
            out[label] = 0.0
    total = sum(out.values())
    if total <= 0:
        return {}
    return {label: v / total for label, v in out.items()}


def apply_probs(scores: dict, probs: dict) -> dict:
    """현재 점수 + 메시지 1개의 7개 감정 확률 → 새 점수"""
    probs = clean_probs(probs)
    if not probs:
        return dict(scores)
    felt = {e: probs[e] for e in EMOTIONS if probs[e] >= FEEL_MIN}
    if not felt:                                   # 중립 위주 메시지 → 변화 없음
        return dict(scores)
    new = dict(scores)
    raised = 0.0
    for e, p in felt.items():                      # 느껴진 감정: 각자 확률만큼 상승
        before = new[e]
        new[e] = min(MAX_SCORE, before + STEP * p)
        raised += new[e] - before
    others = [e for e in EMOTIONS if e not in felt]
    if others and raised > 0:                      # 나머지 감정: 오른 만큼 나눠서 하락
        for e in others:
            new[e] = max(MIN_SCORE, new[e] - raised / len(others))
    return new


def message_probs(row: dict) -> dict:
    """chat_messages 1행 → 7개 감정 확률 (emotion_probs가 있으면 그대로, 없으면 추정)"""
    probs = clean_probs(row.get("emotion_probs"))
    return probs or probs_from_label(row.get("emotion"), row.get("emotion_conf"))


def replay(rows) -> dict:
    """오래된 순서의 메시지 기록 → 최종 6개 감정 점수 (소수 1자리)"""
    scores = default_scores()
    for r in rows:
        scores = apply_probs(scores, message_probs(r))
    return {e: round(v, 1) for e, v in scores.items()}
