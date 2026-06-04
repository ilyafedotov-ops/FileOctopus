use std::path::Path;

use vfs::FileOperationError;

pub(super) fn move_to_trash(path: &Path) -> Result<(), FileOperationError> {
    trash::delete(path).map_err(|error| FileOperationError::UnsupportedTrash {
        message: format!("failed to move item to Trash: {error}"),
    })
}
