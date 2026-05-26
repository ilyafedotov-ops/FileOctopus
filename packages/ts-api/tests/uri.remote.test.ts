import { describe, expect, it } from "vitest";
import {
  isRemoteUri,
  isSupportedNavigationUri,
  profileIdFromRemoteUri,
  displayPathFromUri,
  parentUriFromUri,
  rootUriForUri,
  breadcrumbSegmentsFromUri,
} from "../src/uri";

const s3ProfileId = "77ac077d-d721-480f-9ee0-bb22403f0fd5";
const s3Home = `s3://${s3ProfileId}/my-bucket/path/to/data`;

describe("S3 URI helpers", () => {
  it("detects s3 as a remote scheme", () => {
    expect(isRemoteUri(`s3://${s3ProfileId}/my-bucket/file.txt`)).toBe(true);
  });

  it("accepts s3 URIs for navigation", () => {
    expect(isSupportedNavigationUri(`s3://${s3ProfileId}/my-bucket/`)).toBe(
      true,
    );
  });

  it("extracts profile id from s3 URIs", () => {
    expect(
      profileIdFromRemoteUri(`s3://${s3ProfileId}/my-bucket/file.txt`),
    ).toBe(s3ProfileId);
  });

  it("derives display path from s3 URI", () => {
    expect(displayPathFromUri(s3Home)).toBe("/my-bucket/path/to/data");
  });

  it("computes parent of s3 URI", () => {
    expect(parentUriFromUri(s3Home)).toBe(
      `s3://${s3ProfileId}/my-bucket/path/to`,
    );
  });

  it("computes root of s3 URI", () => {
    expect(rootUriForUri(s3Home)).toBe(`s3://${s3ProfileId}/`);
  });

  it("builds breadcrumb segments for s3 URI", () => {
    const segments = breadcrumbSegmentsFromUri(s3Home);
    expect(segments.length).toBe(4);
    expect(segments[0]).toEqual({
      label: "my-bucket",
      uri: `s3://${s3ProfileId}/my-bucket`,
    });
    expect(segments[3]).toEqual({ label: "data", uri: s3Home });
  });
});

describe("SMB URI helpers", () => {
  const smbProfileId = "550e8400-e29b-41d4-a716-446655440000";

  it("detects smb as a remote scheme", () => {
    expect(isRemoteUri(`smb://${smbProfileId}/share/docs`)).toBe(true);
  });

  it("extracts profile id from smb URIs", () => {
    expect(profileIdFromRemoteUri(`smb://${smbProfileId}/share/docs`)).toBe(
      smbProfileId,
    );
  });

  it("builds breadcrumb segments for smb URI", () => {
    const uri = `smb://${smbProfileId}/share/docs`;
    const segments = breadcrumbSegmentsFromUri(uri);
    expect(segments.length).toBe(2);
    expect(segments[0]).toEqual({
      label: "share",
      uri: `smb://${smbProfileId}/share`,
    });
    expect(segments[1]).toEqual({ label: "docs", uri });
  });
});
