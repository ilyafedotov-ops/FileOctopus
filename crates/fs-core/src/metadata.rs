use std::collections::HashSet;
use std::fs::{self, File};
use std::io::BufReader;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use exif::{Tag, Value};
use jobs::CancellationToken;
use vfs::{FileKind, FileOperationError, ResourceUri};

#[derive(Debug, Clone, PartialEq)]
pub struct PathProperties {
    pub uri: String,
    pub name: String,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub total_size: Option<u64>,
    pub item_count: Option<u64>,
    pub file_count: Option<u64>,
    pub directory_count: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub accessed_at: Option<DateTime<Utc>>,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
    pub readonly: bool,
    pub warnings: Vec<String>,
    pub exif: Option<ExifMetadata>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExifMetadata {
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub lens_model: Option<String>,
    pub date_taken: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub orientation: Option<String>,
    pub exposure_time: Option<String>,
    pub f_number: Option<String>,
    pub iso: Option<u32>,
    pub focal_length: Option<String>,
    pub gps_latitude: Option<f64>,
    pub gps_longitude: Option<f64>,
    pub tags: Vec<ExifTag>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExifTag {
    pub group: String,
    pub tag: String,
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FolderSizeSummary {
    pub total_size: u64,
    pub item_count: u64,
    pub file_count: u64,
    pub directory_count: u64,
    pub warnings: Vec<String>,
    pub incomplete: bool,
}

pub fn path_properties(
    uri: &ResourceUri,
    include_folder_summary: bool,
    include_exif: bool,
) -> Result<PathProperties, FileOperationError> {
    let path = uri.to_local_path()?;
    let metadata = fs::symlink_metadata(&path).map_err(|error| map_io_error(uri, error))?;
    let kind = file_kind(&metadata);
    let summary = if include_folder_summary && metadata.is_dir() {
        Some(calculate_folder_size(uri)?)
    } else {
        None
    };

    Ok(PathProperties {
        uri: uri.as_str().to_string(),
        name: display_name(&path, uri),
        kind,
        size: metadata.is_file().then_some(metadata.len()),
        total_size: summary.as_ref().map(|value| value.total_size),
        item_count: summary.as_ref().map(|value| value.item_count),
        file_count: summary.as_ref().map(|value| value.file_count),
        directory_count: summary.as_ref().map(|value| value.directory_count),
        modified_at: metadata.modified().ok().map(DateTime::<Utc>::from),
        created_at: metadata.created().ok().map(DateTime::<Utc>::from),
        accessed_at: metadata.accessed().ok().map(DateTime::<Utc>::from),
        is_hidden: is_hidden(&path),
        is_symlink: metadata.file_type().is_symlink(),
        symlink_target: fs::read_link(&path)
            .ok()
            .and_then(|target| absolute_symlink_target(&path, target))
            .and_then(|target| ResourceUri::from_local_path(&target).ok())
            .map(|target| target.as_str().to_string()),
        readonly: metadata.permissions().readonly(),
        warnings: summary.map(|value| value.warnings).unwrap_or_default(),
        exif: if include_exif && metadata.is_file() {
            extract_exif_metadata(&path)
        } else {
            None
        },
    })
}

fn extract_exif_metadata(path: &Path) -> Option<ExifMetadata> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let exif = exif::Reader::new().read_from_container(&mut reader).ok()?;
    let tags = exif
        .fields()
        .map(|field| ExifTag {
            group: format!("{:?}", field.ifd_num),
            tag: field.tag.to_string(),
            label: field.tag.to_string(),
            value: field.display_value().with_unit(&exif).to_string(),
        })
        .collect::<Vec<_>>();

    Some(ExifMetadata {
        camera_make: string_tag(&exif, Tag::Make),
        camera_model: string_tag(&exif, Tag::Model),
        lens_model: string_tag(&exif, Tag::LensModel),
        date_taken: string_tag(&exif, Tag::DateTimeOriginal)
            .or_else(|| string_tag(&exif, Tag::DateTime)),
        width: u32_tag(&exif, Tag::PixelXDimension).or_else(|| u32_tag(&exif, Tag::ImageWidth)),
        height: u32_tag(&exif, Tag::PixelYDimension).or_else(|| u32_tag(&exif, Tag::ImageLength)),
        orientation: display_tag(&exif, Tag::Orientation),
        exposure_time: display_tag(&exif, Tag::ExposureTime),
        f_number: display_tag(&exif, Tag::FNumber),
        iso: u32_tag(&exif, Tag::PhotographicSensitivity),
        focal_length: display_tag(&exif, Tag::FocalLength),
        gps_latitude: gps_coordinate(&exif, Tag::GPSLatitude, Tag::GPSLatitudeRef),
        gps_longitude: gps_coordinate(&exif, Tag::GPSLongitude, Tag::GPSLongitudeRef),
        tags,
        warnings: Vec::new(),
    })
}

fn field(exif: &exif::Exif, tag: Tag) -> Option<&exif::Field> {
    exif.fields().find(|field| field.tag == tag)
}

fn string_tag(exif: &exif::Exif, tag: Tag) -> Option<String> {
    let field = field(exif, tag)?;
    match &field.value {
        Value::Ascii(values) => values
            .first()
            .map(|value| {
                String::from_utf8_lossy(value)
                    .trim_matches('\0')
                    .trim()
                    .to_string()
            })
            .filter(|value| !value.is_empty()),
        _ => Some(field.display_value().with_unit(exif).to_string())
            .filter(|value| !value.is_empty()),
    }
}

fn display_tag(exif: &exif::Exif, tag: Tag) -> Option<String> {
    field(exif, tag)
        .map(|field| field.display_value().with_unit(exif).to_string())
        .filter(|value| !value.is_empty())
}

fn u32_tag(exif: &exif::Exif, tag: Tag) -> Option<u32> {
    let field = field(exif, tag)?;
    match &field.value {
        Value::Short(values) => values.first().map(|value| *value as u32),
        Value::Long(values) => values.first().copied(),
        Value::Rational(values) => values
            .first()
            .and_then(|value| value.num.checked_div(value.denom)),
        _ => field
            .display_value()
            .with_unit(exif)
            .to_string()
            .parse()
            .ok(),
    }
}

fn gps_coordinate(exif: &exif::Exif, value_tag: Tag, reference_tag: Tag) -> Option<f64> {
    let value = field(exif, value_tag)?;
    let components = match &value.value {
        Value::Rational(values) if values.len() >= 3 => values,
        _ => return None,
    };
    let to_f64 = |value: &exif::Rational| {
        if value.denom == 0 {
            None
        } else {
            Some(value.num as f64 / value.denom as f64)
        }
    };
    let mut coordinate =
        to_f64(&components[0])? + to_f64(&components[1])? / 60.0 + to_f64(&components[2])? / 3600.0;
    let reference = string_tag(exif, reference_tag).unwrap_or_default();
    if reference.eq_ignore_ascii_case("S") || reference.eq_ignore_ascii_case("W") {
        coordinate = -coordinate;
    }
    Some(coordinate)
}

pub fn calculate_folder_size(uri: &ResourceUri) -> Result<FolderSizeSummary, FileOperationError> {
    calculate_folder_size_with_progress(uri, &CancellationToken::new(), |_, _| {})
}

pub fn calculate_folder_size_with_progress(
    uri: &ResourceUri,
    cancel: &CancellationToken,
    mut progress: impl FnMut(&FolderSizeSummary, &Path),
) -> Result<FolderSizeSummary, FileOperationError> {
    let path = uri.to_local_path()?;

    if !path.is_dir() {
        if cancel.is_cancelled() {
            return Err(FileOperationError::Cancelled { job_id: None });
        }

        let metadata = fs::symlink_metadata(&path).map_err(|error| map_io_error(uri, error))?;

        return Ok(FolderSizeSummary {
            total_size: if metadata.is_file() {
                metadata.len()
            } else {
                0
            },
            item_count: 1,
            file_count: u64::from(metadata.is_file()),
            directory_count: u64::from(metadata.is_dir()),
            warnings: Vec::new(),
            incomplete: false,
        });
    }

    let mut summary = FolderSizeSummary {
        total_size: 0,
        item_count: 0,
        file_count: 0,
        directory_count: 0,
        warnings: Vec::new(),
        incomplete: false,
    };
    let mut visited = HashSet::new();

    visit_folder(&path, &mut visited, &mut summary, cancel, &mut progress)?;

    Ok(summary)
}

fn visit_folder(
    path: &Path,
    visited: &mut HashSet<PathBuf>,
    summary: &mut FolderSizeSummary,
    cancel: &CancellationToken,
    progress: &mut impl FnMut(&FolderSizeSummary, &Path),
) -> Result<(), FileOperationError> {
    if cancel.is_cancelled() {
        return Err(FileOperationError::Cancelled { job_id: None });
    }

    let canonical = match path.canonicalize() {
        Ok(value) => value,
        Err(error) => {
            summary.incomplete = true;
            summary.warnings.push(error.to_string());
            return Ok(());
        }
    };

    if !visited.insert(canonical) {
        return Ok(());
    }

    let read_dir = match fs::read_dir(path) {
        Ok(value) => value,
        Err(error) => {
            summary.incomplete = true;
            summary.warnings.push(error.to_string());
            return Ok(());
        }
    };

    for entry in read_dir {
        if cancel.is_cancelled() {
            return Err(FileOperationError::Cancelled { job_id: None });
        }

        let entry = match entry {
            Ok(value) => value,
            Err(error) => {
                summary.incomplete = true;
                summary.warnings.push(error.to_string());
                continue;
            }
        };
        let entry_path = entry.path();
        let metadata = match fs::symlink_metadata(&entry_path) {
            Ok(value) => value,
            Err(error) => {
                summary.incomplete = true;
                summary.warnings.push(error.to_string());
                continue;
            }
        };

        if metadata.file_type().is_symlink() {
            continue;
        }

        summary.item_count += 1;

        if metadata.is_dir() {
            summary.directory_count += 1;
            progress(summary, &entry_path);
            visit_folder(&entry_path, visited, summary, cancel, progress)?;
        } else if metadata.is_file() {
            summary.file_count += 1;
            summary.total_size += metadata.len();
            progress(summary, &entry_path);
        }
    }

    Ok(())
}

pub(crate) fn file_kind(metadata: &fs::Metadata) -> FileKind {
    if metadata.file_type().is_symlink() {
        FileKind::Symlink
    } else if metadata.is_dir() {
        FileKind::Directory
    } else if metadata.is_file() {
        FileKind::File
    } else {
        FileKind::Unknown
    }
}

pub(crate) fn display_name(path: &Path, uri: &ResourceUri) -> String {
    path.file_name()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| uri.display_path())
}

pub(crate) fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .map(|value| value.to_string_lossy().starts_with('.'))
        .unwrap_or(false)
}

