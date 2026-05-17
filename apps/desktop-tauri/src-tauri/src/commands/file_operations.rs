use std::sync::Arc;

use app_core::{AppState, OperationHistoryRecord};
use app_ipc::{
    job_event_name, job_event_payload, CancelJobRequest, ClearOperationHistoryResponse, IpcError,
    JobStatusRequest, JobStatusResponse, ListRecentOperationsRequest, ListRecentOperationsResponse,
    OperationHistoryRecordDto, PlanFileOperationRequest, PlanFileOperationResponse,
    StartFileOperationRequest, StartFileOperationResponse,
};
use jobs::JobEvent;
use tauri::{AppHandle, State};

use crate::emit::emit_with_eval;
use crate::state::{cancel_metadata_job, metadata_job_snapshot, MetadataJobState};

#[tauri::command]
pub async fn plan_file_operation(
    request: PlanFileOperationRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<PlanFileOperationResponse, IpcError> {
    telemetry::debug("plan_file_operation requested");

    let operation = request.operation.try_into()?;
    let plan = state.operations().plan(operation).map_err(IpcError::from)?;

    Ok(PlanFileOperationResponse { plan: plan.into() })
}

#[tauri::command]
pub async fn start_file_operation(
    request: StartFileOperationRequest,
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<StartFileOperationResponse, IpcError> {
    telemetry::debug("start_file_operation requested");

    let sink_app = app.clone();
    let sink = Arc::new(move |event: JobEvent| {
        let name = job_event_name(&event);
        let payload = job_event_payload(event);
        emit_with_eval(&sink_app, name, payload);
    });
    let job = state
        .operations()
        .start_planned(&request.operation_id, sink)
        .map_err(IpcError::from)?;

    Ok(StartFileOperationResponse { job })
}

#[tauri::command]
pub async fn cancel_job(
    request: CancelJobRequest,
    metadata_jobs: State<'_, MetadataJobState>,
    state: State<'_, Arc<AppState>>,
) -> Result<JobStatusResponse, IpcError> {
    if let Some(job) = cancel_metadata_job(&metadata_jobs, &request.job_id)? {
        return Ok(JobStatusResponse { job });
    }

    let job = state
        .operations()
        .cancel(&request.job_id)
        .map_err(IpcError::from)?;

    Ok(JobStatusResponse { job })
}

#[tauri::command]
pub async fn get_job_status(
    request: JobStatusRequest,
    metadata_jobs: State<'_, MetadataJobState>,
    state: State<'_, Arc<AppState>>,
) -> Result<JobStatusResponse, IpcError> {
    if let Some(job) = metadata_job_snapshot(&metadata_jobs, &request.job_id)? {
        return Ok(JobStatusResponse { job });
    }

    let job = state
        .operations()
        .status(&request.job_id)
        .map_err(IpcError::from)?;

    Ok(JobStatusResponse { job })
}

#[tauri::command]
pub async fn list_recent_operations(
    request: ListRecentOperationsRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<ListRecentOperationsResponse, IpcError> {
    let operations = state
        .operations()
        .recent_history(request.limit.unwrap_or(20))
        .into_iter()
        .map(operation_history_record_to_dto)
        .collect();

    Ok(ListRecentOperationsResponse { operations })
}

#[tauri::command]
pub async fn clear_operation_history(
    state: State<'_, Arc<AppState>>,
) -> Result<ClearOperationHistoryResponse, IpcError> {
    let deleted_count = state
        .operations()
        .clear_terminal_history()
        .map_err(|error| IpcError::internal(&error))?;

    Ok(ClearOperationHistoryResponse { deleted_count })
}

pub(crate) fn operation_history_record_to_dto(
    record: OperationHistoryRecord,
) -> OperationHistoryRecordDto {
    OperationHistoryRecordDto {
        job_id: record.job_id,
        operation_kind: record.operation_kind,
        source_count: record.source_count,
        representative_source_path: record.representative_source_path,
        destination_path: record.destination_path,
        status: record.status,
        started_at: record.started_at,
        completed_at: record.completed_at,
        error_code: record.error_code,
    }
}
