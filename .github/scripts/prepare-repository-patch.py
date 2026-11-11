"""Decode a bounded prepared patch against the current default-branch revision."""
import base64
import binascii
import os
from pathlib import Path
import re
import subprocess


def prepare(encoded: str, expected_base: str, actual_base: str, target: Path) -> None:
    if not re.fullmatch(r"[0-9a-f]{40}", expected_base) or expected_base != actual_base:
        raise ValueError("The prepared base must match the current main revision.")
    if not encoded or len(encoded) > 60000:
        raise ValueError("The encoded patch must contain at most 60000 characters.")
    try:
        patch = base64.b64decode(encoded, validate=True)
        patch.decode("utf-8")
    except (binascii.Error, UnicodeError) as error:
        raise ValueError("Expected a base64-encoded UTF-8 Git patch.") from error
    if not patch.strip() or b"\0" in patch:
        raise ValueError("Expected a nonempty Git patch without NUL bytes.")
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as output:
        output.write(patch)


if __name__ == "__main__":
    actual = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    prepare(os.environ["PATCH_BASE64"], os.environ["PATCH_BASE"], actual,
            Path(os.environ["RUNNER_TEMP"]) / "prepared.patch")
