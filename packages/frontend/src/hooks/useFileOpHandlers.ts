import { useArchiveHandlers } from "./fileOps/useArchiveHandlers";
import { useClipboardHandlers } from "./fileOps/useClipboardHandlers";
import { useMetadataHandlers } from "./fileOps/useMetadataHandlers";
import { useMutationHandlers } from "./fileOps/useMutationHandlers";
import { useOperationCore } from "./fileOps/useOperationCore";
import { useTransferHandlers } from "./fileOps/useTransferHandlers";
import type {
  FileClipboardState,
  UseFileOpHandlersDeps,
} from "./fileOps/types";

export type { FileClipboardState, UseFileOpHandlersDeps };

export function useFileOpHandlers(deps: UseFileOpHandlersDeps) {
  const core = useOperationCore(deps);
  const clipboard = useClipboardHandlers(deps, core);
  const mutations = useMutationHandlers(deps, core);
  const transfers = useTransferHandlers(deps, core);
  const metadata = useMetadataHandlers(deps, core);
  const archive = useArchiveHandlers(deps, core);

  return {
    ...core,
    ...clipboard,
    ...mutations,
    ...transfers,
    ...metadata,
    ...archive,
  };
}
