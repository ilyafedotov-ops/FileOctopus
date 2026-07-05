use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/PathRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct PathRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/OkResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct OkResponse {
    pub ok: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/PathPropertiesRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct PathPropertiesRequest {
    pub uri: String,
    pub include_folder_summary: Option<bool>,
    pub include_exif: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ExifTagDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ExifTagDto {
    pub group: String,
    pub tag: String,
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ExifMetadataDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ExifMetadataDto {
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub lens_model: Option<String>,
    pub date_taken: Option<String>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub width: Option<u32>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub height: Option<u32>,
    pub orientation: Option<String>,
    pub exposure_time: Option<String>,
    pub f_number: Option<String>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub iso: Option<u32>,
    pub focal_length: Option<String>,
    pub gps_latitude: Option<f64>,
    pub gps_longitude: Option<f64>,
    pub tags: Vec<ExifTagDto>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/PathPropertiesDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct PathPropertiesDto {
    pub uri: String,
    pub name: String,
    pub kind: FileKind,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub size: Option<u64>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub total_size: Option<u64>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub item_count: Option<u64>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub file_count: Option<u64>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub directory_count: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub accessed_at: Option<DateTime<Utc>>,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
    pub readonly: bool,
    pub warnings: Vec<String>,
    pub exif: Option<ExifMetadataDto>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/PathPropertiesResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct PathPropertiesResponse {
    pub properties: PathPropertiesDto,
}
