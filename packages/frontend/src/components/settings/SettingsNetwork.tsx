export function SettingsNetwork() {
  return (
    <section className="fo-settings-section">
      <h3>Network</h3>
      <div className="fo-settings-field">
        <span>Connection defaults</span>
        <p className="fo-settings-hint">
          Configure default connection settings for SFTP, SMB, S3, and WebDAV
          connections, including auto-reconnect behavior and timeout values.
        </p>
        <p className="fo-settings-hint">
          This feature is coming in a future update.
        </p>
      </div>
    </section>
  );
}
