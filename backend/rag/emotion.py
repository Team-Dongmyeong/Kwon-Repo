from __future__ import annotations

from .loader import S


def classify_emotion_probs(text: str) -> tuple:
    """KcELECTRA → (가장 높은 감정, 그 확률, 7개 감정별 확률 dict)"""
    import torch

    inputs = S.tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
    with torch.no_grad():
        probs = torch.softmax(S.emotion_model(**inputs).logits, dim=-1)[0]
    idx = int(probs.argmax())
    prob_dict = {label: float(p) for label, p in zip(S.emotion_labels, probs.tolist())}
    return S.emotion_labels[idx], float(probs[idx]), prob_dict


def classify_emotion(text: str) -> tuple:
    """KcELECTRA → (감정 라벨, 확률)  ※ 예전 코드 호환용"""
    label, conf, _ = classify_emotion_probs(text)
    return label, conf
