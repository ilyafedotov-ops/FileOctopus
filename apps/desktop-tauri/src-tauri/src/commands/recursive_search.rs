use app_ipc::{
    IpcError, RecursiveSearchCompletedEventDto, RecursiveSearchJobResponse,
    RecursiveSearchMatchEventDto, RecursiveSearchRequest, RecursiveSearchResponse,
    RecursiveSearchResultDto, SearchMatchDto, RECURSIVE_SEARCH_COMPLETED_EVENT,
    RECURSIVE_SEARCH_MATCH_EVENT,
};
use chrono::Utc;
use fs_core::search;
use jobs::{
    JobCancelledEvent, JobCompletedEvent, JobEvent, JobFailedEvent, JobStartedEvent, JobStatus,
};
use tauri::{AppHandle, State};
use vfs::{FileOperationError, FileOperationKind, ResourceUri};

use crate::emit::{emit_event, emit_job};
use crate::state::{
    metadata_job_token, set_metadata_job_status, start_metadata_job, update_metadata_job_progress,
    MetadataJobState,
};

#[tauri::command]
pub async fn fs_recursive_search(
    request: RecursiveSearchRequest,
) -> Result<RecursiveSearchResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let result = search::recursive_search(&uri, &request.query, request.limit.unwrap_or(500))
        .map_err(IpcError::from)?;

    Ok(RecursiveSearchResponse {
        result: search_result_to_dto(result),
    })
}

#[tauri::command]
pub async fn fs_recursive_search_start(
    request: RecursiveSearchRequest,
    app: AppHandle,
    metadata_jobs: State<'_, MetadataJobState>,
) -> Result<RecursiveSearchJobResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    if !path.is_dir() {
        return Err(IpcError::from(FileOperationError::DestinationMissing {
            uri: uri.as_str().to_string(),
        }));
    }

    let query = request.query.trim().to_string();
    let limit = request.limit.unwrap_or(500);
    let job = start_metadata_job(&metadata_jobs, FileOperationKind::RecursiveSearch)?;
    let job_id = job.job_id.clone();
    let token = metadata_job_token(&metadata_jobs, job_id.as_str())?;
    let jobs = metadata_jobs.jobs.clone();
    let uri_text = uri.as_str().to_string();

    emit_job(
        &app,
        JobEvent::Started(JobStartedEvent {
            job_id: job_id.clone(),
            operation_kind: FileOperationKind::RecursiveSearch,
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
        let progress_query = query.clone();
        let result =
            search::recursive_search_with_progress(&uri, &query, limit, &token, |item, result| {
                update_metadata_job_progress(
                    &progress_jobs,
                    &progress_app,
                    &thread_job_id,
                    FileOperationKind::RecursiveSearch,
                    item.name.clone(),
                    result.matches.len() as u64,
                    0,
                );
                emit_event(
                    &progress_app,
                    RECURSIVE_SEARCH_MATCH_EVENT,
                    RecursiveSearchMatchEventDto {
                        job_id: thread_job_id.as_str().to_string(),
                        uri: uri_text.clone(),
                        query: progress_query.clone(),
                        item: search_match_to_dto(item.clone()),
                    },
                );
            });

        match result {
            Ok(result) => {
                let dto = search_result_to_dto(result);
                if !set_metadata_job_status(
                    &jobs,
                    thread_job_id.as_str(),
                    JobStatus::Completed,
                    None,
                    None,
                ) {
                    return;
                }
                emit_event(
                    &app,
                    RECURSIVE_SEARCH_COMPLETED_EVENT,
                    RecursiveSearchCompletedEventDto {
                        job_id: thread_job_id.as_str().to_string(),
                        uri: uri_text,
                        query,
                        result: dto.clone(),
                    },
                );
                emit_job(
                    &app,
                    JobEvent::Completed(JobCompletedEvent {
                        job_id: thread_job_id,
                        operation_kind: FileOperationKind::RecursiveSearch,
                        completed_items: dto.matches.len() as u64,
                        completed_bytes: 0,
                        completed_at: Utc::now(),
                    }),
                );
            }
            Err(FileOperationError::Cancelled { .. }) => {
                if !set_metadata_job_status(
                    &jobs,
                    thread_job_id.as_str(),
                    JobStatus::Cancelled,
                    None,
                    None,
                ) {
                    return;
                }
                emit_job(
                    &app,
                    JobEvent::Cancelled(JobCancelledEvent {
                        job_id: thread_job_id,
                        operation_kind: FileOperationKind::RecursiveSearch,
                        cancelled_at: Utc::now(),
                    }),
                );
            }
            Err(error) => {
                let code = error.code().to_string();
                let message = error.user_message();
                if !set_metadata_job_status(
                    &jobs,
                    thread_job_id.as_str(),
                    JobStatus::Failed,
                    Some(code.clone()),
                    Some(message.clone()),
                ) {
                    return;
                }
                emit_job(
                    &app,
                    JobEvent::Failed(JobFailedEvent {
                        job_id: thread_job_id,
                        operation_kind: FileOperationKind::RecursiveSearch,
                        error_code: code,
                        message,
                        failed_at: Utc::now(),
                    }),
                );
            }
        }
    });

    Ok(RecursiveSearchJobResponse { job })
}

pub(crate) fn search_match_to_dto(item: search::SearchMatch) -> SearchMatchDto {
    SearchMatchDto {
        uri: item.uri,
        parent_uri: item.parent_uri,
        name: item.name,
        kind: item.kind,
        size: item.size,
        modified_at: item.modified_at,
    }
}

pub(crate) fn search_result_to_dto(result: search::SearchResult) -> RecursiveSearchResultDto {
    RecursiveSearchResultDto {
        matches: result
            .matches
            .into_iter()
            .map(search_match_to_dto)
            .collect(),
        warnings: result.warnings,
        incomplete: result.incomplete,
    }
}
