use app_ipc::{
    ByteDifferenceDto, CompareFilesRequest, CompareFilesResponse, DiffHunkDto, DiffLineDto,
    IpcError,
};
use fs_core::compare::{self, CompareMode, DiffLineType};

#[tauri::command]
pub async fn fs_compare_files(
    request: CompareFilesRequest,
) -> Result<CompareFilesResponse, IpcError> {
    let left_uri = vfs::ResourceUri::parse(&request.left_uri).map_err(IpcError::from)?;
    let right_uri = vfs::ResourceUri::parse(&request.right_uri).map_err(IpcError::from)?;

    let mode = match request.mode.as_str() {
        "binary" => CompareMode::Binary,
        _ => CompareMode::Text,
    };

    let result = compare::compare_files(&left_uri, &right_uri, mode).map_err(IpcError::from)?;

    Ok(CompareFilesResponse {
        identical: result.identical,
        hunks: result
            .hunks
            .into_iter()
            .map(|h| DiffHunkDto {
                old_start: h.old_start,
                old_count: h.old_count,
                new_start: h.new_start,
                new_count: h.new_count,
                lines: h
                    .lines
                    .into_iter()
                    .map(|l| {
                        let line_type = match l.line_type {
                            DiffLineType::Context => "context",
                            DiffLineType::Added => "added",
                            DiffLineType::Removed => "removed",
                            DiffLineType::Changed => "changed",
                        };
                        DiffLineDto {
                            line_number_left: l.line_number_left,
                            line_number_right: l.line_number_right,
                            content: l.content,
                            line_type: line_type.to_string(),
                        }
                    })
                    .collect(),
            })
            .collect(),
        byte_differences: result
            .byte_differences
            .into_iter()
            .map(|d| ByteDifferenceDto {
                offset: d.offset,
                left_byte: d.left_byte,
                right_byte: d.right_byte,
            })
            .collect(),
    })
}
