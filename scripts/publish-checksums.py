"""Prepare local store-publishing checksums from GitHub Release asset digests.

These temporary sidecars keep the store validators independent of GitHub access.
They are not uploaded as Release assets.
"""

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def prepare_checksums(tag, archives):
    if not re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+', tag):
        raise ValueError('Only stable v<major>.<minor>.<patch> releases can be submitted.')
    release = json.loads(subprocess.check_output([
        'gh', 'api', f'repos/{os.environ["GITHUB_REPOSITORY"]}/releases/tags/{tag}',
    ], encoding='utf-8'))
    if release['tag_name'] != tag or release['draft'] or release['prerelease']:
        raise ValueError('The requested GitHub Release must be published and stable.')

    checksums = []
    for archive in archives:
        path = Path(archive)
        assets = [asset for asset in release['assets'] if asset['name'] == path.name]
        if len(assets) != 1:
            raise ValueError(f'Expected exactly one Release asset named {path.name}.')
        digest = assets[0].get('digest') or ''
        if not re.fullmatch(r'sha256:[a-fA-F0-9]{64}', digest):
            raise ValueError(f'Missing or invalid GitHub SHA-256 digest for {path.name}.')
        checksums.append((path, digest.removeprefix('sha256:').lower()))

    # Validate every requested asset before creating any local checksum files.
    for path, checksum in checksums:
        path.parent.mkdir(parents=True, exist_ok=True)
        Path(str(path) + '.sha256').write_text(f'{checksum}  {path.name}\n', encoding='utf-8', newline='\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tag')
    parser.add_argument('archives', nargs='+', type=Path)
    args = parser.parse_args()
    prepare_checksums(args.tag, args.archives)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)
