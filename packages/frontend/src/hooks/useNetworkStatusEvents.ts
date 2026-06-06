import { useEffect, type Dispatch, type SetStateAction } from "react";
import type {
  FileOctopusClient,
  NetworkConnectionStatusDto,
} from "@fileoctopus/ts-api";

export interface UseNetworkStatusEventsParams {
  client: FileOctopusClient;
  networkEnabled: boolean;
  setNetworkStatuses: Dispatch<SetStateAction<NetworkConnectionStatusDto[]>>;
}

export function useNetworkStatusEvents({
  client,
  networkEnabled,
  setNetworkStatuses,
}: UseNetworkStatusEventsParams) {
  useEffect(() => {
    if (!networkEnabled) {
      return;
    }

    let dispose: (() => void) | null = null;
    void client.network
      .subscribeStatusEvents((event) => {
        setNetworkStatuses((current) => {
          const others = current.filter(
            (status) => status.profileId !== event.profileId,
          );
          return [
            ...others,
            {
              profileId: event.profileId,
              status: event.status,
              message: event.message,
            },
          ];
        });
      })
      .then((unsub) => {
        dispose = unsub;
      })
      .catch(() => undefined);

    return () => {
      dispose?.();
    };
  }, [networkEnabled, client, setNetworkStatuses]);
}
