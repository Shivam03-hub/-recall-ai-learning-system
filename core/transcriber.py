import os
import requests
import whisper
import torch
from pydub import AudioSegment
from core.diarizer import diarize_audio
SARVAM_PIECE_SECONDS = 25
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
SARVAM_STT_TRANSLATE_URL = "https://api.sarvam.ai/speech-to-text-translate"
SARVAM_MODEL = os.getenv("SARVAM_STT_MODEL", "saaras:v2.5")

_model = None


def load_model():
    global _model
    if _model is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading Whisper model: {WHISPER_MODEL} on device: {device} ...")
        try:
            _model = whisper.load_model(WHISPER_MODEL, device=device)
        except RuntimeError as e:
            if "out of memory" in str(e).lower() and device == "cuda":
                print("GPU out of memory — falling back to CPU.")
                torch.cuda.empty_cache()
                _model = whisper.load_model(WHISPER_MODEL, device="cpu")
            else:
                raise
        print("Whisper model loaded.")
    return _model


def transcribe_chunk_whisper(chunk_path: str) -> str:
    model = load_model()
    result = model.transcribe(chunk_path, task="transcribe", fp16=torch.cuda.is_available())
    return result["text"]


def _send_to_sarvam(piece_path: str) -> str:
    headers = {"api-subscription-key": SARVAM_API_KEY}
    with open(piece_path, "rb") as f:
        files = {"file": (os.path.basename(piece_path), f, "audio/wav")}
        data = {"model": SARVAM_MODEL, "with_diarization": "false"}
        response = requests.post(SARVAM_STT_TRANSLATE_URL, headers=headers, files=files, data=data, timeout=120)
    if not response.ok:
        print(f"\n❌ Sarvam returned {response.status_code}")
        print(f"Response body: {response.text}\n")
        response.raise_for_status()
    return response.json().get("transcript", "")


def transcribe_chunk_sarvam(chunk_path: str) -> str:
    if not SARVAM_API_KEY:
        raise RuntimeError("SARVAM_API_KEY is not set in environment / .env")

    audio = AudioSegment.from_wav(chunk_path)
    piece_ms = SARVAM_PIECE_SECONDS * 1000
    full_text = ""
    total_pieces = (len(audio) + piece_ms - 1) // piece_ms

    for i, start in enumerate(range(0, len(audio), piece_ms)):
        piece = audio[start: start + piece_ms]
        piece_path = f"{chunk_path}_sv_{i}.wav"
        piece.export(piece_path, format="wav")
        try:
            print(f"  → Sarvam piece {i + 1}/{total_pieces} ...")
            full_text += _send_to_sarvam(piece_path) + " "
        finally:
            if os.path.exists(piece_path):
                os.remove(piece_path)

    return full_text.strip()


def transcribe_chunk(chunk_path: str, language: str = "english") -> str:
    if language.lower() == "hinglish":
        return transcribe_chunk_sarvam(chunk_path)
    return transcribe_chunk_whisper(chunk_path)


def transcribe_all(chunks: list, language: str = "english") -> str:
    full_transcript = ""
    engine = "Sarvam AI" if language.lower() == "hinglish" else "Whisper"
    print(f"Using {engine} for transcription.")

    for i, chunk in enumerate(chunks):
        print(f"Transcribing chunk {i + 1}/{len(chunks)}...")
        text = transcribe_chunk(chunk, language=language)
        full_transcript += text + " "

    print("Transcription complete.")
    return full_transcript.strip()





def transcribe_with_speakers(wav_path: str) -> str:
    """
    Combines Whisper transcription with speaker diarization to produce
    a speaker-labeled transcript, e.g.:
    SPEAKER_00: Welcome to the show...
    SPEAKER_01: Thanks for having me...
    """
    model = load_model()

    print("Running diarization...")
    speaker_segments = diarize_audio(wav_path)

    print("Running transcription with word timestamps...")
    result = model.transcribe(wav_path, task="transcribe", word_timestamps=True, fp16=torch.cuda.is_available())

    labeled_lines = []
    current_speaker = None
    current_line = []

    def find_speaker(timestamp):
        # exact match first
        for seg in speaker_segments:
            if seg["start"] <= timestamp <= seg["end"]:
                return seg["speaker"]
        # small tolerance window for boundary mismatches between Whisper
        # and pyannote timestamps
        tolerance = 0.3
        for seg in speaker_segments:
            if seg["start"] - tolerance <= timestamp <= seg["end"] + tolerance:
                return seg["speaker"]
        return "UNKNOWN"

    for segment in result["segments"]:
        for word_info in segment.get("words", []):
            word = word_info["word"]
            ts = word_info["start"]
            speaker = find_speaker(ts)

            if speaker != current_speaker:
                if current_line:
                    labeled_lines.append(f"{current_speaker}: {''.join(current_line).strip()}")
                current_speaker = speaker
                current_line = [word]
            else:
                current_line.append(word)

    if current_line:
        labeled_lines.append(f"{current_speaker}: {''.join(current_line).strip()}")

    return "\n".join(labeled_lines)