interface DyadProSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Kept as a compatibility export for older renderer imports. */
export function DyadProSuccessDialog({
  isOpen,
  onClose,
}: DyadProSuccessDialogProps) {
  void isOpen;
  void onClose;
  return null;
}
