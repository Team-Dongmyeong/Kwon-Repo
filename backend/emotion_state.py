# """사용자별 누적 감정 점수 (마이페이지 > 감정 상태)

# 규칙
# - 모든 사용자는 6개 감정(공포·놀람·슬픔·분노·행복·혐오)을 각각 기본 25점으로 시작한다. (총 150점)
# - 상담 메시지 1개마다 KcELECTRA 확률로 점수를 다시 배분한다.
#     · 그 메시지에서 많이 나온 감정은 오르고, 거의 안 나온 감정은 조금 내려간다.
#     · 오른 만큼 다른 감정이 내려가므로 6개 합계는 150점 그대로 유지된다(0~100 범위를 넘을 때만 예외).
#     · '중립'이 강한 메시지(예: "연봉이 궁금해요")는 점수를 거의 움직이지 않는다.
# - 상담을 한 번도 안 했으면 DB에 행이 없고, 조회하면 6개 모두 25를 돌려준다.

# 계산식 (메시지 1개)
#     q_e  = 6개 감정 확률 중 e의 비율        (중립 제외 후 합이 1이 되도록 나눔)
#     w    = 1 - 중립 확률                     (중립이 강할수록 덜 움직임)
#     점수_e = 점수_e + STEP × w × (q_e - 1/6)   → 0~100으로 자름
#   예) "면접에서 또 떨어져서 너무 우울해요" (슬픔 0.90, 중립 0.02)
#       슬픔 25 → 39.7, 나머지 5개는 25 → 22.1  (합계 150 유지)
# """
# from __future__ import annotations

# from datetime import datetime, timezone

# EMOTIONS = ("공포", "놀람", "슬픔", "분노", "행복", "혐오")
# BASE_SCORE = 25.0      # 모든 감정의 기본 점수 (0.25)
# STEP = 20.0            # 한 메시지로 움직이는 폭 (클수록 빨리 변함)
# MIN_SCORE, MAX_SCORE = 0.0, 100.0

# STATE_TABLE = "user_emotion_scores"   # 사용자별 현재 점수 (1명당 1행)
# LOG_TABLE = "emotion_score_logs"      # 메시지마다의 점수 기록 (최근 패턴/추이용)


# def default_scores() -> dict:
#     return {e: BASE_SCORE for e in EMOTIONS}


# def _clean(scores) -> dict:
#     """DB에서 읽은 값 → 6개 감정이 모두 있는 dict (빠진 감정은 기본값)"""
#     scores = scores or {}
#     return {e: float(scores.get(e, BASE_SCORE)) for e in EMOTIONS}


# def apply_probs(scores: dict, probs: dict) -> dict:
#     """현재 점수 + 이번 메시지의 감정 확률(7개) → 새 점수"""
#     scores = _clean(scores)
#     if not probs:
#         return scores
#     six = {e: max(float(probs.get(e, 0.0)), 0.0) for e in EMOTIONS}
#     total = sum(six.values())
#     if total <= 0:
#         return scores
#     weight = max(0.0, 1.0 - float(probs.get("중립", 0.0)))
#     new = {}
#     for e in EMOTIONS:
#         delta = STEP * weight * (six[e] / total - 1.0 / len(EMOTIONS))
#         new[e] = round(min(MAX_SCORE, max(MIN_SCORE, scores[e] + delta)), 1)
#     return new


# def dominant(scores: dict):
#     """가장 높은 감정. 모두 같으면(=아직 상담 전) None"""
#     scores = _clean(scores)
#     top = max(scores.values())
#     if all(abs(v - top) < 1e-9 for v in scores.values()):
#         return None
#     return max(scores, key=scores.get)


# def summarize(scores: dict, updated_at=None, history=None) -> dict:
#     """마이페이지 응답 형태"""
#     scores = _clean(scores)
#     items = sorted(({"emotion": e, "score": scores[e]} for e in EMOTIONS),
#                    key=lambda x: x["score"], reverse=True)
#     return {
#         "base_score": BASE_SCORE,
#         "scores": scores,                       # {"공포": 25.0, ...}  (차트용)
#         "items": items,                         # 높은 순 정렬 (최근 주요 감정 패턴용)
#         "dominant": dominant(scores),           # 상담 전이면 None
#         "is_default": updated_at is None,       # True면 아직 상담 기록이 없어서 전부 기본값(25)
#         "updated_at": updated_at,
#         "history": history or [],               # 최근 점수 기록 (오래된 것 → 최신)
#     }


