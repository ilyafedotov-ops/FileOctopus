import { describe, expect, it } from "vitest";
import {
  breadcrumbSegmentsFromUri,
  displayPathFromUri,
  isRemoteUri,
  isSupportedNavigationUri,
  parentUriFromUri,
  profileIdFromRemoteUri,
  rootUriForUri,
} from "../src/uri";

const profileId = "77ac077d-d721-480f-9ee0-bb22403f0fd5";
const remoteHome = `sftp://${profileId}/home/ilya`;

describe("uri helpers", () => {
  it("detects remote schemes", () => {
    expect(
      isRemoteUri("sftp://550e8400-e29b-41d4-a716-446655440000/home"),
    ).toBe(true);
    expect(isRemoteUri("local:///tmp")).toBe(false);
  });

  it("accepts local and remote URIs for navigation", () => {
    expect(isSupportedNavigationUri("local:///tmp")).toBe(true);
    expect(
      isSupportedNavigationUri(
        "sftp://550e8400-e29b-41d4-a716-446655440000/home",
      ),
    ).toBe(true);
    expect(isSupportedNavigationUri("/tmp")).toBe(false);
  });

  it("extracts profile id from remote URIs", () => {
    expect(
      profileIdFromRemoteUri(
        "sftp://550e8400-e29b-41d4-a716-446655440000/home/deploy",
      ),
    ).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(profileIdFromRemoteUri("local:///tmp")).toBeNull();
  });

  it("derives remote display paths without local prefix", () => {
    expect(displayPathFromUri(remoteHome)).toBe("/home/ilya");
    expect(parentUriFromUri(remoteHome)).toBe(`sftp://${profileId}/home`);
    expect(rootUriForUri(remoteHome)).toBe(`sftp://${profileId}/`);
  });

  it("builds remote breadcrumb segments with remote URIs", () => {
    expect(breadcrumbSegmentsFromUri(remoteHome)).toEqual([
      { label: "home", uri: `sftp://${profileId}/home` },
      { label: "ilya", uri: remoteHome },
    ]);
  });
});
