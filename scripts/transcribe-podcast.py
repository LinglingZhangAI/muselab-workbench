"""Local-only timestamped speech recognition; emits JSON events for Muselab."""
import json
import sys

import av
import numpy as np
from faster_whisper import WhisperModel


def emit(data):
    print(json.dumps(data, ensure_ascii=False), flush=True)


def audio_chunks(filename, offset=0, chunk_seconds=600):
    """Decode bounded mono chunks, keeping sample offsets on the original timeline."""
    rate = 16000
    limit = int(chunk_seconds * rate)
    if limit < 1 or offset < 0:
        raise ValueError("Invalid audio chunk range")
    skip = round(offset * rate)
    position = 0
    parts = []
    count = 0
    with av.open(filename, metadata_errors="ignore") as container:
        resampler = av.audio.resampler.AudioResampler(format="s16", layout="mono", rate=rate)
        frames = container.decode(audio=0)
        # Flush the resampler after the last decoded frame.
        import itertools
        for frame in itertools.chain(frames, [None]):
            for output in resampler.resample(frame):
                samples = output.to_ndarray().reshape(-1)
                frame_start = position
                position += len(samples)
                samples = samples[max(0, skip - frame_start):]
                while len(samples):
                    take = min(limit - count, len(samples))
                    parts.append(samples[:take].copy())
                    count += take
                    samples = samples[take:]
                    if count == limit:
                        yield skip / rate, np.concatenate(parts).astype(np.float32) / 32768.0
                        skip += count
                        parts, count = [], 0
        if count:
            yield skip / rate, np.concatenate(parts).astype(np.float32) / 32768.0


def main():
    audio, model_path, language, offset = sys.argv[1:5]
    offset = float(offset)
    model = WhisperModel(model_path, device="cpu", compute_type="int8", cpu_threads=4)
    with av.open(audio, metadata_errors="ignore") as container:
        duration = (container.duration or 0) / av.time_base
    emit({"event": "started", "duration": duration, "language": language})
    end = offset
    for start, samples in audio_chunks(audio, offset):
        segments, _ = model.transcribe(
            samples,
            language=None if language == "auto" else language,
            beam_size=3,
            vad_filter=True,
            condition_on_previous_text=False,
        )
        for segment in segments:
            text = segment.text.strip()
            if text and segment.end > segment.start:
                emit({"event": "cue", "start": start + segment.start,
                      "end": start + segment.end, "text": text})
        end = start + len(samples) / 16000
    emit({"event": "done", "duration": end})


if __name__ == "__main__":
    main()
