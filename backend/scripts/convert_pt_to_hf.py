"""
torch.save()로 저장한 KcELECTRA 가중치 파일(.pt / .pth 등)을
transformers가 읽는 형식(model.safetensors)으로 변환합니다.

  (backend 폴더에서)
  python scripts/convert_pt_to_hf.py models/kcelectra_emotion_final models/kcelectra_emotion_final/가중치파일.pt

- 폴더 안에 config.json이 있어야 합니다(있는 상태 확인됨).
- 키 이름이 맞지 않으면(직접 만든 모델 클래스로 학습한 경우) 저장하지 않고 멈춥니다.
"""
import os
import sys

import torch
from transformers import AutoConfig, AutoModelForSequenceClassification

folder, pt_path = sys.argv[1], sys.argv[2]

config = AutoConfig.from_pretrained(folder)
obj = torch.load(pt_path, map_location="cpu", weights_only=False)

if isinstance(obj, torch.nn.Module):
    # torch.save(model) 처럼 모델 통째로 저장한 경우
    model = obj
    print("모델 객체 통째로 저장된 파일입니다.")
else:
    # torch.save(model.state_dict()) 또는 {"model_state_dict": ...} 형태
    state = obj
    if isinstance(obj, dict):
        for k in ("model_state_dict", "state_dict", "model"):
            if k in obj and isinstance(obj[k], dict):
                state = obj[k]
                break
    state = {k.replace("module.", "", 1) if k.startswith("module.") else k: v for k, v in state.items()}
    print("가중치 키 예시:", list(state)[:5])

    model = AutoModelForSequenceClassification.from_config(config)
    missing, unexpected = model.load_state_dict(state, strict=False)
    if missing:
        print("\n[중단] 모델에 들어가지 않은 가중치가 있습니다. 직접 만든 모델 클래스로 학습했을 수 있어요.")
        print("  빠진 키 예시:", missing[:5])
        print("  남는 키 예시:", unexpected[:5])
        print("  → 이 출력 결과를 그대로 보내주세요. 저장하지 않았습니다.")
        sys.exit(1)

if not hasattr(model, "save_pretrained"):
    print("[중단] transformers 모델이 아니라 변환할 수 없습니다. 학습 코드를 확인해야 합니다.")
    sys.exit(1)

model.save_pretrained(folder)
print(f"\n완료: {os.path.join(folder, 'model.safetensors')} 생성")
print("이제 python scripts/check_models.py 를 다시 실행하세요.")
