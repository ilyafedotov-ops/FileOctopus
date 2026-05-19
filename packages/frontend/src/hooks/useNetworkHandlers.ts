import { useCallback } from "react";
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
  const connectProfile = useCallback(
    async (profileId: string) => {
      setOperationError(null);
      try {
        await client.network.connect({ id: profileId });
        await refreshNetworkProfiles();
      } catch (error) {
        setOperationError(normalizeIpcError(error).message);
        throw error;
      }
    },
    [client, refreshNetworkProfiles, setOperationError],
  );

  const disconnectProfile = useCallback(
    async (profileId: string) => {
      setOperationError(null);
      try {
        await client.network.disconnect({ id: profileId });
        await refreshNetworkProfiles();
      } catch (error) {
        setOperationError(normalizeIpcError(error).message);
        throw error;
      }
    },
    [client, refreshNetworkProfiles, setOperationError],
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

  const saveProfile = useCallback(
    async (payload: {
      id?: string;
      label: string;
      host: string;
      port: number;
      username: string;
      authKind: "password" | "privateKey";
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
              scheme: "sftp",
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

        const shouldConnect =
          !payload.id ||
          (payload.authKind === "password" && Boolean(payload.password)) ||
          (payload.authKind === "privateKey" && Boolean(payload.passphrase));

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
  };
}

export type { NetworkProfileDto };
