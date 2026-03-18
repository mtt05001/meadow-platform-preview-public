"use client";

import { useRef, useEffect } from "react";

const TOOLBAR_OPTIONS = [
  ["bold", "italic", "underline"],
  [{ header: 2 }, { header: 3 }],
  [{ list: "bullet" }, { list: "ordered" }],
  ["clean"],
];

interface QuillEditorProps {
  value: string;
  onChange?: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function QuillEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "",
}: QuillEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<unknown>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Track whether we're programmatically setting content
  const isSettingRef = useRef(false);
  // Store latest value for use after async import
  const initialValueRef = useRef(value);
  initialValueRef.current = value;

  // Initialize Quill once, with cleanup for Strict Mode
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;

      const Quill = (await import("quill")).default;

      // Check after async — Strict Mode may have cleaned us up
      if (cancelled || !containerRef.current) return;

      const editorDiv = document.createElement("div");
      containerRef.current.appendChild(editorDiv);

      const q = new Quill(editorDiv, {
        theme: "snow",
        modules: { toolbar: TOOLBAR_OPTIONS },
        placeholder,
      });

      q.on("text-change", () => {
        if (isSettingRef.current) return;
        onChangeRef.current?.(q.root.innerHTML);
      });

      quillRef.current = q;

      // Set initial value
      if (initialValueRef.current) {
        isSettingRef.current = true;
        q.clipboard.dangerouslyPasteHTML(initialValueRef.current);
        isSettingRef.current = false;
      }

      if (disabled) q.disable();
    }

    init();

    return () => {
      cancelled = true;
      quillRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update content when value prop changes externally
  useEffect(() => {
    const q = quillRef.current as {
      root: HTMLElement;
      clipboard: { dangerouslyPasteHTML: (html: string) => void };
    } | null;
    if (!q) return;
    if (q.root.innerHTML !== value) {
      isSettingRef.current = true;
      q.clipboard.dangerouslyPasteHTML(value || "");
      isSettingRef.current = false;
    }
  }, [value]);

  // Update disabled state
  useEffect(() => {
    const q = quillRef.current as { enable: (v: boolean) => void } | null;
    if (!q) return;
    q.enable(!disabled);
  }, [disabled]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css"
      />
      <div
        ref={containerRef}
        className={disabled ? "opacity-65 pointer-events-none" : ""}
      />
    </>
  );
}
