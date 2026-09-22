# 마음잇기 — AI 모델 학습 및 검증 전략 노트

> 작성 배경: 프론트엔드(로그인/회원가입/랜딩) 작업 이후, 백엔드 착수 전 단계에서 나온 AI 모델 관련 고민을 정리한 문서. `PROJECT_STATE.md`(프론트엔드 진행 상황)와는 별도로, 모델·데이터 쪽 의사결정을 추적하기 위한 문서.
> 최종 업데이트: 2026-09-07 — 0순위 held-out 평가 완료, 실제 결과 반영.

## 1. 배경 — 왜 이 논의가 필요했나

기존 계획은 "사용자의 짧은 대화 → kcELECTRA/SBERT로 감정·키워드 분류 → 직무/채용정보 추천"이었는데, 실제로 검토해보니 두 가지 우려가 확인됨.

- **대화 데이터 부족**: 몇 턴 안 되는 짧은 대화만으로 정밀한 직무 매칭을 하기엔 정보가 부족함.
- **라벨 체계의 데이터 불균형**: `class_weights.json`은 "대화에서 가져올 키워드 목록"이 아니라, 대분류(5개) · 중분류(약 40개) · 소분류(고민 유형 4개) 조합을 예측하는 분류기의 클래스 불균형 보정 가중치임. weight 값이 큰 카테고리(공공·복지 6.79, 홀서버 6.80, UI·UX디자이너 5.28 등)는 학습 데이터가 적다는 신호라, 해당 카테고리에서 실제 정확도가 낮을 가능성이 높다고 예상했었음 — **이 예상은 아래 3장의 실제 평가로 확인됨.**

## 2. 결정된 방향 — 세 가지가 하나로 연결됨

1. **사전 검사(정적) + 대화 누적(동적)의 이중 구조**로 데이터 부족 문제를 보완한다. 가입 직후 itdaa식 진로/인성/기업핏 검사로 "초기 프로필"을 만들고, 이후 대화 분석 결과를 초기 프로필에 점진적으로 반영해 마이페이지 결과가 서서히 갱신되도록 한다.
2. **데이터 증강을 폴백보다 먼저** 진행한다. GPT(OpenAI API)로 부족한 카테고리(weight가 큰 조합)의 학습 문장을 합성 생성해 SBERT 재학습 데이터셋을 보강 — 이미 1차 증강판(`train_stratified.csv`)으로 학습·평가까지 완료됨(3장 참고). 2차로는 **약점으로 확인된 카테고리만 표적 증강**한다(3-4장 참고).
3. **실시간 하이브리드 폴백은 그다음 단계**. 로컬 분류기가 확신도 낮은 케이스만 GPT로 보강 — 임계값은 아래 held-out 결과를 근거로 정한다(3-5장).
4. 사전 검사 문항 내용은 아직 미정(검사지 리서치 필요) — 문항 내용과 무관하게 **구조(스키마)는 먼저 설계 가능**하므로 이후 단계에서 별도 진행.

## 3. 0순위 — 학습된 모델의 held-out 성능 (완료)

### 3-1. SBERT 평가 결과 (148-way 결합 라벨, 1-NN 방식)

`train_stratified.csv` / `test_stratified.csv` (증강판) 기준, `fine_tuned_kr_sbert_148_perfect` 모델로 held-out 평가를 실행함.

| granularity | 정확도 | 비고 |
| --- | --- | --- |
| 148-way 결합 라벨 (대분류\|\|중분류\|\|소분류 전체) | **accuracy 0.57 / macro-F1 0.42 / weighted-F1 0.56** | 가장 세밀한 단위 — 저빈도 클래스가 많아 macro-F1이 accuracy보다 낮게 나옴(예상된 패턴) |
| 대분류 (5개) | **accuracy 0.9595** | 실사용 가능 수준 — 상위 카테고리 구분은 거의 완벽 |
| 중분류 (~40개) | **accuracy 0.7203** | 실사용 가능하지만 개선 여지 있음 |

**해석**: 95.9% → 72.0% → 57%로 세분화될수록 정확도가 떨어지는 것은 계층적 분류 문제에서 자연스러운 패턴(구분해야 할 클래스 수가 늘고, 클래스당 데이터가 줄기 때문)이라 "모델이 망가졌다"는 신호가 아님. 오히려 **대분류 단위는 이미 프로덕션에 써도 될 정도로 강함**을 확인한 것이 이번 평가의 핵심 성과.

### 3-2. 약점 카테고리 — 식/음료, 디자인에 집중

