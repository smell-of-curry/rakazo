import base64
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("prepare-repository-patch.py")
spec = importlib.util.spec_from_file_location("prepare_patch", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
BASE = "a" * 40


class PreparedPatchTests(unittest.TestCase):
    def test_small_patch_updates_large_file_through_publication_guard(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            root.mkdir()
            def git(*args):
                return subprocess.check_output(["git", *args], cwd=root)
            git("init", "-q")
            git("config", "user.name", "Test")
            git("config", "user.email", "test@example.invalid")
            git("config", "commit.gpgsign", "false")
            git("config", "core.hooksPath", "/dev/null")
            target = root / "large.lock"
            before = "unchanged dependency\n" * 50000 + "version: 1\n"
            after = before.removesuffix("version: 1\n") + "version: 2\n"
            target.write_text(before)
            git("add", ".")
            git("commit", "-qm", "fixture")
            target.write_text(after)
            patch = git("diff")
            git("restore", ".")
            base = git("rev-parse", "HEAD").decode().strip()
            temp = Path(directory) / "temp"
            temp.mkdir()
            prepared = temp / "prepared.patch"
            module.prepare(base64.b64encode(patch).decode(), base, base, prepared)
            subprocess.run(
                ["bash", str(SCRIPT.with_name("apply-dependency-update.sh")), str(prepared)],
                cwd=root, env={**os.environ, "RUNNER_TEMP": str(temp)}, check=True,
            )
            self.assertEqual(target.read_text(), after)
            self.assertEqual(git("diff", "--cached"), patch)

    def test_preserves_patch_bytes_with_private_permissions(self):
        patch = b"diff --git a/example.txt b/example.txt\n"
        with tempfile.TemporaryDirectory() as root:
            target = Path(root) / "patch"
            module.prepare(base64.b64encode(patch).decode(), BASE, BASE, target)
            self.assertEqual(target.read_bytes(), patch)
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                module.prepare(base64.b64encode(patch).decode(), BASE, BASE, target)

    def test_rejects_invalid_input_without_writing(self):
        valid = base64.b64encode(b"patch\n").decode()
        cases = [
            (valid, "b" * 40, BASE), (valid, "main", BASE),
            ("", BASE, BASE), ("A" * 60004, BASE, BASE), ("!", BASE, BASE),
            (base64.b64encode(b"\0").decode(), BASE, BASE),
            (base64.b64encode(b"\xff").decode(), BASE, BASE),
            (base64.b64encode(b" \n").decode(), BASE, BASE),
        ]
        for encoded, expected, actual in cases:
            with self.subTest(encoded=encoded[:20]), tempfile.TemporaryDirectory() as root:
                target = Path(root) / "patch"
                with self.assertRaises(ValueError):
                    module.prepare(encoded, expected, actual, target)
                self.assertFalse(target.exists())

    def test_does_not_follow_existing_symlink(self):
        with tempfile.TemporaryDirectory() as root:
            destination = Path(root) / "other"
            destination.write_text("unchanged")
            target = Path(root) / "patch"
            target.symlink_to(destination)
            with self.assertRaises(FileExistsError):
                module.prepare(base64.b64encode(b"patch").decode(), BASE, BASE, target)
            self.assertEqual(destination.read_text(), "unchanged")


if __name__ == "__main__":
    unittest.main()
