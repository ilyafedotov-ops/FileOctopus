import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  cargoWorkspaceVersion,
  stageReleaseArtifacts,
  validateReleaseIdentity,
  versionFromTag,
  writeReleaseChecksums,
} from "./release-guard.mjs";

const SHA = "0123456789abcdef0123456789abcdef01234567";

test("release identity requires exact protected-main tag, commit, and versions", () => {
  assert.equal(versionFromTag("v1.2.3-rc.1"), "1.2.3-rc.1");
  assert.equal(
    validateReleaseIdentity({
      tag: "v0.1.5",
      requestedSha: SHA,
      workflowSha: SHA,
      workflowRef: "refs/heads/main",
      packageVersion: "0.1.5",
      cargoVersion: "0.1.5",
      tauriVersion: "0.1.5",
    }),
    "0.1.5",
  );
  assert.throws(
    () =>
      validateReleaseIdentity({
        tag: "v0.1.5;touch-pwned",
        requestedSha: SHA,
        workflowSha: SHA,
        workflowRef: "refs/heads/main",
        packageVersion: "0.1.5",
        cargoVersion: "0.1.5",
        tauriVersion: "0.1.5",
      }),
    /semantic version/u,
  );
  assert.throws(
    () =>
      validateReleaseIdentity({
        tag: "v0.1.5",
        requestedSha: SHA,
        workflowSha: "1123456789abcdef0123456789abcdef01234567",
        workflowRef: "refs/heads/main",
        packageVersion: "0.1.5",
        cargoVersion: "0.1.5",
        tauriVersion: "0.1.5",
      }),
    /workflow commit/u,
  );
  assert.throws(
    () =>
      validateReleaseIdentity({
        tag: "v0.1.5",
        requestedSha: SHA,
        workflowSha: SHA,
        workflowRef: "refs/heads/feature",
        packageVersion: "0.1.5",
        cargoVersion: "0.1.5",
        tauriVersion: "0.1.5",
      }),
    /protected main/u,
  );
});

test("Cargo version is read only from workspace.package", () => {
  assert.equal(
    cargoWorkspaceVersion(
      '[dependencies]\nexample = "9.9.9"\n[workspace.package]\nversion = "1.2.3"\n',
    ),
    "1.2.3",
  );
});

async function artifactFixture() {
  const root = await mkdtemp(join(tmpdir(), "fileoctopus-release-"));
  const artifacts = join(root, "artifacts");
  const release = join(root, "release");
  const files = new Map([
    ["macos-arm64", ["bundle/FileOctopus.dmg"]],
    ["macos-x64", ["bundle/FileOctopus.dmg"]],
    ["windows-x64", ["msi/FileOctopus.msi", "nsis/FileOctopus.exe"]],
    [
      "linux-x64",
      ["FileOctopus.AppImage", "deb/FileOctopus.deb", "rpm/FileOctopus.rpm"],
    ],
  ]);
  for (const [platform, names] of files) {
    for (const name of names) {
      const path = join(artifacts, `release-${platform}`, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, `${platform}:${name}`, "utf8");
    }
  }
  return { root, artifacts, release };
}

test("artifacts are flattened to collision-free platform names with portable checksums", async () => {
  const fixture = await artifactFixture();
  const staged = await stageReleaseArtifacts({
    artifactsDirectory: fixture.artifacts,
    releaseDirectory: fixture.release,
    version: "0.1.5",
    commitSha: SHA,
  });
  assert.equal(staged.assets.length, 7);
  assert.equal(new Set(staged.assets.map((asset) => asset.name)).size, 7);
  assert.ok(
    staged.assets.some(
      (asset) => asset.name === "FileOctopus-0.1.5-macos-arm64.dmg",
    ),
  );
  assert.ok(
    staged.assets.some(
      (asset) => asset.name === "FileOctopus-0.1.5-windows-x64.exe",
    ),
  );

  const sbom = join(fixture.root, "FileOctopus-0.1.5.spdx.json");
  const checksums = join(fixture.root, "SHA256SUMS");
  await writeFile(sbom, "{}\n", "utf8");
  const entries = await writeReleaseChecksums({
    releaseDirectory: fixture.release,
    extraFiles: [sbom],
    outputPath: checksums,
  });
  assert.equal(entries.length, 9);
  const manifest = await readFile(checksums, "utf8");
  assert.match(manifest, /^[0-9a-f]{64}  FileOctopus-0\.1\.5-/u);
  assert.doesNotMatch(manifest, /artifacts\//u);
  assert.doesNotMatch(manifest, /release\//u);
});

test("unexpected and linked artifacts fail closed", async () => {
  const unexpected = await artifactFixture();
  await writeFile(
    join(unexpected.artifacts, "release-linux-x64", "unexpected.zip"),
    "zip",
    "utf8",
  );
  await assert.rejects(
    stageReleaseArtifacts({
      artifactsDirectory: unexpected.artifacts,
      releaseDirectory: unexpected.release,
      version: "0.1.5",
      commitSha: SHA,
    }),
    /unexpected linux-x64 artifact extension/u,
  );

  const linked = await artifactFixture();
  await symlink(
    join(linked.artifacts, "release-linux-x64", "FileOctopus.AppImage"),
    join(linked.artifacts, "release-linux-x64", "linked.AppImage"),
  );
  await assert.rejects(
    stageReleaseArtifacts({
      artifactsDirectory: linked.artifacts,
      releaseDirectory: linked.release,
      version: "0.1.5",
      commitSha: SHA,
    }),
    /symbolic links/u,
  );
});

test("workflow remains prerelease-only and reusable CI accepts an exact checkout ref", async () => {
  const releaseWorkflow = await readFile(
    ".github/workflows/release-assets.yml",
    "utf8",
  );
  const ciWorkflow = await readFile(".github/workflows/ci.yml", "utf8");
  assert.match(releaseWorkflow, /gh release create "\$RELEASE_TAG"/u);
  assert.match(releaseWorkflow, /--prerelease/u);
  assert.match(releaseWorkflow, /--latest=false/u);
  assert.match(releaseWorkflow, /--verify-tag/u);
  assert.match(releaseWorkflow, /git\/refs/u);
  assert.doesNotMatch(releaseWorkflow, /^\s{2}release:\s*$/mu);
  assert.match(releaseWorkflow, /checkout_ref:/u);
  assert.match(ciWorkflow, /checkout_ref:/u);
  assert.match(ciWorkflow, /inputs\.checkout_ref \|\| github\.sha/u);
});
