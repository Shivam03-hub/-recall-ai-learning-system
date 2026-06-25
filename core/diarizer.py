"""
Speaker diarization — identifies WHO is speaking when in an audio file.
"""

import os
import torch
import soundfile as sf
from pyannote.audio import Pipeline

HF_TOKEN = os.getenv("HF_TOKEN")
_diarization_pipeline = None


def load_diarization_pipeline():
    global _diarization_pipeline
    if _diarization_pipeline is None:
        print("Loading speaker diarization pipeline...")
        _diarization_pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=HF_TOKEN
        )
        if torch.cuda.is_available():
            _diarization_pipeline.to(torch.device("cuda"))
        print("Diarization pipeline loaded.")
    return _diarization_pipeline


def diarize_audio(wav_path: str) -> list[dict]:
    pipeline = load_diarization_pipeline()

    audio_data, sample_rate = sf.read(wav_path, dtype="float32")

    if audio_data.ndim == 1:
        waveform = torch.from_numpy(audio_data).unsqueeze(0)
    else:
        waveform = torch.from_numpy(audio_data).T

    audio_input = {"waveform": waveform, "sample_rate": sample_rate}
    diarization = pipeline(audio_input)

    # pyannote 4.x wraps the result in a DiarizeOutput object;
    # the actual annotation with .itertracks() is nested inside it
    if hasattr(diarization, "speaker_diarization"):
        annotation = diarization.speaker_diarization
    else:
        annotation = diarization

    segments = []
    for turn, _, speaker in annotation.itertracks(yield_label=True):
        segments.append({
            "start": round(turn.start, 2),
            "end": round(turn.end, 2),
            "speaker": speaker,
        })

    return segments