148-way 리포트에서 f1-score가 낮은 하위 15개 라벨을 뽑아보니, **식/음료 계열**(홀서버, 바리스타, 주방보조 등)과 **디자인 계열**(UI·UX디자이너, 그래픽디자이너 등) 카테고리에 약점이 몰려 있음. 이는 `class_weights.json`에서 weight가 크게 나왔던(=학습 데이터가 적었던) 바로 그 카테고리들과 정확히 일치함 — **사전 우려가 실측으로 확인된 것**이며, 원인이 막연한 "모델 성능 부족"이 아니라 **특정 카테고리의 데이터 부족**이라는 구체적이고 해결 가능한 문제로 좁혀짐.

### 3-3. 원인 진단 — 배치 구성 이슈 (재학습으로 검증 예정)

기존 학습 코드는 `BatchHardTripletLoss`를 쓰면서 `InputExample` 리스트를 `DataLoader(shuffle=True, batch_size=32)`에 그대로 넣었음. 이 손실 함수는 **한 배치 안에 동일 라벨이 최소 2개 이상 있어야** anchor-positive 쌍을 만들 수 있는데, 148개 라벨 중 32개짜리 배치에 우연히 같은 라벨이 2개 이상 들어갈 확률이 낮아 유효한 triplet을 못 찾는 배치가 많았을 가능성이 있음. 특히 **원래 데이터가 적은 카테고리(식/음료·디자인)일수록 이 문제의 영향을 더 크게 받았을 것**으로 추정 — 데이터가 적으면 같은 라벨이 한 배치에 우연히 모일 확률이 더 낮아지기 때문. 즉 "데이터 부족 문제"와 "배치 구성 문제"가 같은 카테고리에서 중첩되어 약점을 더 키웠을 가능성이 높음.

(참고: 이 문제가 있었음에도 148-way 0.57 / 대분류 0.96이 나온 것을 보면 학습 자체가 완전히 실패한 건 아니고, 정확히 저빈도 클래스에서만 손해를 본 것으로 보임 — 아래 재학습으로 이 가설을 검증한다.)

### 3-4. 중기 작업 — `SentenceLabelDataset` 적용 재학습

같은 라벨끼리 배치 내 co-occurrence를 보장하도록 데이터 로더만 교체하고, 나머지 학습 코드(모델, loss, epoch 등)는 기존과 동일하게 유지 — **재학습 전/후를 공정하게 비교**하기 위해 다른 변수는 건드리지 않음.

```python
import os
import json
import pandas as pd
from sentence_transformers import SentenceTransformer, InputExample, losses
from sentence_transformers.datasets import SentenceLabelDataset
from torch.utils.data import DataLoader

BASE_DIR = "/content/drive/MyDrive/Colab Notebooks/키워드분류모델"
DATA_DIR = os.path.join(BASE_DIR, "Datasets")
MODEL_DIR = os.path.join(BASE_DIR, "Models")

# 기존 모델을 다시 불러와 이어서 재학습하지 않고,
# 원래 베이스 모델(snunlp/KR-SBERT-...)에서 새로 학습 — 재현성 확보
BASE_MODEL_NAME = "snunlp/KR-SBERT-V40K-klueNLI-augSTS"
NEW_MODEL_DIR = os.path.join(MODEL_DIR, "fine_tuned_kr_sbert_148_v2")

train_df = pd.read_csv(os.path.join(DATA_DIR, "train_stratified.csv"))

# label_map_148.json: {"대분류||중분류||소분류": id} 형태로 이미 갖고 있는 매핑을 그대로 사용
with open(os.path.join(MODEL_DIR, "label_map_148.json"), encoding="utf-8") as f:
    label_map = json.load(f)

train_examples = [
    InputExample(texts=[row["text"]], label=label_map[row["combined_label"]])
    for _, row in train_df.iterrows()
]

model = SentenceTransformer(BASE_MODEL_NAME)

# 핵심 변경점: SentenceLabelDataset이 배치를 "라벨별로 묶어서" 구성 →
# 한 배치 안에 동일 라벨이 samples_per_label개씩 반드시 포함되도록 보장.
# 이렇게 해야 BatchHardTripletLoss가 매 배치에서 유효한 anchor-positive 쌍을 찾을 수 있음.
train_dataset = SentenceLabelDataset(train_examples, samples_per_label=2)
train_dataloader = DataLoader(train_dataset, batch_size=32)

train_loss = losses.BatchHardTripletLoss(model=model)

model.fit(
    train_objectives=[(train_dataloader, train_loss)],
    epochs=10,          # 기존 계획과 동일하게 유지 (공정 비교)
    warmup_steps=100,
    output_path=NEW_MODEL_DIR,
    show_progress_bar=True,
)

print(f"재학습 완료 — 저장 위치: {NEW_MODEL_DIR}")
```

재학습 후에는 **3-1과 완전히 동일한 평가 코드**(1-NN + `classification_report`, 148-way/대분류/중분류 3단계)를 `NEW_MODEL_DIR` 모델에 대해 다시 돌려 세 가지를 비교한다.

