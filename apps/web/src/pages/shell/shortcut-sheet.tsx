import { useLingui } from "@lingui/react/macro";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@rakazo/ui-web";
import { isApplePlatform } from "./shell-shortcuts";

export function ShortcutSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLingui();
  const mod = isApplePlatform() ? "⌘" : "Ctrl+";
  const rows = [
    [t`Search`, `${mod}K`],
    [t`New`, `${mod}N`],
    [t`Sidebar`, `${mod}B`],
    [t`Find in chat`, `${mod}F`],
    [t`Next bot`, "⌃Tab"],
    [t`Keyboard shortcuts`, `${mod}/`],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t`Keyboard shortcuts`}</DialogTitle>
        </DialogHeader>
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map(([label, keys]) => (
            <li key={label} className="flex items-center justify-between gap-4">
              <span>{label}</span>
              <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                {keys}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
