interface DyadProTrialDialogProps {
  isOpen: boolean;
  onClose: () => void;
  utmCampaign?: string;
}

/** Kept as a compatibility export for older renderer imports. */
export function DyadProTrialDialog({
  isOpen,
  onClose,
  utmCampaign,
}: DyadProTrialDialogProps) {
  void isOpen;
  void onClose;
  void utmCampaign;
  return null;
}
