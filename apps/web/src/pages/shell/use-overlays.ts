import type { SpaceMemoryConfig, VoiceStatus } from "@rakazo/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import type { SettingsSection } from "../SettingsOverlay";
import { isCommandPaletteHotkey } from "./command-palette";

export function useOverlays(userId: string | undefined) {
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");
  const [messagingSettingsOpen, setMessagingSettingsOpen] = useState(false);
  const [messagingSurfaceEnabled, setMessagingSurfaceEnabled] = useState(false);
  const [messagingProviders, setMessagingProviders] = useState<string[]>([]);
  const [memoryProviderConfig, setMemoryProviderConfig] = useState<
    SpaceMemoryConfig | null | undefined
  >(undefined);
  const memoryProviderConfigRevision = useRef(0);
  const [callOpen, setCallOpen] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [peerConversation, setPeerConversation] = useState<{
    peerBotId: string;
    peerBotName: string;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void rpc.messaging
      .status()
      .then((status) => {
        if (!cancelled) {
          setMessagingSurfaceEnabled(status.enabled);
          setMessagingProviders(status.providers);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!isCommandPaletteHotkey(event)) return;
      event.preventDefault();
      setCommandPaletteOpen((open) => !open);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openSettings = useCallback((section: SettingsSection = "general") => {
    setSettingsSection(section);
    setSettingsOpen(true);
  }, []);

  return {
    pluginsOpen,
    setPluginsOpen,
    settingsOpen,
    setSettingsOpen,
    settingsSection,
    setSettingsSection,
    messagingSettingsOpen,
    setMessagingSettingsOpen,
    messagingSurfaceEnabled,
    messagingProviders,
    memoryProviderConfig,
    setMemoryProviderConfig,
    memoryProviderConfigRevision,
    callOpen,
    setCallOpen,
    voiceStatus,
    setVoiceStatus,
    commandPaletteOpen,
    setCommandPaletteOpen,
    peerConversation,
    setPeerConversation,
    openSettings,
  };
}