# # ── DB 읽기/쓰기 (db = service_role Supabase 클라이언트) ─────────────────
# def get_state(db, user_id: str, history_limit: int = 10) -> dict:
#     rows = db.table(STATE_TABLE).select("scores, updated_at").eq("user_id", user_id).execute().data
#     if not rows:
#         return summarize(default_scores())
#     history = []
#     if history_limit:
#         try:
#             logs = (db.table(LOG_TABLE).select("scores, emotion, created_at")
#                     .eq("user_id", user_id).order("id", desc=True).limit(history_limit)
#                     .execute().data)
#             history = [{"scores": _clean(r["scores"]), "emotion": r.get("emotion"),
#                         "created_at": r.get("created_at")} for r in reversed(logs)]
#         except Exception as e:   # 기록 테이블이 없어도 현재 점수는 보여줌
#             print(f"[감정점수] 기록 조회 실패: {e!r}")
#     return summarize(rows[0]["scores"], rows[0]["updated_at"], history)


# def update_state(db, user_id: str, probs: dict, session_id=None, emotion=None) -> dict:
#     """상담 메시지 1개 반영 → 새 점수 dict 반환"""
#     rows = db.table(STATE_TABLE).select("scores").eq("user_id", user_id).execute().data
#     current = rows[0]["scores"] if rows else default_scores()
#     new = apply_probs(current, probs)
#     now = datetime.now(timezone.utc).isoformat()
#     db.table(STATE_TABLE).upsert({"user_id": user_id, "scores": new, "updated_at": now}).execute()
#     try:
#         db.table(LOG_TABLE).insert({"user_id": user_id, "session_id": session_id,
#                                     "emotion": emotion, "scores": new}).execute()
#     except Exception as e:
#         print(f"[감정점수] 기록 저장 실패: {e!r}")
#     return new

"""마이페이지 > 감정상태 : 기본 감정 점수 + 상담에 따른 변화

규칙
- 6개 감정(공포·놀람·분노·슬픔·행복·혐오)은 모두 기본 25점(0.25)에서 시작한다. (합계 150점)
- 사용자 메시지 1개마다(chat_messages에 저장된 emotion, emotion_conf) 점수를 다시 배분한다.
    · 그 메시지의 감정은 오르고, 나머지 감정은 조금씩 내려간다 → 합계 150점 유지 (0~100 범위를 넘을 때만 예외)
    · '중립' 메시지("연봉이 궁금해요" 등)는 점수를 거의 움직이지 않는다.
- 상담 기록이 없으면 6개 모두 25점.
- 별도 테이블 없이, /emotions/summary 요청 때 chat_messages 기록을 처음부터 다시 계산한다.
  (KcELECTRA 결과든 GPT 대체 분류 결과든 같은 방식으로 반영됨)

계산식 (메시지 1개)
    확률 추정 : 저장된 감정 = 확신도, 나머지 6개 감정 = (1 - 확신도) / 6
    q_e  = 6개 감정(중립 제외) 확률 중 e의 비율
    w    = 1 - 중립 확률
    점수_e = 점수_e + STEP × w × (q_e - 1/6)   → 0~100 범위로 자름
  예) 슬픔(확신도 0.90) 메시지 1개 → 슬픔 25 → 39.7, 나머지 5개 25 → 22.1
"""
from __future__ import annotations

EMOTIONS = ("공포", "놀람", "분노", "슬픔", "행복", "혐오")   # 중립 제외 6개 (육각형 축)
ALL_LABELS = EMOTIONS + ("중립",)
BASE_SCORE = 25.0      # 모든 감정의 기본 점수 (0.25)
STEP = 20.0            # 한 메시지로 움직이는 폭 (클수록 빨리 변함)
MIN_SCORE, MAX_SCORE = 0.0, 100.0


def default_scores() -> dict:
    return {e: BASE_SCORE for e in EMOTIONS}


def probs_from_label(emotion, conf) -> dict:
    """저장된 (감정, 확신도) → 7개 감정 확률 추정"""
    if emotion not in ALL_LABELS:
        return {}
    try:
        c = float(conf) if conf is not None else 1.0
    except (TypeError, ValueError):
        c = 1.0
    c = min(1.0, max(0.0, c))
    rest = (1.0 - c) / (len(ALL_LABELS) - 1)
    return {label: (c if label == emotion else rest) for label in ALL_LABELS}


def apply_probs(scores: dict, probs: dict) -> dict:
    """현재 점수 + 메시지 1개의 감정 확률 → 새 점수"""
    if not probs:
        return dict(scores)
    six = {e: max(float(probs.get(e, 0.0)), 0.0) for e in EMOTIONS}
    total = sum(six.values())
    if total <= 0:
        return dict(scores)
    weight = max(0.0, 1.0 - float(probs.get("중립", 0.0)))
    return {
        e: min(MAX_SCORE, max(MIN_SCORE, scores[e] + STEP * weight * (six[e] / total - 1.0 / len(EMOTIONS))))
        for e in EMOTIONS
    }


def replay(rows) -> dict:
    """오래된 순서의 메시지 기록([{emotion, emotion_conf}, ...]) → 최종 6개 감정 점수 (소수 1자리)"""
    scores = default_scores()
    for r in rows:
        scores = apply_probs(scores, probs_from_label(r.get("emotion"), r.get("emotion_conf")))
    return {e: round(v, 1) for e, v in scores.items()}
