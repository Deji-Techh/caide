import { MousePointer2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnnotatorOnlyForProProps {
  onGoBack: () => void;
}

export const AnnotatorOnlyForPro = ({ onGoBack }: AnnotatorOnlyForProProps) => {
  return (
    <div className="w-full h-full bg-background relative">
      {/* Go Back Button */}
      <button
        onClick={onGoBack}
        className="absolute top-4 left-4 p-2 hover:bg-accent rounded-md transition-all z-10 group"
        aria-label="Go back"
      >
        <ArrowLeft
          size={20}
          className="text-foreground/70 group-hover:text-foreground transition-colors"
        />
      </button>

      {/* Centered Content */}
      <div className="flex flex-col items-center justify-center h-full px-8">
        <MousePointer2
          size={72}
          className="text-primary/60 dark:text-primary/70 mb-8"
        />

        {/* Message */}
        <h2 className="text-3xl font-semibold text-foreground mb-4 text-center">
          Visual editor is ready
        </h2>
        <p className="text-muted-foreground mb-10 text-center max-w-md text-base leading-relaxed">
          Return to the preview and use Inspect or Edit to select and change app
          components directly.
        </p>

        {/* Return action */}
        <Button
          onClick={onGoBack}
          size="lg"
          className="px-8 shadow-md hover:shadow-lg transition-all"
        >
          Return to preview
        </Button>
      </div>
    </div>
  );
};
