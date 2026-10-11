from __future__ import annotations

from .loader import S


def classify_emotion(text: str) -> tuple:
    """KcELECTRA → (감정 라벨, 확률)"""
    import torch

    inputs = S.tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
    with torch.no_grad():
        probs = torch.softmax(S.emotion_model(**inputs).logits, dim=-1)[0]
    idx = int(probs.argmax())
    return S.emotion_labels[idx], float(probs[idx])
