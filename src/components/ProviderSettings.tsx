import { useNavigate } from "@tanstack/react-router";
import { providerSettingsRoute } from "@/routes/settings/providers/$provider";
import type { LanguageModelProvider } from "@/ipc/types";

import { useLanguageModelProviders } from "@/hooks/useLanguageModelProviders";
import { useCustomLanguageModelProvider } from "@/hooks/useCustomLanguageModelProvider";
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  Edit,
  PlusIcon,
  Server,
  Trash2,
} from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { CreateCustomProviderDialog } from "./CreateCustomProviderDialog";

export function ProviderSettingsGrid() {
  const navigate = useNavigate();
  const { t } = useTranslation(["settings", "common"]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] =
    useState<LanguageModelProvider | null>(null);
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null);

  const {
    data: providers,
    isLoading,
    error,
    isProviderSetup,
    refetch,
  } = useLanguageModelProviders();

  const { deleteProvider, isDeleting } = useCustomLanguageModelProvider();

  const handleProviderClick = (providerId: string) => {
    navigate({
      to: providerSettingsRoute.id,
      params: { provider: providerId },
    });
  };

  const handleDeleteProvider = async () => {
    if (providerToDelete) {
      await deleteProvider(providerToDelete);
      setProviderToDelete(null);
      refetch();
    }
  };

  const handleEditProvider = (provider: LanguageModelProvider) => {
    setEditingProvider(provider);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-medium mb-6">
          {t("settings:ai.providers")}
        </h2>
        <div className="divide-y border-y border-border/70">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex h-16 items-center gap-3 px-1">
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-medium mb-6">
          {t("settings:ai.providers")}
        </h2>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("common:error")}</AlertTitle>
          <AlertDescription>
            {t("settings:ai.failedToLoadProviders", { message: error.message })}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">
            Model routing
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {t("settings:ai.providers")}
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          Credentials stay on this device
        </span>
      </div>
      <div className="divide-y border-y border-border/70">
        {providers
          ?.filter((p) => p.type !== "local" && p.id !== "auto")
          .sort((a, b) => {
            const priority = [
              "chatgpt",
              "deepseek",
              "openai",
              "anthropic",
              "google",
            ];
            const aRank = priority.indexOf(a.id);
            const bRank = priority.indexOf(b.id);
            if (aRank !== -1 || bRank !== -1) {
              return (aRank === -1 ? 99 : aRank) - (bRank === -1 ? 99 : bRank);
            }
            return a.name.localeCompare(b.name);
          })
          .map((provider: LanguageModelProvider) => {
            const isCustom = provider.type === "custom";
            const configured = isProviderSetup(provider.id);
            const ProviderGlyph = isCustom ? Server : Cloud;

            return (
              <div
                key={provider.id}
                className="group flex min-h-16 items-center gap-3 px-1 py-2"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => handleProviderClick(provider.id)}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border/80 bg-background text-muted-foreground">
                    <ProviderGlyph className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {provider.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {provider.id === "chatgpt"
                        ? "Sign in with your ChatGPT account"
                        : configured
                          ? "Connection ready"
                          : isCustom
                            ? "Custom OpenAI-compatible endpoint"
                            : provider.hasFreeTier
                              ? "API key, free tier available"
                              : "API key required"}
                    </span>
                  </span>
                  <span
                    className={
                      configured
                        ? "flex items-center gap-1.5 text-xs text-emerald-500"
                        : "flex items-center gap-1.5 text-xs text-muted-foreground"
                    }
                  >
                    {configured && <CheckCircle2 className="size-3.5" />}
                    {configured ? t("common:ready") : t("common:needsSetup")}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
                {isCustom && (
                  <div className="flex shrink-0 items-center">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            data-testid="edit-custom-provider"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-muted rounded-md"
                            onClick={() => handleEditProvider(provider)}
                          />
                        }
                      >
                        <Edit className="h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        {t("settings:ai.editProvider")}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            data-testid="delete-custom-provider"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-md"
                            onClick={() => setProviderToDelete(provider.id)}
                          />
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        {t("settings:ai.deleteProvider")}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
            );
          })}

        <button
          type="button"
          className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          onClick={() => setIsDialogOpen(true)}
        >
          <span className="grid size-9 place-items-center rounded-md border border-dashed border-current/40">
            <PlusIcon className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-medium">
              {t("settings:ai.addCustomProvider")}
            </span>
            <span className="mt-0.5 block text-xs">
              {t("settings:ai.connectCustomEndpoint")}
            </span>
          </span>
        </button>
      </div>

      <CreateCustomProviderDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingProvider(null);
        }}
        onSuccess={() => {
          setIsDialogOpen(false);
          refetch();
          setEditingProvider(null);
        }}
        editingProvider={editingProvider}
      />

      <AlertDialog
        open={!!providerToDelete}
        onOpenChange={(open) => !open && setProviderToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings:ai.deleteCustomProvider")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings:ai.deleteProviderConfirmation")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("common:cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProvider}
              disabled={isDeleting}
            >
              {isDeleting
                ? t("common:deleting")
                : t("settings:ai.deleteProviderAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
