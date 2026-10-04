from __future__ import annotations

import argparse
import hashlib
import json
import os
import urllib.request
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SampleRecord:
    id: str
    instrument: str
    midi: int
    url: str
    file_name: str
    bytes: int | None
    sha256: str | None


def load_manifest(path: str | Path) -> list[SampleRecord]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    return [
        SampleRecord(
            id=item["id"],
            instrument=item["instrument"],
            midi=int(item["midi"]),
            url=item["url"],
            file_name=item["fileName"],
            bytes=item.get("bytes"),
            sha256=item.get("sha256"),
        )
        for item in payload["samples"]
    ]


def fetch_sample(record: SampleRecord, output: str | Path, max_bytes: int = 20 * 1024 * 1024) -> tuple[Path, str]:
    target_dir = Path(output)
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / record.file_name
    if target.exists():
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        if record.sha256 and digest != record.sha256:
            raise ValueError(f"checksum mismatch for cached sample: {record.id}")
        if record.bytes and target.stat().st_size != record.bytes:
            raise ValueError(f"size mismatch for cached sample: {record.id}")
        return target, digest
    request = urllib.request.Request(record.url, headers={"User-Agent": "SonoraScore/0.1 sample-research"})
    temporary = target.with_suffix(target.suffix + ".part")
    digest = hashlib.sha256()
    written = 0
    try:
        with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as destination:
            while chunk := response.read(64 * 1024):
                written += len(chunk)
                if written > max_bytes:
                    raise ValueError(f"sample exceeds {max_bytes} bytes: {record.id}")
                digest.update(chunk)
                destination.write(chunk)
        os.replace(temporary, target)
    finally:
        if temporary.exists():
            temporary.unlink()
    checksum = digest.hexdigest()
    if record.sha256 and checksum != record.sha256:
        target.unlink(missing_ok=True)
        raise ValueError(f"checksum mismatch after download: {record.id}")
    if record.bytes and target.stat().st_size != record.bytes:
        target.unlink(missing_ok=True)
        raise ValueError(f"size mismatch after download: {record.id}")
    return target, checksum


def main() -> None:
    parser = argparse.ArgumentParser(description="Download the small, reviewed Sonora sample subset")
    parser.add_argument("--manifest", default="assets/samples/manifest.json")
    parser.add_argument("--output", default="assets/samples/cache")
    parser.add_argument("--ids", nargs="*", help="optional sample ids; defaults to every manifest sample")
    args = parser.parse_args()
    selected = set(args.ids or [])
    for record in load_manifest(args.manifest):
        if selected and record.id not in selected:
            continue
        path, digest = fetch_sample(record, args.output)
        print(json.dumps({"id": record.id, "path": str(path), "sha256": digest}, ensure_ascii=False))


if __name__ == "__main__":
    main()
