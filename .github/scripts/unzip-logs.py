#!/usr/bin/env python3
# Extracts a GitHub Actions log ZIP, sanitising Unicode filenames that macOS
# unzip rejects (e.g. the middle-dot · in job names like "lint · typecheck").
#
# Usage:
#   unzip-logs.py <zip> <out_dir>              — extract all step logs
#   unzip-logs.py <zip> <out_dir> <step_name>  — print path of matching step log
#
# Step logs inside the ZIP are named:  {job}/{N}_{step name}.txt
# When a step_name argument is given the script prints the path of the first
# extracted file whose step name contains that string (case-insensitive), so
# the caller can read it directly without grepping the entire log tree.
import sys
import zipfile
import pathlib

zip_path  = sys.argv[1]
out_dir   = pathlib.Path(sys.argv[2])
find_step = sys.argv[3].lower() if len(sys.argv) > 3 else None

out_dir.mkdir(parents=True, exist_ok=True)

found_path = None
with zipfile.ZipFile(zip_path) as z:
    for member in z.infolist():
        safe_name = member.filename.encode("utf-8", "replace").decode("utf-8")
        dest = out_dir / safe_name
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not member.is_dir():
            dest.write_bytes(z.read(member.filename))
            if find_step and found_path is None:
                # Step file name is the last path component, e.g. "10_Frontend tests.txt"
                step_file = pathlib.Path(safe_name).name.lower()
                if find_step in step_file:
                    found_path = str(dest)

if find_step:
    print(found_path or "", end="")
