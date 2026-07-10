import { useCallback, useState } from "react";
import { normalizeIpcError, type FileOctopusClient } from "@fileoctopus/ts-api";
import type {
  NetworkProfileDto,
  NetworkProfileTestResponse,
  NetworkProtocolOptionsInput,
} from "@fileoctopus/ts-api";

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

  const testConnection = useCallback(
    async (profileId: string): Promise<NetworkProfileTestResponse> => {
      const result = await client.network.testProfile({ id: profileId });
      await refreshNetworkProfiles();
      return result;
    },
    [client, refreshNetworkProfiles],
  );

  const testConnectionDraft = useCallback(
    async (payload: {
      scheme: "sftp" | "ssh" | "smb" | "s3" | "webdav";
      label: string;
      host: string;
      port: number;
      username: string;
      authKind: "password" | "privateKey" | "accessKey";
      privateKeyPath: string | null;
      defaultPath: string;
      options: NetworkProtocolOptionsInput;
      password: string;
      passphrase: string;
    }): Promise<NetworkProfileTestResponse> =>
      client.network.testProfile({
        draft: {
          label: payload.label,
          scheme: payload.scheme,
          host: payload.host,
          port: payload.port,
          username: payload.username,
          authKind: payload.authKind,
          privateKeyPath: payload.privateKeyPath,
          defaultPath: payload.defaultPath,
          options: payload.options,
        },
        password: payload.password,
        passphrase: payload.passphrase,
      }),
    [client],
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

  const trustFingerprint = useCallback(
    async (profileId: string, fingerprint: string) => {
      setOperationError(null);
      try {
        await client.network.trustFingerprint({
          id: profileId,
          fingerprint,
        });
        await refreshNetworkProfiles();
      } catch (error) {
        const message = normalizeIpcError(error).message;
        setOperationError(message);
        throw new Error(message);
      }
    },
    [client, refreshNetworkProfiles, setOperationError],
  );

  const saveProfile = useCallback(
    async (payload: {
      id?: string;
      scheme: "sftp" | "ssh" | "smb" | "s3" | "webdav";
      label: string;
      host: string;
      port: number;
      username: string;
      authKind: "password" | "privateKey" | "accessKey";
      privateKeyPath: string | null;
      defaultPath: string;
      options: NetworkProtocolOptionsInput;
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
              options: payload.options,
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
              options: payload.options,
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

        await refreshNetworkProfiles();

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
    trustFingerprint,
    testConnection,
    testConnectionDraft,
    busyProfileIds,
  };
}

export type { NetworkProfileDto };
