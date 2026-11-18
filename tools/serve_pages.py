#!/usr/bin/env python3
"""Serve this repo at /Fittrack/, matching GitHub project Pages.

https://markjenkinsoz.github.io/Fittrack/ is case-sensitive. Files in the
repo root are exposed only under that prefix, and /Fittrack redirects to
/Fittrack/ the same way Pages does.
"""

from __future__ import annotations

import argparse
import shutil
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVE_ROOT = Path("/tmp/fittrack-pages-root")


def prepare_root() -> None:
    if SERVE_ROOT.exists():
        shutil.rmtree(SERVE_ROOT)
    SERVE_ROOT.mkdir(parents=True)
    (SERVE_ROOT / "Fittrack").symlink_to(ROOT, target_is_directory=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()

    prepare_root()
    handler = partial(SimpleHTTPRequestHandler, directory=str(SERVE_ROOT))
    httpd = ThreadingHTTPServer((args.bind, args.port), handler)
    url = f"http://{args.bind}:{args.port}/Fittrack/"
    print(f"Serving {ROOT} at {url}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        shutil.rmtree(SERVE_ROOT, ignore_errors=True)


if __name__ == "__main__":
    main()
