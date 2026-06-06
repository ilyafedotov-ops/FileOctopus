use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/FavoriteEntryDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct FavoriteEntryDto {
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub id: u64,
    pub uri: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/RecentEntryDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct RecentEntryDto {
    pub uri: String,
    pub label: String,
    pub visited_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/StarredEntryDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct StarredEntryDto {
    pub uri: String,
    pub label: String,
    pub starred_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NavigationRecordVisitRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NavigationRecordVisitRequest {
    pub uri: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NavigationListFavoritesResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NavigationListFavoritesResponse {
    pub favorites: Vec<FavoriteEntryDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NavigationAddFavoriteRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NavigationAddFavoriteRequest {
    pub uri: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NavigationFavoriteResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NavigationFavoriteResponse {
    pub favorite: FavoriteEntryDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NavigationRemoveFavoriteRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NavigationRemoveFavoriteRequest {
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub id: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NavigationRenameFavoriteRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NavigationRenameFavoriteRequest {
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub id: u64,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NavigationListRecentRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NavigationListRecentRequest {
    pub bucket: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NavigationListRecentResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NavigationListRecentResponse {
    pub entries: Vec<RecentEntryDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NavigationListStarredResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NavigationListStarredResponse {
    pub entries: Vec<StarredEntryDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NavigationToggleStarredRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NavigationToggleStarredRequest {
    pub uri: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NavigationToggleStarredResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NavigationToggleStarredResponse {
    pub starred: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NavigationIsStarredRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NavigationIsStarredRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NavigationRemoveRecentRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NavigationRemoveRecentRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NavigationIsStarredResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NavigationIsStarredResponse {
    pub starred: bool,
}
