import type { ToastMessage } from "./components/ToastStack";

export type ToastInput = Omit<ToastMessage, "id">;

const MAX_VISIBLE_TOASTS = 3;

export function mergeToast(
  current: ToastMessage[],
  toast: ToastInput,
  createId: () => string,
): { toasts: ToastMessage[]; toastId: string } {
  const duplicate = current.find(
    (item) => item.title === toast.title && item.tone === toast.tone,
  );

  if (duplicate) {
    return {
      toastId: duplicate.id,
      toasts: current.map((item) =>
        item.id === duplicate.id ? { ...item, ...toast } : item,
      ),
    };
  }

  const toastId = createId();
  return {
    toastId,
    toasts: [
      ...current.slice(-(MAX_VISIBLE_TOASTS - 1)),
      { ...toast, id: toastId },
    ],
  };
}
