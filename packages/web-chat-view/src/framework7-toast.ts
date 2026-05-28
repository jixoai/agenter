import { app } from "framework7-svelte";

type Framework7ToastInstance = {
  open: () => void;
};

type Framework7ToastFactory = (params: {
  text: string;
  closeTimeout?: number;
  position?: "top" | "center" | "bottom";
}) => Framework7ToastInstance;

export const showFramework7Toast = (
  text: string,
  options: {
    closeTimeout?: number;
    position?: "top" | "center" | "bottom";
  } = {},
): boolean => {
  const toastFactory = (
    app as {
      f7?: {
        toast?: {
          create?: Framework7ToastFactory;
        };
      } | null;
    }
  ).f7?.toast?.create;
  if (typeof toastFactory !== "function") {
    return false;
  }
  const toast = toastFactory({
    text,
    closeTimeout: options.closeTimeout ?? 1600,
    position: options.position ?? "bottom",
  });
  toast.open();
  return true;
};
