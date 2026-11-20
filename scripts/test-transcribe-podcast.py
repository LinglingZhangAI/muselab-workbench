"""Check that bounded decoding preserves samples and resume timestamps."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import wave

import numpy as np

spec = importlib.util.spec_from_file_location(
    "transcribe", Path(__file__).with_name("transcribe-podcast.py")
)
transcribe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transcribe)


class AudioChunkTest(unittest.TestCase):
    def test_chunk_boundaries_and_resume_do_not_drop_or_repeat_audio(self):
        original = (np.sin(np.arange(32000) / 100) * 20000).astype(np.int16)
        with tempfile.TemporaryDirectory() as folder:
            filename = str(Path(folder) / "fixture.wav")
            with wave.open(filename, "wb") as audio:
                audio.setnchannels(1)
                audio.setsampwidth(2)
                audio.setframerate(16000)
                audio.writeframes(original.tobytes())
            for offset in (0, 0.25, 0.6, 1.99, 2, 3):
                with self.subTest(offset=offset):
                    chunks = list(transcribe.audio_chunks(filename, offset, 0.5))
                    samples = (np.concatenate([value for _, value in chunks])
                               if chunks else np.array([]))
                    expected = original[round(offset * 16000):].astype(np.float32) / 32768
                    np.testing.assert_array_equal(samples, expected)
                    for index, (start, value) in enumerate(chunks):
                        self.assertAlmostEqual(start, offset + index * 0.5)
                        self.assertLessEqual(len(value), 8000)


if __name__ == "__main__":
    unittest.main()
