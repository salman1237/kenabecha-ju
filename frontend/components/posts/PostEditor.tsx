"use client";

import { Color } from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-font-family";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Baseline, Bold, ChevronDown, Italic, Type, Underline as UnderlineIcon } from "lucide-react";
import { useEffect } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

/** Kept in lockstep with `ALLOWED_TAGS`/CSS allow-list in the backend's
 *  `sanitize_post_html` — every mark the toolbar can produce has to survive
 *  the server's sanitizer, or the editor would be lying about what sticks. */
const FONT_OPTIONS: { label: string; value: string | null }[] = [
  { label: "Default", value: null },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Monospace", value: "'Courier New', ui-monospace, monospace" },
  { label: "Rounded", value: "'Comic Sans MS', 'Comic Sans', cursive" },
];

const COLOR_OPTIONS: { label: string; value: string | null; swatch: string }[] = [
  { label: "Default", value: null, swatch: "var(--foreground)" },
  { label: "Emerald", value: "#059669", swatch: "#059669" },
  { label: "Red", value: "#dc2626", swatch: "#dc2626" },
  { label: "Blue", value: "#2563eb", swatch: "#2563eb" },
  { label: "Amber", value: "#d97706", swatch: "#d97706" },
  { label: "Violet", value: "#7c3aed", swatch: "#7c3aed" },
];

export function PostEditor({
  value,
  onChange,
  placeholder = "Write something that'll make people stop scrolling…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Everything below renders a tag the sanitizer strips on save — off,
        // so the editor never lets a seller build formatting that vanishes.
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
        strike: false,
      }),
      TextStyle,
      Color,
      FontFamily,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "min-h-32 rounded-b-xl px-3 py-2.5 text-sm leading-relaxed focus:outline-none [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Only pushed back into the editor when it actually diverges (e.g. a form
  // reset loading a different post) — syncing on every render would fight
  // the user's own typing and reset the cursor to the start.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return <div className="h-40 animate-pulse rounded-xl border border-border bg-muted/40" />;
  }

  const activeFont = FONT_OPTIONS.find(
    (f) => f.value && editor.isActive("textStyle", { fontFamily: f.value })
  );
  const activeColor = COLOR_OPTIONS.find(
    (c) => c.value && editor.isActive("textStyle", { color: c.value })
  );

  return (
    <div className="rounded-xl border border-border bg-card/60 shadow-[var(--shadow-soft-xs)]">
      <div className="flex flex-wrap items-center gap-1 border-b border-border/70 p-1.5">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <Bold />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <Italic />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("underline")}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Underline"
        >
          <UnderlineIcon />
        </Toggle>

        <div className="mx-1 h-5 w-px bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              />
            }
          >
            <Type className="size-3.5" />
            {activeFont?.label ?? "Font"}
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {FONT_OPTIONS.map((f) => (
              <DropdownMenuItem
                key={f.label}
                style={f.value ? { fontFamily: f.value } : undefined}
                onClick={() =>
                  f.value
                    ? editor.chain().focus().setFontFamily(f.value).run()
                    : editor.chain().focus().unsetFontFamily().run()
                }
              >
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              />
            }
          >
            <Baseline className="size-3.5" style={{ color: activeColor?.swatch }} />
            {activeColor?.label ?? "Colour"}
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {COLOR_OPTIONS.map((c) => (
              <DropdownMenuItem
                key={c.label}
                onClick={() =>
                  c.value
                    ? editor.chain().focus().setColor(c.value).run()
                    : editor.chain().focus().unsetColor().run()
                }
              >
                <span
                  className={cn(
                    "inline-block size-3 rounded-full border border-border/70",
                    !c.value && "border-dashed"
                  )}
                  style={{ background: c.value ?? "transparent" }}
                />
                {c.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
