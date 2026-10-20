"""Decode the generated PNG pixels and compare with the registered seed manifest.

Run with the existing services/vision uv environment (OpenCV is already installed).
No provider calls, cloud mutations or expected image classifications are involved.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    report = json.loads(args.report.read_text(encoding="utf-8"))
    detector = cv2.QRCodeDetector()
    checked = []
    for qr in report["qrCodes"]:
        image = cv2.imread(qr["file"])
        if image is None:
            raise RuntimeError(f"QR PNG is unavailable: {qr['qrId']}")
        decoded, points, _ = detector.detectAndDecode(image)
        if points is None or decoded != qr["payload"]:
            raise RuntimeError(f"QR pixels do not match registration: {qr['qrId']}")
        checked.append({"qrId": qr["qrId"], "binId": qr["binId"], "decodedPayload": decoded})
    print(json.dumps({"cloudRecordsVerified": report["verified"], "decodedQrCount": len(checked), "qrCodes": checked}, indent=2))


if __name__ == "__main__":
    main()
