import type {
  StandardLocationDto,
  FavoriteEntryDto,
  RecentEntryDto,
  NetworkProfileDto,
  FsClient,
} from "@fileoctopus/ts-api";
import { localPathFromUri } from "../utils/paneUtils";
import { networkProfileTitle } from "../navigation/driveTargets";
import { FolderTree } from "./FolderTree";

export { localPathFromUri };

export interface DestinationChooserProps {
  locations: StandardLocationDto[];
  favorites: FavoriteEntryDto[];
  recent: RecentEntryDto[];
  networkProfiles?: NetworkProfileDto[];
  fs?: FsClient;
  onSelect: (uri: string) => void;
}

export function DestinationChooser({
  locations,
  favorites,
  recent,
  networkProfiles = [],
  fs,
  onSelect,
}: DestinationChooserProps) {
  const browseableNetworkProfiles = networkProfiles.filter(
    (profile) =>
      profile.scheme === "sftp" ||
      profile.scheme === "smb" ||
      profile.scheme === "s3",
  );
  const hasLocations = locations.length > 0;
  const hasFavorites = favorites.length > 0;
  const hasRecent = recent.length > 0;
  const hasNetwork = browseableNetworkProfiles.length > 0;

  const homeLocation = locations.find(
    (loc) => loc.id === "home" || loc.name === "Home",
  );
  const hasTree = fs != null && homeLocation != null;

  return (
    <div className="fo-destination-chooser">
      {hasTree ? (
        <div className="fo-destination-section">
          <h4 className="fo-destination-heading">Browse</h4>
          <div className="fo-destination-tree-container">
            <FolderTree
              fs={fs}
              rootUri={homeLocation.uri}
              rootLabel={homeLocation.name}
              onSelect={onSelect}
            />
          </div>
        </div>
      ) : null}
      {hasLocations ? (
        <div className="fo-destination-section">
          <h4 className="fo-destination-heading">Locations</h4>
          <ul className="fo-destination-list">
            {locations.map((loc) => (
              <li key={loc.id}>
                <button
                  type="button"
                  className="fo-destination-item"
                  title={localPathFromUri(loc.uri)}
                  onClick={() => onSelect(loc.uri)}
                >
                  {loc.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasFavorites ? (
        <div className="fo-destination-section">
          <h4 className="fo-destination-heading">Favorites</h4>
          <ul className="fo-destination-list">
            {favorites.map((fav) => (
              <li key={fav.id}>
                <button
                  type="button"
                  className="fo-destination-item"
                  title={localPathFromUri(fav.uri)}
                  onClick={() => onSelect(fav.uri)}
                >
                  {fav.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasRecent ? (
        <div className="fo-destination-section">
          <h4 className="fo-destination-heading">Recent</h4>
          <ul className="fo-destination-list">
            {recent.map((rec) => (
              <li key={rec.uri}>
                <button
                  type="button"
                  className="fo-destination-item"
                  title={localPathFromUri(rec.uri)}
                  onClick={() => onSelect(rec.uri)}
                >
                  {rec.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasNetwork ? (
        <div className="fo-destination-section">
          <h4 className="fo-destination-heading">Network drives</h4>
          <ul className="fo-destination-list">
            {browseableNetworkProfiles.map((profile) => (
              <li key={profile.id}>
                <button
                  type="button"
                  className="fo-destination-item"
                  title={localPathFromUri(profile.defaultUri)}
                  onClick={() => onSelect(profile.defaultUri)}
                >
                  {networkProfileTitle(profile, undefined)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
