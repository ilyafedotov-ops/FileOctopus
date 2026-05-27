import { useRef, useState } from "react";
import type {
  AutostartStatusDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { Button, Icons } from "@fileoctopus/ui";
import { useDialogEscape } from "../hooks/useDialogEscape";
import { useFocusTrap } from "../hooks/useFocusTrap";
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
  type SettingsCategory,
} from "./settings";

interface SettingsDialogProps {
  open: boolean;
  preferences: UserPreferencesDto;
  autostart: AutostartStatusDto | null;
  onClose: () => void;
  onChange: (key: string, value: string) => void;
  onSetAutostart: (enabled: boolean) => Promise<void>;
  onCustomizeToolbar?: () => void;
}

export function SettingsDialog({
  open,
  preferences,
  autostart,
  onClose,
  onChange,
  onSetAutostart,
  onCustomizeToolbar,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);

  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>("general");

  if (!open) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-settings-dialog"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div className="fo-dialog-titleblock">
            <span className="fo-dialog-icon" aria-hidden="true">
              {Icons.settings()}
            </span>
            <div>
              <h2 id="settings-title">Settings</h2>
              <p>Configure appearance, behavior, and preferences.</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
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
              <SettingsOperations
                preferences={preferences}
                onChange={onChange}
              />
            )}
            {activeCategory === "terminal" && (
              <SettingsTerminal preferences={preferences} onChange={onChange} />
            )}
            {activeCategory === "keyboard" && (
              <SettingsKeyboard preferences={preferences} onChange={onChange} />
            )}
            {activeCategory === "advanced" && (
              <SettingsAdvanced preferences={preferences} onChange={onChange} />
            )}
            {activeCategory === "network" && (
              <SettingsNetwork preferences={preferences} onChange={onChange} />
            )}
            {activeCategory === "editor" && (
              <SettingsEditor preferences={preferences} onChange={onChange} />
            )}
            {activeCategory === "viewer" && (
              <SettingsViewer preferences={preferences} onChange={onChange} />
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
