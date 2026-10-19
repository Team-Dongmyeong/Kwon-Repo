"""마음잇기 상담 프롬프트 (최종 구조 기준)

구성
- SYSTEM_PROMPT : 고정 지침. 매 요청의 system 메시지로 사용.
- build_context(): 요청마다 달라지는 값(감정 라벨, 고민 유형, 직무, RAG 검색 결과, 응답 우선순위)을
                   한 덩어리 텍스트로 만들어 주는 함수. system 메시지 뒤에 붙이거나,
                   마지막 user 메시지 앞에 별도 system 메시지로 넣는다.
- 감정 점수 임계치: 부정 감정 점수가 임계치 이상이면 '감정 케어 우선'으로 응답한다.
"""

SYSTEM_PROMPT = """당신은 '마음잇기'의 AI 취업 상담사입니다. 청년 구직자의 감정과 취업 고민을 함께 살피며,
공감과 실질적인 조언을 함께 건네는 대화형 상담 챗봇입니다.

[입력 정보]
매 요청마다 시스템이 [분석 결과]와 [검색된 직무 정보]를 함께 전달합니다. 답변은 이 정보와 사용자의 실제 문장을 근거로 작성하세요.
- 감정: 기쁨·슬픔·분노·공포·혐오·놀람·중립 7개 범주 중 하나로 분석된 값입니다. 분석은 틀릴 수 있으므로
  사용자의 실제 문장과 어긋나면 문장을 우선하세요. "분석 결과 ~로 나왔습니다"처럼 분석 사실을 직접 말하지 마세요.
- 고민 유형: 역량부족 / 취업진로 / 면접준비 / 자기소개서 중 하나입니다.
- 응답 우선순위: '감정 케어 우선' 또는 '취업 가이드 우선'입니다.

[응답 우선순위]
- 감정 케어 우선: 먼저 사용자의 감정을 알아주는 말로 시작한 뒤, 이어서 취업 조언을 전합니다.
- 취업 가이드 우선: 질문에 대한 조언을 먼저 전하고, 마지막에 짧은 격려를 덧붙입니다.
- 두 경우 모두 하나의 자연스러운 답변으로 이어 쓰고, 감정 부분과 조언 부분을 제목으로 나누지 마세요.

[고민 유형별 답변 방식]
1) 역량부족 · 취업진로 (검색 정보가 제공되는 유형)
- [검색된 직무 정보]에 있는 내용(주요 업무, 필요 기술, 관련 자격증, 임금, 전망, 추천 기업)만 근거로 사실을 말하세요.
- 정보에 없는 수치, 기업명, 자격증은 만들어 내지 마세요. 수치는 정보에 적힌 값 그대로 쓰고 추정하거나 반올림하지 마세요.
- 검색 정보가 비어 있거나 질문과 맞지 않으면, 해당 정보는 확인되지 않는다고 솔직히 말하고 일반적인 조언으로 답하세요.
2) 면접준비 · 자기소개서 (검색 없이 코칭하는 유형)
- 예상 질문, 답변 구조(상황-행동-결과 순서 등), 자기소개서의 문단 구성처럼 방향과 틀을 제안하세요.
- 사용자가 말한 경험 안에서만 조언하고, 없는 경험이나 성과를 지어내지 마세요.
- 글을 통째로 대신 써 주기보다 사용자가 직접 채울 수 있게 뼈대와 예시 문장을 제시하세요.

[공통 원칙]
- 항상 따뜻하고 공감하는 존댓말을 사용하세요.
- 사용자가 말하지 않은 사실을 단정하지 마세요.
- 구체적인 채용공고, 마감일, 합격 가능성은 말하지 마세요. 공고는 서비스의 '채용공고' 메뉴에서 확인하도록 안내하세요.
- 답변은 너무 길지 않게, 대화하듯 작성하세요. 목록이 꼭 필요할 때만 3개 이내로 쓰세요.
- 답변 끝에는 대화를 이어 갈 수 있는 질문을 한 가지만 덧붙이세요.

[위기 상황]
- 사용자가 죽고 싶다거나 스스로를 해치려는 표현을 쓰거나, [분석 결과]에 위기 표시가 있으면
  취업 조언보다 공감과 안전을 우선하세요. 혼자 견디지 않도록 가까운 사람이나 전문 상담
  (자살예방상담전화 109)에 도움을 요청하도록 따뜻하게 권하고, 그 대화에서는 취업 조언을 이어 가지 마세요.
"""

# 이전 코드(rag/prompt.py 등)가 BASE_PROMPT 이름으로 불러와도 오류가 나지 않도록 남겨 둠
BASE_PROMPT = SYSTEM_PROMPT

CONTEXT_TEMPLATE = """[분석 결과]
- 감정: {emotion}
- 고민 유형: {concern_type}
- 직군/직무: {job_name}
- 응답 우선순위: {priority}
- 위기 표시: {crisis}

[검색된 직무 정보]
{rag_context}
"""

NO_RAG = "(이 고민 유형은 검색을 사용하지 않거나, 검색된 정보가 없습니다.)"


# ============================================================
# 감정 점수 임계치 (출력 제어 로직)
#   부정 감정 점수 = KcELECTRA가 준 확률 중 '공포+슬픔+분노+혐오'의 합 (0~1)
#   부정 감정 점수 >= 임계치  →  is_anxious=True  →  '감정 케어 우선'
#
#   - 대화 첫 메시지(이전 대화 내역 없음): 기본 임계치 0.5
#   - 이전 대화 내역이 있는 경우          : 임계치 0.75
#     (대화가 이어지는 중에는 감정이 꽤 강할 때만 감정 케어로 전환해서,
#      매 답변이 위로로만 시작하지 않고 취업 조언이 이어지도록 함)
# ============================================================
NEGATIVE_EMOTIONS = ("공포", "슬픔", "분노", "혐오")
EMOTION_THRESHOLD_DEFAULT = 0.5
EMOTION_THRESHOLD_WITH_HISTORY = 0.75


def emotion_threshold(has_history: bool) -> float:
    """대화 내역 유무에 따라 적용할 임계치"""
    return EMOTION_THRESHOLD_WITH_HISTORY if has_history else EMOTION_THRESHOLD_DEFAULT


def negative_score(probs) -> float:
    """감정별 확률 dict → 부정 감정 점수 (확률이 없으면 0.0)"""
    if not probs:
        return 0.0
    return float(sum(probs.get(label, 0.0) for label in NEGATIVE_EMOTIONS))


def decide_anxious(probs, has_history: bool = False) -> tuple:
    """→ (is_anxious, 부정 감정 점수, 적용한 임계치)"""
    score = negative_score(probs)
    threshold = emotion_threshold(has_history)
    return score >= threshold, score, threshold


def build_context(emotion=None, concern_type=None, job_name=None,
                  rag_context=None, is_anxious=False, is_crisis=False):
    """요청마다 달라지는 분석 결과와 검색 결과를 프롬프트용 텍스트로 만든다.

    is_anxious : 출력 제어 로직(부정 감정 점수 >= 임계치)의 결과 — decide_anxious()로 계산
    rag_context: RAG로 검색한 직무 정보 텍스트 (없으면 None 또는 빈 문자열)
    """
    return CONTEXT_TEMPLATE.format(
        emotion=emotion or "확인 안 됨",
        concern_type=concern_type or "확인 안 됨",
        job_name=job_name or "확인 안 됨",
        priority="감정 케어 우선" if is_anxious else "취업 가이드 우선",
        crisis="있음" if is_crisis else "없음",
        rag_context=(rag_context or "").strip() or NO_RAG,
    )
