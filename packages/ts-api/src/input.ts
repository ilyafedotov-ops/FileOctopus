import type {
  FileOperationRequestDto,
  NetworkProfileAddRequest,
  NetworkProfileDraftDto,
  NetworkProfileTestRequest,
  NetworkProfileUpdateRequest,
  NetworkProtocolOptionsDto,
  PlanFileOperationRequest,
  TerminalProfileAddRequest,
  TerminalProfileInputDto,
  TerminalProfileUpdateRequest,
  TerminalSpawnAndRunRequest,
} from "./generated/ipc";

type NullableKeys<T extends object> = {
  [K in keyof T]-?: null extends T[K] ? K : never;
}[keyof T];

type OptionalInputKeys<T extends object, DefaultedKeys extends keyof T> =
  NullableKeys<T> | DefaultedKeys;

export type IpcInput<
  T extends object,
  DefaultedKeys extends keyof T = never,
> = Omit<T, OptionalInputKeys<T, DefaultedKeys>> &
  Partial<Pick<T, OptionalInputKeys<T, DefaultedKeys>>>;

export type FileOperationRequestInput = IpcInput<
  FileOperationRequestDto,
  "batchRenames"
>;

export type PlanFileOperationInput = Omit<
  PlanFileOperationRequest,
  "operation"
> & {
  operation: FileOperationRequestInput;
};

type ProtocolDefaultedKeys<T extends object> = Extract<keyof T, "terminalEnv">;

type ProtocolOptionsInput<T extends object> = IpcInput<
  T,
  ProtocolDefaultedKeys<T>
>;

export type NetworkProtocolOptionsInput = {
  [K in keyof NetworkProtocolOptionsDto]?: ProtocolOptionsInput<
    NonNullable<NetworkProtocolOptionsDto[K]>
  >;
};

type WithNetworkOptions<T extends { options: NetworkProtocolOptionsDto }> =
  Omit<IpcInput<T>, "options"> & {
    options?: NetworkProtocolOptionsInput;
  };

export type NetworkProfileAddInput =
  WithNetworkOptions<NetworkProfileAddRequest>;
export type NetworkProfileUpdateInput =
  WithNetworkOptions<NetworkProfileUpdateRequest>;
export type NetworkProfileDraftInput =
  WithNetworkOptions<NetworkProfileDraftDto>;

export type NetworkProfileTestInput = Omit<
  IpcInput<NetworkProfileTestRequest>,
  "draft"
> & {
  draft?: NetworkProfileDraftInput | null;
};

export type TerminalProfileInput = IpcInput<TerminalProfileInputDto>;
export type TerminalProfileAddInput = Omit<
  TerminalProfileAddRequest,
  "profile"
> & {
  profile: TerminalProfileInput;
};
export type TerminalProfileUpdateInput = Omit<
  TerminalProfileUpdateRequest,
  "profile"
> & {
  profile: TerminalProfileInput;
};
export type TerminalSpawnAndRunInput = IpcInput<TerminalSpawnAndRunRequest>;
