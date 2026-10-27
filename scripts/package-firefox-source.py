"""Create an AMO source submission from a committed revision, without local data."""
from __future__ import annotations

import argparse
import io
import json
from pathlib import Path
import subprocess
import zipfile


BUILD_NOTES = """WuPage Translator - Firefox source build

Requirements
- Node.js 22 and npm (the release workflow uses actions/setup-node with Node 22).
- Build with npm on Linux, macOS or Windows. No credentials or paid accounts.

From this archive's root:
  npm ci
  npm run typecheck
  npm test
  npm run build:firefox

The Firefox extension is generated in dist-firefox/. Zip its contents with
manifest.json at the archive root to reproduce the submitted extension.
package-lock.json fixes the exact npm dependency versions.
The extension version is recorded in package.json and public/manifest.json.
The source revision is recorded in SOURCE_REVISION.txt.

Build transformations
- Vite compiles the application; esbuild emits a classic content script and OCR
  sandbox bundle. build/manifest.ts creates the Firefox-specific manifest.
- OpenCV's embedded base64 WASM is decoded into ocr-runtime/opencv.wasm without
  changing its bytes, so the OCR JavaScript stays below AMO's parser size limit.
- The pinned Bergamot worker's WASM loading expression is replaced with a
  Response containing bytes transferred from the extension page. This allows
  cold starts while Firefox is offline. The actual WASM and models are unchanged.
- These transformations are in vite.config.ts and run as part of the build.

Third-party code
Versions and integrity values are in package-lock.json. Principal libraries:
@browsermt/bergamot-translator 0.4.9 (https://github.com/browsermt/bergamot-translator)
@paddleocr/paddleocr-js 0.4.2 (https://github.com/PaddlePaddle/PaddleOCR)
onnxruntime-web 1.30.0 (https://github.com/microsoft/onnxruntime)
@techstark/opencv-js (https://github.com/TechStark/opencv-js)
pdfjs-dist (https://github.com/mozilla/pdf.js)
pdf-lib (https://github.com/Hopding/pdf-lib)
All executable libraries and WASM are bundled. Runtime downloads contain only
OCR or translation model data, verified by size and SHA-256. They are optional
and are initiated by an explicit user action. No remote scripts are executed.

Reviewer testing
1. Install dist-firefox/manifest.json temporarily using about:debugging in
   Firefox 154 or later. Use a new test profile if desired.
2. The default Microsoft browser translation provider needs no account or API key.
   Open an ordinary English web page and use the toolbar popup or floating ball.
3. The settings page offers custom HTTP, OpenAI/Anthropic-compatible and other
   API providers. Credentials are supplied by the user to their chosen provider.
   There is no WuPage service account or developer-operated proxy.
4. OCR is off by default. Explicitly install the 20.5 MB OCR models, enable image
   translation, then hover a text image and use its translation button.
5. For offline translation choose Firefox local translation (experimental),
   explicitly download English -> Simplified Chinese, and translate English
   text. The language model is about 52 MB and can also be imported offline.
6. Open PDF translation from the popup, or choose a local PDF in the workspace.

Validation warnings
- The OCR page is an opaque-origin sandbox with no extension APIs. Its
  unsafe-eval CSP is required by OpenCV's generated Embind wrappers. The main
  extension pages only allow self-hosted scripts and WebAssembly compilation.
- Bergamot's original worker contains a Node.js-only fallback with eval; that
  branch is not used in browser workers. Original sources are available in the
  pinned npm package and upstream repository.
- Bundled UI innerHTML and PDF dynamic-import warnings can be reviewed in the
  included original TypeScript. OCR, webpage and image translation text are
  handled separately from the fixed interface markup.

Privacy
PRIVACY.md describes data processing. Page text goes directly to the selected
online provider, or stays on-device with the local provider. User-configured API
credentials go only to that configured provider. Settings and optional caches
are local. WuPage has no analytics or developer-operated translation service.
"""


def package_source(output: Path, revision: str = "HEAD") -> Path:
    root = Path(__file__).resolve().parent.parent
    commit = subprocess.check_output(
        ["git", "rev-parse", "--verify", f"{revision}^{{commit}}"], cwd=root, text=True
    ).strip()
    source = subprocess.check_output(["git", "archive", "--format=zip", commit], cwd=root)
    with zipfile.ZipFile(io.BytesIO(source)) as archive:
        version = json.loads(archive.read("package.json"))["version"]
        destination = output / f"wupage-{version}-firefox-source.zip"
        output.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as packaged:
            for member in archive.infolist():
                # Only tracked release source is read. Never walk the worktree.
                packaged.writestr(member, archive.read(member.filename))
            packaged.writestr("FIREFOX_BUILD.txt", BUILD_NOTES)
            packaged.writestr("SOURCE_REVISION.txt", commit + "\n")
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("release"))
    parser.add_argument("--revision", default="HEAD")
    args = parser.parse_args()
    print(package_source(args.output, args.revision))
