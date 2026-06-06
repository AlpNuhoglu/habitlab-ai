#!/usr/bin/env python3
# Extracts a GitHub Actions log ZIP, sanitising Unicode filenames that macOS
# unzip rejects (e.g. the middle-dot · in job names like "lint · typecheck").
import sys
import zipfile
import pathlib

zip_path = sys.argv[1]
out_dir = pathlib.Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)

with zipfile.ZipFile(zip_path) as z:
    for member in z.infolist():
        safe_name = member.filename.encode("utf-8", "replace").decode("utf-8")
        dest = out_dir / safe_name
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not member.is_dir():
            dest.write_bytes(z.read(member.filename))
