import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { AVATAR_COLORS, AVATAR_SHAPE_KEYS } from "@rakazo/core";
import {
  AvatarShapePreview,
  BotAvatar,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rakazo/ui-web";
import { Check, Pencil, Upload, X } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";

export function AvatarStudio({
  identity,
  color,
  shape,
  imageSrc,
  onColorChange,
  onShapeChange,
  onUpload,
  onReset,
  disabled = false,
}: {
  identity: string;
  color: string;
  shape?: string | null;
  imageSrc?: string;
  onColorChange: (color: string) => void;
  onShapeChange: (shape: string) => void;
  onUpload: (file: File) => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"bot" | "upload">("bot");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function takeFile(file: File | undefined) {
    if (!file?.type.startsWith("image/")) return;
    onUpload(file);
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="group relative cursor-pointer rounded-2xl outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t`Customize bot avatar`}
        data-testid="avatar-studio-trigger"
      >
        <BotAvatar color={color} shape={shape} identity={identity} size={72} imageSrc={imageSrc} />
        <div className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border-2 border-background bg-secondary text-foreground shadow-md">
          <Pencil size={12} strokeWidth={2.2} />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-[360px] max-w-full gap-4 rounded-3xl p-5 sm:max-w-[360px]"
          data-testid="avatar-studio"
        >
          <DialogHeader className="flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-body font-semibold tracking-tight">
              <Trans>Avatar Studio</Trans>
            </DialogTitle>
            <DialogDescription className="sr-only">
              <Trans>Choose a bot shape, color, or upload an image</Trans>
            </DialogDescription>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t`Close`}
            >
              <X size={16} />
            </button>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-2">
            <BotAvatar
              color={color}
              shape={shape}
              identity={identity}
              size={78}
              imageSrc={imageSrc}
            />
          </div>

          <div className="flex items-center justify-between border-b border-border pb-1">
            <div className="flex items-center rounded-full bg-muted p-1 text-caption">
              <button
                type="button"
                onClick={() => setActiveTab("bot")}
                aria-pressed={activeTab === "bot"}
                className={`rounded-full px-3 py-1 font-medium ${
                  activeTab === "bot"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Trans>Bot</Trans>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                aria-pressed={activeTab === "upload"}
                className={`rounded-full px-3 py-1 font-medium ${
                  activeTab === "upload"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Trans>Upload</Trans>
              </button>
            </div>
          </div>

          {activeTab === "bot" ? (
            <div className="space-y-4 pt-1" data-testid="avatar-studio-bot-tab">
              <div>
                <div className="mb-2 text-caption font-medium tracking-[0.06em] text-muted-foreground uppercase">
                  <Trans>Shape</Trans>
                </div>
                <div className="grid grid-cols-4 place-items-center gap-2">
                  {AVATAR_SHAPE_KEYS.map((key) => (
                    <AvatarShapePreview
                      key={key}
                      shape={key}
                      color={color}
                      selected={!imageSrc && shape === key}
                      onClick={() => onShapeChange(key)}
                    />
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-2">
                <div className="mb-2 text-caption font-medium tracking-[0.06em] text-muted-foreground uppercase">
                  <Trans>Color</Trans>
                </div>
                <div className="grid grid-cols-6 place-items-center gap-2">
                  {AVATAR_COLORS.map((option) => {
                    const selected = color.toLowerCase() === option.hex.toLowerCase() && !imageSrc;
                    return (
                      <button
                        key={option.hex}
                        type="button"
                        onClick={() => onColorChange(option.hex)}
                        aria-label={t`Color ${option.name}`}
                        aria-pressed={selected}
                        className={`size-6 rounded-full border transition-transform hover:scale-110 ${
                          selected
                            ? "scale-105 border-transparent ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                            : "border-border"
                        }`}
                        style={{ backgroundColor: option.hex }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              aria-label={t`Image upload area`}
              onDragOver={(event: DragEvent<HTMLButtonElement>) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                takeFile(event.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex w-full flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center ${
                dragOver ? "border-primary bg-primary/10" : "border-border bg-muted"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  takeFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <div className="mb-2 grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground">
                <Upload size={18} strokeWidth={1.8} />
              </div>
              <p className="text-small font-medium text-muted-foreground">
                <Trans>Drag, drop, or paste an image</Trans>
              </p>
              <span className="mt-3 rounded-lg bg-secondary px-3 py-1.5 text-caption font-medium text-foreground">
                <Trans>Choose file</Trans>
              </span>
            </button>
          )}

          <DialogFooter className="border-border sm:justify-between">
            <button
              type="button"
              onClick={onReset}
              className="px-2 py-1 text-caption font-medium text-muted-foreground hover:text-foreground"
            >
              <Trans>Reset</Trans>
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-1.5 text-body font-medium text-foreground hover:bg-accent"
            >
              <Check size={14} />
              <Trans>Done</Trans>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