- 148-way / 대분류 / 중분류 accuracy가 기존 대비 개선되었는지
- 특히 **식/음료·디자인 카테고리의 f1-score**가 개선되었는지 (이게 이번 재학습의 목표 지표)
- 개선이 크지 않다면, 원인은 "배치 구성"이 아니라 순수 "데이터 부족"이라는 뜻이므로 → 다음 단계(표적 GPT 증강)로 넘어감

### 3-5. 다음 단계 — 표적 GPT 증강 (재학습 결과에 따라)

재학습으로도 식/음료·디자인 카테고리가 여전히 약하면, 해당 카테고리만 콕 집어 GPT로 학습 문장을 추가 생성 — 전체 데이터셋을 다시 증강하는 대신, weight가 컸던(=데이터가 적었던) 특정 조합에만 리소스를 집중. `class_weights.json`에서 weight 상위 카테고리 목록을 그대로 우선순위 리스트로 사용하면 됨.

### 3-6. 결론 — 지금 단계에서 무엇을 발표/공유해도 되는가

- **대분류(5개) 단위 추천/분류는 지금 모델로 자신 있게 사용 가능** — 95.9%는 데모·보고서 어디에 내놔도 되는 수치.
- **중분류(72%)는 "실사용 가능하지만 개선 중"으로 정직하게 표현** — 보고서에는 이 수치와 함께 "재학습 진행 중" 상태를 명시.
- **148-way 세부 결합 라벨(특히 식/음료·디자인)은 보수적으로 취급** — 이 단위로 확정적 추천을 주기보다, 상위 카테고리 추천에 "관련 세부 직무 예시" 정도로 노출하는 게 안전.
- Held-out 수치(정량)와 실제 대화 데모(정성) 둘 다 발표 자료에 포함 — 서로 대체 불가.

### 3-7. KcELECTRA (`train_emotion.csv` / `test_emotion.csv`, 7-class 감정 분류) — 별도 트랙, 아직 평가 전

**계획대로 진행해도 되는 부분**: train/test 분리, `Trainer`의 `eval_dataset`으로 매 epoch f1_macro를 측정하는 구조 — held-out 평가 자체는 잘 짜여 있음.

**확인이 필요한 부분**: `load_best_model_at_end=True` + `metric_for_best_model='f1_macro'`가 test set 기준으로 best epoch을 선택하고 있어, test set이 사실상 검증(validation) 용도로도 쓰이는 셈 — 최종 리포트 수치가 다소 낙관적으로 나올 수 있음. 더 엄밀하게 하려면 train을 다시 train/validation으로 나눠 validation으로 best epoch을 고르고, test는 학습 종료 후 한 번만 확인하는 3-way split 권장. 캡스톤 수준에서는 지금 구조도 통용되는 수준이라 시간이 없으면 그대로 진행 가능. **SBERT처럼 실제 held-out 결과가 아직 공유되지 않음 — 다음 우선순위.**

## 4. 다음 액션 아이템 (업데이트됨)

- [x] SBERT: 1차 증강판(`train_stratified.csv`)으로 held-out 평가 완료 — 148-way 0.57 / 대분류 0.9595 / 중분류 0.7203
- [x] SBERT: 약점 카테고리 식별 완료 — 식/음료·디자인 계열에 집중
- [ ] SBERT: `SentenceLabelDataset` 적용 재학습 실행 (3-4장 코드) → 동일 평가로 개선 여부 확인
- [ ] SBERT: 재학습 후에도 식/음료·디자인이 약하면 해당 카테고리 표적 GPT 증강 (3-5장)
- [ ] SBERT: 증강 전(원본) baseline held-out 평가는 아직 미실행 — 우선순위 낮음(1차 증강판 결과가 이미 실사용 가능 수준이라, 시간 없으면 생략 가능)
- [ ] KcELECTRA: held-out 평가 실행 (SBERT와 동일한 우선순위로 다음 차례)
- [ ] KcELECTRA: 현재 구조(test를 validation 겸용)로 갈지, 3-way split으로 바꿀지 결정
- [ ] 위 held-out 결과를 바탕으로 하이브리드 GPT 폴백 도입 여부·임계값 결정
- [ ] itdaa식 사전 검사(진로/인성/기업핏) 문항 리서치 — 확보되는 대로 문항 구조(척도형/다지선다) 기반으로 화면·채점 로직 설계
- [ ] 사전 검사 결과(정적) + 대화 누적 결과(동적)를 어떻게 합성해 마이페이지에 표시할지 — 데이터 구조(최초 검사 결과 필드, 누적 반영 필드, 합성 가중치) 설계
- [ ] (보류) 로그인 전 사용자에게 기능 메뉴(대화 시작하기/감정 케어/직무 매칭/채용정보)를 자유 열람시킬지, 회원가입으로 바로 유도할지 — UX 방향 결정은 모델 정확도 작업 이후로 미룸
