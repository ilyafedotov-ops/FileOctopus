import type {
  StandardLocationDto,
  FavoriteEntryDto,
  RecentEntryDto,
} from "@fileoctopus/ts-api";
import { localPathFromUri } from "../utils/paneUtils";

export { localPathFromUri };

export interface DestinationChooserProps {
  locations: StandardLocationDto[];
  favorites: FavoriteEntryDto[];
  recent: RecentEntryDto[];
  onSelect: (uri: string) => void;
}

export function DestinationChooser({
  locations,
  favorites,
  recent,
  onSelect,
}: DestinationChooserProps) {
  const hasLocations = locations.length > 0;
  const hasFavorites = favorites.length > 0;
  const hasRecent = recent.length > 0;

  return (
    <div className="fo-destination-chooser">
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
    </div>
  );
}