pub(crate) fn absolute_symlink_target(path: &Path, target: PathBuf) -> Option<PathBuf> {
    if target.is_absolute() {
        return Some(target);
    }

    path.parent().map(|parent| parent.join(target))
}

fn map_io_error(uri: &ResourceUri, error: std::io::Error) -> FileOperationError {
    match error.kind() {
        std::io::ErrorKind::NotFound => FileOperationError::NotFound {
            uri: uri.as_str().to_string(),
        },
        std::io::ErrorKind::PermissionDenied => FileOperationError::PermissionDenied {
            uri: uri.as_str().to_string(),
        },
        std::io::ErrorKind::TimedOut => crate::placeholder::classify_timed_out_uri(uri, &error),
        _ => FileOperationError::io(error.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn path_properties_extracts_basic_exif_when_requested() {
        let dir = tempdir().unwrap();
        let image = dir.path().join("photo.jpg");
        std::fs::write(&image, minimal_exif_jpeg()).unwrap();
        let uri = ResourceUri::from_local_path(&image).unwrap();

        let properties = path_properties(&uri, false, true).unwrap();
        let exif = properties.exif.expect("EXIF metadata should be present");

        assert_eq!(exif.camera_make.as_deref(), Some("Canon"));
        assert_eq!(exif.camera_model.as_deref(), Some("EOS R5"));
        assert!(exif.tags.iter().any(|tag| tag.tag == "Make"));
    }

    fn minimal_exif_jpeg() -> Vec<u8> {
        let mut tiff = Vec::new();
        tiff.extend_from_slice(b"II");
        tiff.extend_from_slice(&42_u16.to_le_bytes());
        tiff.extend_from_slice(&8_u32.to_le_bytes());
        tiff.extend_from_slice(&2_u16.to_le_bytes());
        tiff.extend_from_slice(&0x010f_u16.to_le_bytes());
        tiff.extend_from_slice(&2_u16.to_le_bytes());
        tiff.extend_from_slice(&6_u32.to_le_bytes());
        tiff.extend_from_slice(&38_u32.to_le_bytes());
        tiff.extend_from_slice(&0x0110_u16.to_le_bytes());
        tiff.extend_from_slice(&2_u16.to_le_bytes());
        tiff.extend_from_slice(&7_u32.to_le_bytes());
        tiff.extend_from_slice(&44_u32.to_le_bytes());
        tiff.extend_from_slice(&0_u32.to_le_bytes());
        tiff.extend_from_slice(b"Canon\0");
        tiff.extend_from_slice(b"EOS R5\0");

        let mut app1 = Vec::new();
        app1.extend_from_slice(b"Exif\0\0");
        app1.extend_from_slice(&tiff);

        let mut jpeg = vec![0xff, 0xd8, 0xff, 0xe1];
        jpeg.extend_from_slice(&(app1.len() as u16 + 2).to_be_bytes());
        jpeg.extend_from_slice(&app1);
        jpeg.extend_from_slice(&[0xff, 0xd9]);
        jpeg
    }
}
