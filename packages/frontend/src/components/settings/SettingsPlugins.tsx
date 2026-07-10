import { useEffect, useState, useCallback } from "react";
import type { PluginClient, InstalledPluginDto } from "@fileoctopus/ts-api";

interface SettingsPluginsProps {
  pluginClient: PluginClient;
}

export function SettingsPlugins({ pluginClient }: SettingsPluginsProps) {
  const [plugins, setPlugins] = useState<InstalledPluginDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await pluginClient.list();
      setPlugins(response.plugins);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plugins");
    } finally {
      setLoading(false);
    }
  }, [pluginClient]);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  const handleUninstall = async (pluginId: string) => {
    try {
      await pluginClient.uninstall({ pluginId });
      await loadPlugins();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to uninstall plugin");
    }
  };

  const handleToggle = async (pluginId: string, enabled: boolean) => {
    try {
      await pluginClient.toggle({ pluginId, enabled });
      await loadPlugins();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to toggle plugin");
    }
  };

  return (
    <section
      className="fo-settings-section"
      role="region"
      aria-label="Plugins settings"
    >
      <h3>Plugins</h3>
      <p className="fo-settings-description">
        Manage installed plugins and their permissions.
      </p>
      <div className="fo-settings-plugins">
        {loading && <div className="fo-plugin-loading">Loading plugins…</div>}
        {error && (
          <div className="fo-plugin-error" role="alert">
            {error}
          </div>
        )}

        {!loading && plugins.length === 0 && (
          <div className="fo-plugin-empty">
            <p>No plugins installed</p>
            <p className="fo-plugin-empty-hint">
              Plugin installation is disabled until signed Wasm packages are
              supported.
            </p>
          </div>
        )}

        {!loading && plugins.length > 0 && (
          <div className="fo-plugin-list">
            {plugins.map((plugin) => (
              <div key={plugin.manifest.id} className="fo-plugin-card">
                <div className="fo-plugin-card-header">
                  <span className="fo-plugin-name">{plugin.manifest.name}</span>
                  <span className="fo-plugin-version">
                    {plugin.manifest.version}
                  </span>
                </div>
                <div className="fo-plugin-description">
                  {plugin.manifest.description}
                </div>
                <div className="fo-plugin-meta">
                  <span className="fo-plugin-author">
                    by {plugin.manifest.author}
                  </span>
                  {plugin.enabled ? (
                    <span className="fo-plugin-status fo-plugin-status-enabled">
                      Enabled
                    </span>
                  ) : (
                    <span className="fo-plugin-status fo-plugin-status-disabled">
                      Disabled
                    </span>
                  )}
                </div>
                {plugin.manifest.permissions.length > 0 && (
                  <div className="fo-plugin-permissions">
                    {plugin.manifest.permissions.map((p) => (
                      <span key={p} className="fo-plugin-permission-tag">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
                <div className="fo-plugin-actions">
                  <button
                    type="button"
                    className="fo-ui-btn fo-ui-btn--sm"
                    aria-label={plugin.enabled ? "Disable" : "Enable"}
                    onClick={() =>
                      handleToggle(plugin.manifest.id, !plugin.enabled)
                    }
                  >
                    {plugin.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className="fo-ui-btn fo-ui-btn--sm fo-ui-btn--danger"
                    aria-label="Uninstall"
                    onClick={() => handleUninstall(plugin.manifest.id)}
                  >
                    Uninstall
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
