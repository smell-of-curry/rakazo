import { Trans, useLingui } from "@lingui/react/macro";
import type { NavLink } from "@rakazo/contracts";
import { ANDROID_APP_STORE_URL, IOS_APP_STORE_URL } from "@rakazo/contracts";
import { Button, buttonVariants, Popover, PopoverContent, PopoverTrigger } from "@rakazo/ui-web";
import {
  BookOpen,
  Check,
  Download,
  FolderOpen,
  Grid2x2Plus,
  Link2,
  LogOut,
  Plug,
  ScrollText,
  Settings,
  Smartphone,
  SquareKanban,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import type { Organization } from "../lib/organizations";
import { useSidebarUpdate } from "./DesktopUpdates";
import { IconTooltip } from "./IconTooltip";

type Props = {
  mini?: boolean;
  name: string;
  initials: string | null;
  image?: string | null;
  email?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIntegrations: () => void;
  onSkills: () => void;
  onBoard?: () => void;
  links?: NavLink[];
  onLink?: (link: NavLink) => void;
  onArtifacts: () => void;
  onSettings: () => void;
  onInvite?: () => void;
  onLogOut: () => void;
  signingOut: boolean;
  logOutError: string | null;
  organizations?: Organization[];
  activeOrganizationId?: string | null;
  onSwitchOrganization?: (organization: Organization) => void;
};

export function SidebarFooter({
  mini = false,
  name,
  initials,
  image,
  email,
  open,
  onOpenChange,
  onIntegrations,
  onSkills,
  onBoard,
  links = [],
  onLink,
  onArtifacts,
  onSettings,
  onInvite,
  onLogOut,
  signingOut,
  logOutError,
  organizations = [],
  activeOrganizationId,
  onSwitchOrganization,
}: Props) {
  const { t } = useLingui();
  const update = useSidebarUpdate();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return (
    <div
      data-testid="sidebar-footer"
      className={`flex shrink-0 items-center gap-2 bg-transparent ${mini ? "flex-col px-1 py-2" : "px-2.5 py-3"}`}
    >
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger
          data-testid="user-menu-trigger"
          aria-label={t`Account menu for ${name}`}
          className={`flex min-w-0 items-center rounded-xl text-start outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring ${
            mini ? "size-9 justify-center" : "h-11 flex-1 gap-2.5 px-1.5"
          }`}
        >
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-sidebar-accent text-sm font-medium text-foreground">
            {image && failedImage !== image ? (
              <img
                src={image}
                alt=""
                className="size-full object-cover"
                onError={() => setFailedImage(image)}
              />
            ) : initials ? (
              initials
            ) : (
              <UserRound size={18} aria-hidden="true" />
            )}
          </span>
          {mini ? null : (
            <span dir="auto" className="min-w-0 truncate text-sm text-foreground">
              {name}
            </span>
          )}
        </PopoverTrigger>
        {open ? (
          <PopoverContent
            side="top"
            sideOffset={8}
            align="start"
            className="max-h-(--available-height) w-[295px] max-w-[calc(100vw-69px)] gap-0 overflow-y-auto p-1 *:shrink-0 data-closed:animate-none"
          >
            <div
              data-testid="account-menu-header"
              className="mb-1 min-w-0 border-b border-border px-2.5 py-2.5"
            >
              <p className="truncate text-body font-medium">{name}</p>
              {email && email !== name ? (
                <p className="truncate text-label text-muted-foreground">{email}</p>
              ) : null}
            </div>
            {organizations.length > 1 ? (
              <>
                {organizations.map((organization) => {
                  const active = organization.id === activeOrganizationId;
                  return (
                    <Button
                      key={organization.id}
                      variant="ghost"
                      aria-current={active ? "true" : undefined}
                      className="h-9 w-full justify-between gap-2.5 font-normal"
                      onClick={() => onSwitchOrganization?.(organization)}
                    >
                      <span className="min-w-0 truncate">{organization.name}</span>
                      {active ? <Check aria-hidden="true" strokeWidth={1.75} /> : null}
                    </Button>
                  );
                })}
                <div className="my-1 border-t border-border" />
              </>
            ) : null}
            {mini ? (
              <Button
                variant="ghost"
                className="h-9 w-full justify-start gap-2.5 font-normal"
                onClick={onIntegrations}
              >
                <Plug className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>Connect apps</Trans>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="h-9 w-full justify-start gap-2.5 font-normal"
              aria-label={t`Settings`}
              onClick={onSettings}
            >
              <Settings className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Settings</Trans>
            </Button>
            <Button
              variant="ghost"
              className="h-9 w-full justify-start gap-2.5 font-normal"
              onClick={onSkills}
            >
              <ScrollText className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Skills</Trans>
            </Button>
            <Button
              variant="ghost"
              className="h-9 w-full justify-start gap-2.5 font-normal"
              onClick={onArtifacts}
            >
              <FolderOpen className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Artifacts</Trans>
            </Button>
            {onBoard ? (
              <Button
                variant="ghost"
                className="h-9 w-full justify-start gap-2.5 font-normal"
                onClick={onBoard}
              >
                <SquareKanban className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>Board</Trans>
              </Button>
            ) : null}
            {links.map((link) => (
              <Button
                key={link.id}
                variant="ghost"
                className="h-9 w-full justify-start gap-2.5 font-normal"
                onClick={() => onLink?.(link)}
              >
                <Link2 className="text-muted-foreground" strokeWidth={1.75} />
                {link.label}
              </Button>
            ))}
            <div className="my-1 border-t border-border" />
            <a
              className={`${buttonVariants({ variant: "ghost" })} h-9 w-full justify-start gap-2.5 font-normal`}
              href={
                /Android/i.test(navigator.userAgent) ? ANDROID_APP_STORE_URL : IOS_APP_STORE_URL
              }
              target="_blank"
              rel="noreferrer"
            >
              <Smartphone className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Get the mobile app</Trans>
            </a>
            {onInvite ? (
              <Button
                variant="ghost"
                className="h-9 w-full justify-start gap-2.5 font-normal"
                onClick={onInvite}
              >
                <UserPlus className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>Invite friends</Trans>
              </Button>
            ) : null}
            <a
              className={`${buttonVariants({ variant: "ghost" })} h-9 w-full justify-start gap-2.5 font-normal`}
              href="https://github.com/elie222/rakazo/blob/main/docs/self-host.md"
              target="_blank"
              rel="noreferrer"
            >
              <BookOpen className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Docs</Trans>
            </a>
            <div className="my-1 border-t border-border" />
            <Button
              variant="ghost"
              className="h-9 w-full justify-start gap-2.5 font-normal"
              disabled={signingOut}
              onClick={onLogOut}
            >
              <LogOut className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Log out</Trans>
            </Button>
            {logOutError ? (
              <p role="alert" className="px-2.5 pt-1 pb-2 text-body-sm text-destructive">
                {logOutError}
              </p>
            ) : null}
          </PopoverContent>
        ) : null}
      </Popover>
      {!mini ? (
        <Button
          variant="outline"
          size="icon"
          aria-label={t`Connect apps`}
          onClick={onIntegrations}
          className="size-9 shrink-0 rounded-full border-border bg-card hover:bg-accent"
        >
          <Grid2x2Plus size={16} strokeWidth={1.75} aria-hidden="true" />
        </Button>
      ) : null}
      {update.available ? (
        <IconTooltip label={t`Install update`}>
          <Button
            size="icon-lg"
            className="rounded-full"
            aria-label={t`Install update`}
            disabled={update.busy}
            onClick={update.install}
          >
            <Download aria-hidden="true" />
          </Button>
        </IconTooltip>
      ) : null}
    </div>
  );
}
