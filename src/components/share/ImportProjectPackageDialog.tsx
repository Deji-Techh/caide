import { useState } from "react";
import { LoaderCircle, PackageOpen, ShieldCheck } from "lucide-react";
import { ipc, type ProjectPackageInspection } from "@/ipc/types";
import { useLoadApps } from "@/hooks/useLoadApps";
import { useSelectChat } from "@/hooks/useSelectChat";
import { showError, showSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ImportProjectPackageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { refreshApps } = useLoadApps();
  const { selectChat } = useSelectChat();
  const [packagePath, setPackagePath] = useState<string | null>(null);
  const [inspection, setInspection] = useState<ProjectPackageInspection | null>(
    null,
  );
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState<"selecting" | "importing" | null>(null);

  const reset = () => {
    setPackagePath(null);
    setInspection(null);
    setProjectName("");
    setBusy(null);
  };

  const closeDialog = () => {
    if (busy) return;
    reset();
    onOpenChange(false);
  };

  const choosePackage = async () => {
    setBusy("selecting");
    try {
      const selected = await ipc.share.selectPackageFile();
      if (!selected.path) return;
      const result = await ipc.share.inspectProjectPackage({
        path: selected.path,
      });
      setPackagePath(selected.path);
      setInspection(result);
      setProjectName(result.manifest.projectName);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  };

  const importPackage = async () => {
    if (!packagePath || !inspection) return;
    setBusy("importing");
    try {
      const result = await ipc.share.importProjectPackage({
        path: packagePath,
        appName: projectName.trim() || inspection.manifest.projectName,
      });
      await refreshApps();
      showSuccess(`${result.appName} was added to Received`);
      reset();
      onOpenChange(false);
      selectChat({ chatId: result.chatId, appId: result.appId });
    } catch (error) {
      showError(error);
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && busy) return;
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="caide-package-import-dialog max-w-xl">
        <DialogHeader>
          <DialogTitle>Import CAIDE project package</DialogTitle>
          <DialogDescription>
            Inspect the package before adding its independent local copy to your
            Received projects.
          </DialogDescription>
        </DialogHeader>

        {!inspection ? (
          <button
            type="button"
            className="caide-package-dropzone"
            disabled={busy !== null}
            onClick={() => void choosePackage()}
          >
            {busy === "selecting" ? (
              <LoaderCircle className="animate-spin" size={24} />
            ) : (
              <PackageOpen size={24} />
            )}
            <strong>Select a .caidepkg file</strong>
            <span>The package is validated before extraction.</span>
          </button>
        ) : (
          <div className="caide-package-inspection">
            <div className="caide-package-inspection-head">
              <ShieldCheck size={21} />
              <div>
                <strong>{inspection.manifest.projectName}</strong>
                <span>
                  {(inspection.sizeBytes / 1024 / 1024).toFixed(1)} MB · package
                  format {inspection.manifest.formatVersion}
                </span>
              </div>
            </div>
            <dl>
              <div>
                <dt>Chats</dt>
                <dd>{inspection.chatCount}</dd>
              </div>
              <div>
                <dt>Messages</dt>
                <dd>{inspection.messageCount}</dd>
              </div>
              <div>
                <dt>Versions</dt>
                <dd>{inspection.versionCount}</dd>
              </div>
              <div>
                <dt>Git history</dt>
                <dd>
                  {inspection.manifest.includes.gitHistory
                    ? "Included"
                    : "Not included"}
                </dd>
              </div>
            </dl>
            <label>
              Local project name
              <Input
                value={projectName}
                maxLength={100}
                onChange={(event) => setProjectName(event.target.value)}
              />
            </label>
            <p>
              This project can contain untrusted code. CAIDE will not install
              dependencies or run it automatically.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={closeDialog}
          >
            Cancel
          </Button>
          {inspection ? (
            <Button
              disabled={busy !== null || !projectName.trim()}
              onClick={() => void importPackage()}
            >
              {busy === "importing" ? (
                <LoaderCircle className="animate-spin" />
              ) : null}
              Import project
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
