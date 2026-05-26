import { useCallback, useState } from "react";
import { normalizeIpcError, type FileOctopusClient } from "@fileoctopus/ts-api";
import type { NetworkProfileDto } from "@fileoctopus/ts-api";

interface UseNetworkHandlersParams {
  client: FileOctopusClient;
  refreshNetworkProfiles: () => Promise<void>;
  setOperationError: (message: string | null) => void;
}

export function useNetworkHandlers({
  client,
  refreshNetworkProfiles,
  setOperationError,
}: UseNetworkHandlersParams) {
  const [busyProfileIds, setBusyProfileIds] = useState<Set<string>>(new Set());

  const withBusy = useCallback(
    async (profileId: string, fn: () => Promise<void>) => {
      setBusyProfileIds((current) => {
        const next = new Set(current);
        next.add(profileId);
        return next;
      });
      try {
        await fn();
      } finally {
        setBusyProfileIds((current) => {
          const next = new Set(current);
          next.delete(profileId);
          return next;
        });
      }
    },
    [],
  );

  const connectProfile = useCallback(
    async (profileId: string) => {
      setOperationError(null);
      await withBusy(profileId, async () => {
        try {
          await client.network.connect({ id: profileId });
          await refreshNetworkProfiles();
        } catch (error) {
          setOperationError(normalizeIpcError(error).message);
          throw error;
        }
      });
    },
    [client, refreshNetworkProfiles, setOperationError, withBusy],
  );

  const disconnectProfile = useCallback(
    async (profileId: string) => {
      setOperationError(null);
      await withBusy(profileId, async () => {
        try {
          await client.network.disconnect({ id: profileId });
          await refreshNetworkProfiles();
        } catch (error) {
          setOperationError(normalizeIpcError(error).message);
          throw error;
        }
      });
    },
    [client, refreshNetworkProfiles, setOperationError, withBusy],
  );

  const deleteProfile = useCallback(
    async (profileId: string) => {
      setOperationError(null);
      try {
        await client.network.deleteProfile({ id: profileId });
        await refreshNetworkProfiles();
      } catch (error) {
        setOperationError(normalizeIpcError(error).message);
        throw error;
      }
    },
    [client, refreshNetworkProfiles, setOperationError],
  );

  const forgetFingerprint = useCallback(
    async (profileId: string) => {
      setOperationError(null);
      try {
        await client.network.forgetFingerprint({ id: profileId });
        await refreshNetworkProfiles();
      } catch (error) {
        setOperationError(normalizeIpcError(error).message);
        throw error;
      }
    },
    [client, refreshNetworkProfiles, setOperationError],
  );

  const saveProfile = useCallback(
    async (payload: {
      id?: string;
      scheme: "sftp" | "ssh" | "smb" | "s3";
      label: string;
      host: string;
      port: number;
      username: string;
      authKind: "password" | "privateKey" | "accessKey";
      privateKeyPath: string | null;
      defaultPath: string;
      password: string;
      passphrase: string;
    }) => {
      setOperationError(null);
      try {
        const response = payload.id
          ? await client.network.updateProfile({
              id: payload.id,
              label: payload.label,
              host: payload.host,
              port: payload.port,
              username: payload.username,
              authKind: payload.authKind,
              privateKeyPath: payload.privateKeyPath,
              defaultPath: payload.defaultPath,
            })
          : await client.network.addProfile({
              label: payload.label,
              scheme: payload.scheme,
              host: payload.host,
              port: payload.port,
              username: payload.username,
              authKind: payload.authKind,
              privateKeyPath: payload.privateKeyPath,
              defaultPath: payload.defaultPath,
            });

        const profile = response.profile;
        if (payload.authKind === "password" && payload.password) {
          await client.network.setSecret({
            id: profile.id,
            secretKind: "password",
            value: payload.password,
          });
        }
        if (payload.authKind === "privateKey" && payload.passphrase) {
          await client.network.setSecret({
            id: profile.id,
            secretKind: "passphrase",
            value: payload.passphrase,
          });
        }
        if (payload.authKind === "accessKey" && payload.password) {
          await client.network.setSecret({
            id: profile.id,
            secretKind: "password",
            value: payload.password,
          });
        }

        const shouldConnect =
          (payload.scheme === "sftp" ||
            payload.scheme === "smb" ||
            payload.scheme === "s3") &&
          (!payload.id ||
            (payload.authKind === "password" && Boolean(payload.password)) ||
            (payload.authKind === "privateKey" &&
              Boolean(payload.passphrase)) ||
            (payload.authKind === "accessKey" && Boolean(payload.password)));

        await refreshNetworkProfiles();

        if (shouldConnect) {
          await client.network.connect({ id: profile.id });
          await refreshNetworkProfiles();
        }

        return profile;
      } catch (error) {
        const message = normalizeIpcError(error).message;
        setOperationError(message);
        throw new Error(message);
      }
    },
    [client, refreshNetworkProfiles, setOperationError],
  );

  return {
    connectProfile,
    disconnectProfile,
    deleteProfile,
    saveProfile,
    forgetFingerprint,
    busyProfileIds,
  };
}

export type { NetworkProfileDto };
