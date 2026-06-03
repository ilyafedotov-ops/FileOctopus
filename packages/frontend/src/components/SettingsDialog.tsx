import { useState } from "react";
import type {
  AutostartStatusDto,
  PluginClient,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { Icons } from "@fileoctopus/ui";
import { DialogShell } from "./DialogShell";
import {
  SettingsTree,
  SettingsGeneral,
  SettingsDisplay,
  SettingsColors,
  SettingsLayout,
  SettingsLayoutProfiles,
  SettingsFileList,
  SettingsOperations,
  SettingsTerminal,
  SettingsKeyboard,
  SettingsAdvanced,
  SettingsNetwork,
  SettingsEditor,
  SettingsViewer,
  SettingsPlugins,
  type SettingsCategory,
} from "./settings";
import {
  pickLocalPath as defaultPickLocalPath,
  type LocalPathPicker,
} from "../utils/pathPicker";

interface SettingsDialogProps {
  open: boolean;
  preferences: UserPreferencesDto;
  autostart: AutostartStatusDto | null;
  pluginClient?: PluginClient;
  onClose: () => void;
  onChange: (key: string, value: string) => void;
  onSetAutostart: (enabled: boolean) => Promise<void>;
  onCustomizeToolbar?: () => void;
  pickLocalPath?: LocalPathPicker;
}

export function SettingsDialog({
  open,
  preferences,
  autostart,
  pluginClient,
  onClose,
  onChange,
  onSetAutostart,
  onCustomizeToolbar,
  pickLocalPath = defaultPickLocalPath,
}: SettingsDialogProps) {
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>("general");

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="Settings"
      titleId="settings-title"
      subtitle="Configure appearance, behavior, and preferences."
      icon={Icons.settings()}
      className="fo-settings-dialog"
    >
      <div className="fo-settings-layout">
        <SettingsTree
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />
        <div className="fo-settings-content">
          {activeCategory === "general" && (
            <SettingsGeneral
              preferences={preferences}
              autostart={autostart}
              onChange={onChange}
              onSetAutostart={onSetAutostart}
              pickLocalPath={pickLocalPath}
            />
          )}
          {activeCategory === "display" && (
            <SettingsDisplay preferences={preferences} onChange={onChange} />
          )}
          {activeCategory === "colors" && (
            <SettingsColors preferences={preferences} onChange={onChange} />
          )}
          {activeCategory === "layout" && (
            <SettingsLayout
              preferences={preferences}
              onChange={onChange}
              onCustomizeToolbar={onCustomizeToolbar}
              onClose={onClose}
            />
          )}
          {activeCategory === "layout-profiles" && (
            <SettingsLayoutProfiles
              preferences={preferences}
              onChange={onChange}
            />
          )}
          {activeCategory === "file-list" && (
            <SettingsFileList preferences={preferences} onChange={onChange} />
          )}
          {activeCategory === "operations" && (
            <SettingsOperations preferences={preferences} onChange={onChange} />
          )}
          {activeCategory === "terminal" && (
            <SettingsTerminal
              preferences={preferences}
              onChange={onChange}
              pickLocalPath={pickLocalPath}
            />
          )}
          {activeCategory === "keyboard" && (
            <SettingsKeyboard preferences={preferences} onChange={onChange} />
          )}
          {activeCategory === "advanced" && (
            <SettingsAdvanced preferences={preferences} onChange={onChange} />
          )}
          {activeCategory === "network" && (
            <SettingsNetwork
              preferences={preferences}
              onChange={onChange}
              pickLocalPath={pickLocalPath}
            />
          )}
          {activeCategory === "editor" && (
            <SettingsEditor preferences={preferences} onChange={onChange} />
          )}
          {activeCategory === "viewer" && (
            <SettingsViewer preferences={preferences} onChange={onChange} />
          )}
          {activeCategory === "plugins" && pluginClient && (
            <SettingsPlugins pluginClient={pluginClient} />
          )}
        </div>
      </div>
    </DialogShell>
  );
}
