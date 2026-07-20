import { useState, useCallback, useRef, useEffect } from "react";

interface NotchChatInputProps {
  onSend: (prompt: string) => void;
  isStreaming: boolean;
}

export function NotchChatInput({ onSend, isStreaming }: NotchChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isStreaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isStreaming]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || isStreaming) return;
      onSend(trimmed);
      setValue("");
    },
    [value, isStreaming, onSend],
  );

  return (
    <form className="notch-chat-input-form" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className="notch-chat-input"
        type="text"
        placeholder="Build your app idea..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={isStreaming}
      />
      <button
        className="notch-send-btn"
        type="submit"
        disabled={!value.trim() || isStreaming}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </form>
  );
}
