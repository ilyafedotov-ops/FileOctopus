use app_ipc::{
    FolderSizeCompletedEventDto, FolderSizeJobResponse, FolderSizeRequest, FolderSizeResponse,
    FolderSizeSummaryDto, IpcError, FOLDER_SIZE_COMPLETED_EVENT,
};
use chrono::Utc;
use fs_core::sprint4;
use jobs::{
    JobCancelledEvent, JobCompletedEvent, JobEvent, JobFailedEvent, JobStartedEvent, JobStatus,
};
use tauri::{AppHandle, State};
use vfs::{FileOperationError, FileOperationKind, ResourceUri};

use crate::emit::{emit_job, emit_with_eval};
use crate::state::{
    metadata_job_token, set_metadata_job_status, start_metadata_job, update_metadata_job_progress,
    MetadataJobState,
};

#[tauri::command]
pub async fn fs_folder_size(request: FolderSizeRequest) -> Result<FolderSizeResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let summary = sprint4::calculate_folder_size(&uri).map_err(IpcError::from)?;

    Ok(FolderSizeResponse {
        summary: folder_summary_to_dto(summary),
    })
}

#[tauri::command]
pub async fn fs_folder_size_start(
    request: FolderSizeRequest,
    app: AppHandle,
    metadata_jobs: State<'_, MetadataJobState>,
) -> Result<FolderSizeJobResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    if !path.exists() {
        return Err(IpcError::from(FileOperationError::NotFound {
            uri: uri.as_str().to_string(),
        }));
    }

    let job = start_metadata_job(&metadata_jobs, FileOperationKind::FolderSize)?;
    let job_id = job.job_id.clone();
    let token = metadata_job_token(&metadata_jobs, job_id.as_str())?;
    let jobs = metadata_jobs.jobs.clone();
    let uri_text = uri.as_str().to_string();

    emit_job(
        &app,
        JobEvent::Started(JobStartedEvent {
            job_id: job_id.clone(),
            operation_kind: FileOperationKind::FolderSize,
            total_items: 0,
            total_bytes: None,
            started_at: job.started_at,
        }),
    );
    set_metadata_job_status(&jobs, job_id.as_str(), JobStatus::Running, None, None);

    std::thread::spawn(move || {
        let thread_job_id = job_id.clone();
        let progress_app = app.clone();
        let progress_jobs = jobs.clone();
        let result = sprint4::calculate_folder_size_with_progress(&uri, &token, |summary, path| {
            update_metadata_job_progress(
                &progress_jobs,
                &progress_app,
                &thread_job_id,
                FileOperationKind::FolderSize,
                path.to_string_lossy().to_string(),
                summary.item_count,
                summary.total_size,
            );
        });

        match result {
            Ok(summary) => {
                let dto = folder_summary_to_dto(summary);
                set_metadata_job_status(
                    &jobs,
                    thread_job_id.as_str(),
                    JobStatus::Completed,
                    None,
                    None,
                );
                let completed_at = Utc::now();
                emit_with_eval(
                    &app,
                    FOLDER_SIZE_COMPLETED_EVENT,
                    FolderSizeCompletedEventDto {
                        job_id: thread_job_id.as_str().to_string(),
                        uri: uri_text,
                        summary: dto.clone(),
                    },
                );
                emit_job(
                    &app,
                    JobEvent::Completed(JobCompletedEvent {
                        job_id: thread_job_id,
                        operation_kind: FileOperationKind::FolderSize,
                        completed_items: dto.item_count,
                        completed_bytes: dto.total_size,
                        completed_at,
                    }),
                );
            }
            Err(FileOperationError::Cancelled { .. }) => {
                set_metadata_job_status(
                    &jobs,
                    thread_job_id.as_str(),
                    JobStatus::Cancelled,
                    None,
                    None,
                );
                emit_job(
                    &app,
                    JobEvent::Cancelled(JobCancelledEvent {
                        job_id: thread_job_id,
                        operation_kind: FileOperationKind::FolderSize,
                        cancelled_at: Utc::now(),
                    }),
                );
            }
            Err(error) => {
                let code = error.code().to_string();
                let message = error.user_message();
                set_metadata_job_status(
                    &jobs,
                    thread_job_id.as_str(),
                    JobStatus::Failed,
                    Some(code.clone()),
                    Some(message.clone()),
                );
                emit_job(
                    &app,
                    JobEvent::Failed(JobFailedEvent {
                        job_id: thread_job_id,
                        operation_kind: FileOperationKind::FolderSize,
                        error_code: code,
                        message,
                        failed_at: Utc::now(),
                    }),
                );
            }
        }
    });

    Ok(FolderSizeJobResponse { job })
}

pub(crate) fn folder_summary_to_dto(summary: sprint4::FolderSizeSummary) -> FolderSizeSummaryDto {
    FolderSizeSummaryDto {
        total_size: summary.total_size,
        item_count: summary.item_count,
        file_count: summary.file_count,
        directory_count: summary.directory_count,
        warnings: summary.warnings,
        incomplete: summary.incomplete,
    }
}
