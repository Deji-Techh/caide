import { useState } from "react";
import { AlertTriangle, Box, Pencil, PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CreateCustomModelDialog } from "@/components/CreateCustomModelDialog";
import { EditCustomModelDialog } from "@/components/EditCustomModelDialog";
import { useLanguageModelsForProvider } from "@/hooks/useLanguageModelsForProvider"; // Use the hook directly here
import { useDeleteCustomModel } from "@/hooks/useDeleteCustomModel"; // Import the new hook
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
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

interface ModelsSectionProps {
  providerId: string;
  allowCustomModels?: boolean;
}

export function ModelsSection({
  providerId,
  allowCustomModels = true,
}: ModelsSectionProps) {
  const [isCustomModelDialogOpen, setIsCustomModelDialogOpen] = useState(false);
  const [isEditModelDialogOpen, setIsEditModelDialogOpen] = useState(false);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] =
    useState(false);
  const [modelToDelete, setModelToDelete] = useState<string | null>(null);
  const [modelToEdit, setModelToEdit] = useState<any | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const invalidateModels = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.languageModels.forProvider({ providerId }),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.languageModels.byProviders,
    });
  };

  // Fetch custom models within this component now
  const {
    data: models,
    isLoading: modelsLoading,
    error: modelsError,
  } = useLanguageModelsForProvider(providerId);

  const { mutate: deleteModel, isPending: isDeleting } = useDeleteCustomModel({
    onSuccess: () => {
      // Optionally show a success toast here
      invalidateModels();
    },
    onError: (error: Error) => {
      // Optionally show an error toast here
      console.error("Failed to delete model:", error);
    },
  });

  const handleDeleteClick = (modelApiName: string) => {
    setModelToDelete(modelApiName);
    setIsConfirmDeleteDialogOpen(true);
  };

  const handleEditClick = (model: any) => {
    setModelToEdit(model);
    setIsEditModelDialogOpen(true);
  };

  const handleModelClick = (modelApiName: string) => {
    setSelectedModel(selectedModel === modelApiName ? null : modelApiName);
  };

  const handleModelDoubleClick = (model: any) => {
    if (model.type === "custom") {
      handleEditClick(model);
    }
  };

  const handleConfirmDelete = () => {
    if (modelToDelete) {
      deleteModel({ providerId, modelApiName: modelToDelete });
      setModelToDelete(null);
    }
    setIsConfirmDeleteDialogOpen(false);
  };

  return (
    <div className="mt-8 border-t border-border/70 pt-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">
            Available routing targets
          </p>
          <h2 className="mt-1 text-lg font-semibold">Models</h2>
        </div>
        {!modelsLoading && !modelsError && (
          <span className="text-xs text-muted-foreground">
            {models?.length ?? 0} available
          </span>
        )}
      </div>

      {/* Custom Models List Area */}
      {modelsLoading && (
        <div className="mt-5 divide-y border-y border-border/70">
          <Skeleton className="h-16 w-full rounded-none" />
          <Skeleton className="h-16 w-full rounded-none" />
        </div>
      )}
      {modelsError && (
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Models</AlertTitle>
          <AlertDescription>{modelsError.message}</AlertDescription>
        </Alert>
      )}
      {!modelsLoading && !modelsError && models && models.length > 0 && (
        <div className="mt-5 divide-y border-y border-border/70">
          {models.map((model) => (
            <div
              key={model.apiName + model.displayName}
              className={`group flex min-h-16 cursor-pointer items-center gap-3 px-2 py-3 transition-colors hover:bg-muted/40 ${
                selectedModel === model.apiName ? "bg-primary/5" : ""
              }`}
              onClick={() => handleModelClick(model.apiName)}
              onDoubleClick={() => handleModelDoubleClick(model)}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border/80 text-muted-foreground">
                <Box className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h4 className="truncate text-sm font-medium">
                    {model.displayName}
                  </h4>
                  <code className="truncate text-[11px] text-muted-foreground">
                    {model.apiName}
                  </code>
                </div>
                {model.description && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {model.description}
                  </p>
                )}
              </div>
              <div className="hidden shrink-0 items-center gap-4 text-[11px] text-muted-foreground sm:flex">
                {model.contextWindow && (
                  <span>{model.contextWindow.toLocaleString()} context</span>
                )}
                {model.maxOutputTokens && (
                  <span>{model.maxOutputTokens.toLocaleString()} output</span>
                )}
                <span className="font-mono uppercase">
                  {model.type === "cloud" ? "Built-in" : "Custom"}
                </span>
              </div>
              {model.type === "custom" && (
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClick(model);
                    }}
                    aria-label={`Edit ${model.displayName}`}
                    className="h-8 w-8"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(model.apiName);
                    }}
                    disabled={isDeleting}
                    aria-label={`Delete ${model.displayName}`}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!modelsLoading && !modelsError && (!models || models.length === 0) && (
        <p className="mt-5 border-y border-border/70 py-6 text-sm text-muted-foreground">
          No models are available for this provider yet.
        </p>
      )}
      {/* End Custom Models List Area */}

      {allowCustomModels && providerId !== "auto" && (
        <Button
          onClick={() => setIsCustomModelDialogOpen(true)}
          variant="outline"
          className="mt-5 h-10"
        >
          <PlusIcon className="mr-2 h-4 w-4" /> Add Custom Model
        </Button>
      )}

      {/* Render the dialogs */}
      <CreateCustomModelDialog
        isOpen={isCustomModelDialogOpen}
        onClose={() => setIsCustomModelDialogOpen(false)}
        onSuccess={() => {
          setIsCustomModelDialogOpen(false);
          invalidateModels();
        }}
        providerId={providerId}
      />

      <EditCustomModelDialog
        isOpen={isEditModelDialogOpen}
        onClose={() => setIsEditModelDialogOpen(false)}
        onSuccess={() => {
          setIsEditModelDialogOpen(false);
          invalidateModels();
        }}
        providerId={providerId}
        model={modelToEdit}
      />

      <AlertDialog
        open={isConfirmDeleteDialogOpen}
        onOpenChange={setIsConfirmDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this model?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              custom model "
              {modelToDelete
                ? models?.find((m) => m.apiName === modelToDelete)
                    ?.displayName || modelToDelete
                : ""}
              " (API Name: {modelToDelete}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setModelToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Yes, delete it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
