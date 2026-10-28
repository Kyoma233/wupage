import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    'publish_checksums', Path(__file__).resolve().parents[1] / 'scripts' / 'publish-checksums.py'
)
checksums = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checksums)

firefox_spec = importlib.util.spec_from_file_location(
    'publish_firefox', Path(__file__).resolve().parents[1] / 'scripts' / 'publish-firefox.py'
)
firefox = importlib.util.module_from_spec(firefox_spec)
firefox_spec.loader.exec_module(firefox)


class PublishChecksumsTests(unittest.TestCase):
    def setUp(self):
        cache = Path(__file__).resolve().parents[1] / '.npm-cache' / 'publish-tests'
        cache.mkdir(parents=True, exist_ok=True)
        directory = tempfile.TemporaryDirectory(dir=cache)
        self.addCleanup(directory.cleanup)
        self.archives = [
            Path(directory.name) / 'release' / f'wupage-1.3.1-{browser}.zip'
            for browser in ('edge', 'firefox', 'firefox-source')
        ]
        self.release = {
            'tag_name': 'v1.3.1', 'draft': False, 'prerelease': False,
            'assets': [
                {'name': path.name, 'digest': 'sha256:' + hashlib.sha256(path.name.encode()).hexdigest()}
                for path in self.archives
            ],
        }
        environment = patch.dict(os.environ, {'GITHUB_REPOSITORY': 'mr-wuliu/wupage'})
        environment.start()
        self.addCleanup(environment.stop)
        fetch = patch.object(checksums.subprocess, 'check_output')
        self.fetch = fetch.start()
        self.addCleanup(fetch.stop)

    def prepare(self, tag='v1.3.1'):
        self.fetch.return_value = json.dumps(self.release)
        checksums.prepare_checksums(tag, self.archives)

    def test_uses_github_digests_without_published_sidecars(self):
        # Ignore unrelated assets, including legacy checksum attachments.
        self.release['assets'].append({'name': self.archives[0].name + '.sha256', 'digest': None})
        self.release['assets'][0]['digest'] = self.release['assets'][0]['digest'].upper().replace('SHA256:', 'sha256:')
        self.prepare()
        self.fetch.assert_called_once_with([
            'gh', 'api', 'repos/mr-wuliu/wupage/releases/tags/v1.3.1',
        ], encoding='utf-8')
        for path, asset in zip(self.archives, self.release['assets']):
            self.assertFalse(path.exists())
            self.assertEqual(
                Path(str(path) + '.sha256').read_bytes(),
                f'{asset["digest"][7:].lower()}  {path.name}\n'.encode('utf-8'),
            )

    def test_prereleases_and_invalid_tags_never_query_github(self):
        for tag in ('v1.3.1-beta.1', '1.3.1', 'v1.3', 'v1.3.1\n', '../other'):
            with self.subTest(tag=tag), self.assertRaisesRegex(ValueError, 'Only stable'):
                self.prepare(tag)
        self.fetch.assert_not_called()

    def test_generated_checksums_work_with_store_validator_and_detect_tampering(self):
        self.prepare()
        for path in self.archives:
            with self.subTest(path=path):
                path.write_bytes(path.name.encode())
                firefox.verify_checksum(path)
                path.write_bytes(path.read_bytes() + b'tampered')
                with self.assertRaisesRegex(ValueError, 'SHA-256'):
                    firefox.verify_checksum(path)

    def test_draft_prerelease_and_mismatched_releases_are_rejected(self):
        for key, value in (('draft', True), ('prerelease', True), ('tag_name', 'v1.3.0')):
            with self.subTest(key=key), patch.dict(self.release, {key: value}):
                with self.assertRaisesRegex(ValueError, 'published and stable'):
                    self.prepare()
        self.assertFalse(self.archives[0].parent.exists())

    def test_missing_or_ambiguous_asset_creates_no_checksums(self):
        assets = self.release['assets']
        for invalid in (assets[:-1], assets + [assets[-1]]):
            with self.subTest(assets=invalid), patch.dict(self.release, assets=invalid):
                with self.assertRaisesRegex(ValueError, 'exactly one Release asset'):
                    self.prepare()
        self.assertFalse(self.archives[0].parent.exists())

    def test_missing_or_invalid_digest_never_skips_verification(self):
        asset = self.release['assets'][-1]
        for digest in (None, '', 'sha1:' + 'a' * 40, 'sha256:' + 'a' * 63,
                       'sha256:' + 'g' * 64, 'sha256:' + 'a' * 64 + '\n'):
            with self.subTest(digest=digest), patch.dict(asset, digest=digest):
                with self.assertRaisesRegex(ValueError, 'GitHub SHA-256 digest'):
                    self.prepare()
        del asset['digest']
        with self.assertRaisesRegex(ValueError, 'GitHub SHA-256 digest'):
            self.prepare()
        self.assertFalse(self.archives[0].parent.exists())


if __name__ == '__main__':
    unittest.main()
