import React, { useState, useRef, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useLoadAppFile } from "@/hooks/useLoadAppFile";
import { useTheme } from "@/contexts/ThemeContext";
import { ChevronRight, Circle, Save } from "lucide-react";
import "@/components/chat/monaco";
import { ipc } from "@/ipc/types";
import { showError, showSuccess, showWarning } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useSettings } from "@/hooks/useSettings";
import { useCheckProblems } from "@/hooks/useCheckProblems";
import { getLanguage } from "@/utils/get_language";
import { queryKeys } from "@/lib/queryKeys";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { enqueueFileSave, getFileSaveQueueKey } from "./fileSaveQueue";
import { useAtomValue } from "jotai";
import { collaborationSessionAtom } from "@/atoms/collaborationAtoms";

interface FileEditorProps {
  appId: number | null;
  filePath: string;
  initialLine?: number | null;
}

interface BreadcrumbProps {
  path: string;
  hasUnsavedChanges: boolean;
  onSave: () => void;
  isSaving: boolean;
}

const retainedMonacoModels = new Map<
  string,
  { model: MonacoEditor.ITextModel; count: number }
>();

function retainMonacoModel(
  modelPath: string,
  model: MonacoEditor.ITextModel,
): () => void {
  const retainedModel = retainedMonacoModels.get(modelPath);
  if (retainedModel?.model === model) {
    retainedModel.count += 1;
  } else {
    retainedMonacoModels.set(modelPath, { model, count: 1 });
  }

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;

    const retainedModel = retainedMonacoModels.get(modelPath);
    if (!retainedModel || retainedModel.model !== model) {
      return;
    }

    retainedModel.count -= 1;
    if (retainedModel.count <= 0) {
      retainedMonacoModels.delete(modelPath);
      if (!model.isDisposed()) {
        model.dispose();
      }
    }
  };
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({
  path,
  hasUnsavedChanges,
  onSave,
  isSaving,
}) => {
  const { t } = useTranslation("home");
  const segments = path.split("/").filter(Boolean);

  return (
    <div className="flex items-center justify-between px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-1 overflow-hidden">
        <div className="flex items-center gap-1 overflow-hidden min-w-0">
          {segments.map((segment, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <ChevronRight
                  size={14}
                  className="text-gray-400 flex-shrink-0"
                />
              )}
              <span className="hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer truncate">
                {segment}
              </span>
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSave}
                  disabled={!hasUnsavedChanges || isSaving}
                  className="h-6 w-6 p-0"
                  data-testid="save-file-button"
                />
              }
            >
              <Save size={12} />
            </TooltipTrigger>
            <TooltipContent>
              {hasUnsavedChanges
                ? t("preview.saveChanges")
                : t("preview.noUnsavedChanges")}
            </TooltipContent>
          </Tooltip>
          {hasUnsavedChanges && (
            <Circle
              size={8}
              fill="currentColor"
              className="text-amber-600 dark:text-amber-400"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const FileEditor = ({
  appId,
  filePath,
  initialLine = null,
}: FileEditorProps) => {
  const { t } = useTranslation("home");
  const { content, loading, error } = useLoadAppFile(appId, filePath);
  const { theme } = useTheme();
  const [value, setValue] = useState<string | undefined>(undefined);
  const [displayUnsavedChanges, setDisplayUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { settings } = useSettings();
  // Use refs for values that need to be current in event handlers
  const originalValueRef = useRef<string | undefined>(undefined);
  const editorRef = useRef<any>(null);
  const isSavingRef = useRef<boolean>(false);
  const needsSaveRef = useRef<boolean>(false);
  const currentValueRef = useRef<string | undefined>(undefined);
  const hasInitializedContentRef = useRef(false);
  const isMountedRef = useRef(false);
  const releaseModelRef = useRef<(() => void) | null>(null);
  const collaboration = useAtomValue(collaborationSessionAtom);
  const collaborationRef = useRef(collaboration);
  const collaborationRevisionRef = useRef(0);
  const collaborationQueueRef = useRef(Promise.resolve());
  const applyingRemoteRef = useRef(false);
  const collaborationDisposablesRef = useRef<Array<{ dispose(): void }>>([]);
  const remoteCursorDecorationsRef = useRef(new Map<string, string[]>());
  const cursorBroadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const queryClient = useQueryClient();
  const { checkProblems } = useCheckProblems(appId);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      releaseModelRef.current?.();
      releaseModelRef.current = null;
      collaborationDisposablesRef.current.forEach((item) => item.dispose());
      collaborationDisposablesRef.current = [];
      if (cursorBroadcastTimerRef.current) {
        clearTimeout(cursorBroadcastTimerRef.current);
        cursorBroadcastTimerRef.current = null;
      }
      const editor = editorRef.current;
      if (editor) {
        for (const ids of remoteCursorDecorationsRef.current.values())
          editor.deltaDecorations(ids, []);
      }
      remoteCursorDecorationsRef.current.clear();
    };
  }, []);

  // Initialize editor state from disk once per mounted file editor instance.
  useEffect(() => {
    if (
      content === null ||
      (hasInitializedContentRef.current && needsSaveRef.current)
    ) {
      return;
    }

    hasInitializedContentRef.current = true;
    setValue(content);
    originalValueRef.current = content;
    currentValueRef.current = content;
    needsSaveRef.current = false;
    setDisplayUnsavedChanges(false);
    setIsSaving(false);
  }, [content]);

  // Determine if dark mode based on theme
  const isDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const editorTheme = isDarkMode ? "dyad-dark" : "dyad-light";
  const modelPath = React.useMemo(() => {
    const normalizedPath = filePath.replace(/^\/+/, "");
    return `file:///app-${appId ?? "unknown"}/${encodeURI(normalizedPath)}`;
  }, [appId, filePath]);

  useEffect(() => {
    collaborationRef.current = collaboration;
    const file = collaboration?.files.find((item) => item.path === filePath);
    if (file) collaborationRevisionRef.current = file.revision;
  }, [collaboration, filePath]);

  useEffect(() => {
    const unsubscribe = ipc.events.collaboration.onUpdate((event) => {
      if (event.appId !== appId) return;

      if (event.type === "cursor") {
        if (
          !event.actor ||
          event.actor.id === collaborationRef.current?.participantId ||
          String(event.payload.path ?? "") !== filePath
        ) {
          return;
        }
        const selection = event.payload.selection as
          | {
              startLineNumber?: unknown;
              startColumn?: unknown;
              endLineNumber?: unknown;
              endColumn?: unknown;
            }
          | undefined;
        const values = [
          selection?.startLineNumber,
          selection?.startColumn,
          selection?.endLineNumber,
          selection?.endColumn,
        ];
        if (!values.every((value) => Number.isInteger(value) && Number(value) > 0))
          return;
        const editor = editorRef.current;
        if (!editor) return;
        const oldDecorations =
          remoteCursorDecorationsRef.current.get(event.actor.id) ?? [];
        const nextDecorations = editor.deltaDecorations(oldDecorations, [
          {
            range: {
              startLineNumber: Number(selection?.startLineNumber),
              startColumn: Number(selection?.startColumn),
              endLineNumber: Number(selection?.endLineNumber),
              endColumn: Number(selection?.endColumn),
            },
            options: {
              inlineClassName:
                "bg-blue-500/20 border-l-2 border-blue-500 rounded-sm",
              hoverMessage: {
                value: `${event.actor.displayName} is editing here`,
              },
            },
          },
        ]);
        remoteCursorDecorationsRef.current.set(
          event.actor.id,
          nextDecorations,
        );
        return;
      }

      if (!['text_edit', 'file_snapshot', 'file_create'].includes(event.type))
        return;
      if (String(event.payload.path ?? "") !== filePath) return;
      const content = String(event.payload.content ?? "");
      collaborationRevisionRef.current = Number(
        event.payload.revision ?? collaborationRevisionRef.current,
      );
      const model = editorRef.current?.getModel();
      if (!model || model.getValue() === content) return;
      applyingRemoteRef.current = true;
      model.setValue(content);
      originalValueRef.current = content;
      currentValueRef.current = content;
      needsSaveRef.current = false;
      setValue(content);
      setDisplayUnsavedChanges(false);
      queueMicrotask(() => {
        applyingRemoteRef.current = false;
      });
    });
    return unsubscribe;
  }, [appId, filePath]);

  // Navigate to a specific line in the editor
  const navigateToLine = React.useCallback((line: number | null) => {
    if (line == null || !editorRef.current) {
      return;
    }
    const lineNumber = Math.max(1, Math.floor(line));
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;
    if (lineNumber > model.getLineCount()) return;

    editor.revealLineInCenter(lineNumber);
    editor.setPosition({ lineNumber, column: 1 });
  }, []);

  // Handle editor mount
  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
    const model = editor.getModel();
    if (model) {
      releaseModelRef.current = retainMonacoModel(modelPath, model);
      const contentDisposable = model.onDidChangeContent((event) => {
        const activeCollaboration = collaborationRef.current;
        if (
          appId === null ||
          !activeCollaboration ||
          activeCollaboration.role === "viewer" ||
          applyingRemoteRef.current
        )
          return;
        const changes = event.changes.map((change) => ({
          rangeOffset: change.rangeOffset,
          rangeLength: change.rangeLength,
          text: change.text,
        }));
        collaborationQueueRef.current = collaborationQueueRef.current
          .then(async () => {
            const result = await ipc.collaboration.sendTextEdit({
              appId,
              path: filePath,
              baseRevision: collaborationRevisionRef.current,
              changes,
            });
            collaborationRevisionRef.current = result.revision;
          })
          .catch((error) => {
            showError(error);
          });
      });
      collaborationDisposablesRef.current.push(contentDisposable);
    }

    const activeCollaboration = collaborationRef.current;
    if (
      appId !== null &&
      activeCollaboration &&
      activeCollaboration.role !== "viewer"
    ) {
      void ipc.collaboration.sendEvent({
        appId,
        type: "active_file",
        payload: { path: filePath },
      });
      collaborationDisposablesRef.current.push(
        editor.onDidChangeCursorSelection((event) => {
          if (cursorBroadcastTimerRef.current)
            clearTimeout(cursorBroadcastTimerRef.current);
          cursorBroadcastTimerRef.current = setTimeout(() => {
            void ipc.collaboration.sendEvent({
              appId,
              type: "cursor",
              payload: {
                path: filePath,
                selection: {
                  startLineNumber: event.selection.startLineNumber,
                  startColumn: event.selection.startColumn,
                  endLineNumber: event.selection.endLineNumber,
                  endColumn: event.selection.endColumn,
                },
              },
            });
          }, 80);
        }),
      );
    }

    // Navigate to initialLine if provided (handles case when editor mounts after initialLine is set)
    if (initialLine != null) {
      navigateToLine(initialLine);
    }

    // Save when the editor loses focus and the current model is dirty.
    editor.onDidBlurEditorText(() => {
      if (needsSaveRef.current) {
        saveFile();
      }
    });
  };

  // Handle content change
  const handleEditorChange = (newValue: string | undefined) => {
    if (applyingRemoteRef.current) return;
    setValue(newValue);
    currentValueRef.current = newValue;

    const hasChanged = newValue !== originalValueRef.current;
    needsSaveRef.current = hasChanged;
    setDisplayUnsavedChanges(hasChanged);
  };

  // Save the file
  const saveFile = async () => {
    if (
      appId === null ||
      currentValueRef.current === undefined ||
      !needsSaveRef.current ||
      isSavingRef.current
    )
      return;

    const saveAppId = appId;
    const saveFilePath = filePath;
    const savedValue = currentValueRef.current;
    const saveQueueKey = getFileSaveQueueKey(saveAppId, saveFilePath);
    const performSave = () =>
      ipc.app.editAppFile({
        appId: saveAppId,
        filePath: saveFilePath,
        content: savedValue,
      });

    try {
      isSavingRef.current = true;
      if (isMountedRef.current) {
        setIsSaving(true);
      }

      const { warning } = await enqueueFileSave(saveQueueKey, performSave);
      queryClient.setQueryData(
        queryKeys.appFiles.content({
          appId: saveAppId,
          filePath: saveFilePath,
        }),
        savedValue,
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.versions.list({ appId: saveAppId }),
      });
      if (settings?.enableAutoFixProblems) {
        checkProblems();
      }
      if (warning) {
        showWarning(warning);
      } else {
        showSuccess(t("preview.fileSaved"));
      }

      originalValueRef.current = savedValue;
      const hasNewerEdits = currentValueRef.current !== savedValue;
      needsSaveRef.current = hasNewerEdits;
      if (isMountedRef.current) {
        setDisplayUnsavedChanges(hasNewerEdits);
      }
    } catch (error) {
      showError(error);
    } finally {
      isSavingRef.current = false;
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  // Jump to target line if provided (e.g., from search results)
  // This effect handles when initialLine changes after the editor is mounted
  // Include content in dependencies to ensure navigation only occurs after file content is loaded
  useEffect(() => {
    // Only navigate if content is loaded (not null) to avoid navigating in old file content
    if (content !== null) {
      navigateToLine(initialLine ?? null);
    }
  }, [initialLine, filePath, content, navigateToLine]);

  if (loading) {
    return <div className="p-4">{t("preview.loadingFileContent")}</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error.message}</div>;
  }

  if (content === null) {
    return (
      <div className="p-4 text-gray-500">{t("preview.noContentAvailable")}</div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Breadcrumb
        path={filePath}
        hasUnsavedChanges={displayUnsavedChanges}
        onSave={saveFile}
        isSaving={isSaving}
      />
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          path={modelPath}
          keepCurrentModel
          defaultLanguage={getLanguage(filePath)}
          value={value}
          theme={editorTheme}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            readOnly: collaboration?.role === "viewer",
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            wordWrap: "off",
            automaticLayout: true,
            fontFamily: "monospace",
            fontSize: 13,
            lineNumbers: "on",
          }}
        />
      </div>
    </div>
  );
};
