from __future__ import annotations

import argparse
import json

from .core import analyze_wav


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze a PCM WAV file with the Sonora DSP baseline")
    parser.add_argument("audio", help="path to a PCM WAV file")
    parser.add_argument("--pretty", action="store_true", help="indent the JSON output")
    args = parser.parse_args()
    print(json.dumps(analyze_wav(args.audio).to_dict(), ensure_ascii=False, indent=2 if args.pretty else None))


if __name__ == "__main__":
    main()
