use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::task::JoinHandle;

type Responder = dyn Fn(&MockRequest, usize) -> MockResponse + Send + Sync;

#[derive(Clone, Debug)]
pub struct MockRequest {
    pub method: String,
    pub path: String,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
}

#[derive(Clone, Debug)]
pub struct MockResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl MockResponse {
    pub fn new(status: u16, body: impl Into<Vec<u8>>) -> Self {
        Self {
            status,
            headers: Vec::new(),
            body: body.into(),
        }
    }

    pub fn header(mut self, name: &str, value: impl Into<String>) -> Self {
        self.headers.push((name.to_string(), value.into()));
        self
    }
}

pub struct MockServer {
    origin: String,
    requests: Arc<Mutex<Vec<MockRequest>>>,
    task: JoinHandle<()>,
}

impl MockServer {
    pub async fn start(
        responder: impl Fn(&MockRequest, usize) -> MockResponse + Send + Sync + 'static,
    ) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let requests = Arc::new(Mutex::new(Vec::new()));
        let task_requests = requests.clone();
        let responder = Arc::new(responder);
        let task = tokio::spawn(async move {
            while let Ok((stream, _)) = listener.accept().await {
                let task_requests = task_requests.clone();
                let responder = responder.clone();
                tokio::spawn(async move {
                    let _ = handle_connection(stream, task_requests, responder).await;
                });
            }
        });
        Self {
            origin: format!("http://{address}"),
            requests,
            task,
        }
    }

    pub fn origin(&self) -> &str {
        &self.origin
    }

    pub fn requests(&self) -> Vec<MockRequest> {
        self.requests.lock().unwrap().clone()
    }

    pub async fn wait_for_requests(&self, count: usize) -> Vec<MockRequest> {
        tokio::time::timeout(Duration::from_secs(2), async {
            loop {
                let requests = self.requests();
                if requests.len() >= count {
                    return requests;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap()
    }
}

impl Drop for MockServer {
    fn drop(&mut self) {
        self.task.abort();
    }
}

async fn handle_connection(
    mut stream: TcpStream,
    requests: Arc<Mutex<Vec<MockRequest>>>,
    responder: Arc<Responder>,
) -> std::io::Result<()> {
    let request = read_request(&mut stream).await?;
    let index = {
        let mut captured = requests.lock().unwrap();
        let index = captured.len();
        captured.push(request.clone());
        index
    };
    let response = responder(&request, index);
    write_response(&mut stream, response).await
}

async fn read_request(stream: &mut TcpStream) -> std::io::Result<MockRequest> {
    let mut bytes = Vec::new();
    let header_end = loop {
        let mut chunk = [0_u8; 4096];
        let count = stream.read(&mut chunk).await?;
        if count == 0 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::UnexpectedEof,
                "request closed before headers",
            ));
        }
        bytes.extend_from_slice(&chunk[..count]);
        if bytes.len() > 1024 * 1024 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "request headers too large",
            ));
        }
        if let Some(position) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
            break position + 4;
        }
    };
    let headers_text = std::str::from_utf8(&bytes[..header_end - 4])
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))?;
    let mut lines = headers_text.split("\r\n");
    let request_line = lines.next().unwrap_or_default();
    let mut request_parts = request_line.split_whitespace();
    let method = request_parts.next().unwrap_or_default().to_string();
    let path = request_parts.next().unwrap_or_default().to_string();
    let mut headers = HashMap::new();
    for line in lines {
        if let Some((name, value)) = line.split_once(':') {
            headers.insert(name.trim().to_ascii_lowercase(), value.trim().to_string());
        }
    }
    let content_length = headers
        .get("content-length")
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);
    while bytes.len() - header_end < content_length {
        let mut chunk = vec![0_u8; (content_length - (bytes.len() - header_end)).min(64 * 1024)];
        let count = stream.read(&mut chunk).await?;
        if count == 0 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::UnexpectedEof,
                "request closed before body",
            ));
        }
        bytes.extend_from_slice(&chunk[..count]);
    }
    Ok(MockRequest {
        method,
        path,
        headers,
        body: bytes[header_end..header_end + content_length].to_vec(),
    })
}

async fn write_response(stream: &mut TcpStream, response: MockResponse) -> std::io::Result<()> {
    let reason = match response.status {
        200 => "OK",
        201 => "Created",
        204 => "No Content",
        206 => "Partial Content",
        207 => "Multi-Status",
        301 => "Moved Permanently",
        302 => "Found",
        307 => "Temporary Redirect",
        308 => "Permanent Redirect",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        409 => "Conflict",
        412 => "Precondition Failed",
        423 => "Locked",
        _ => "Error",
    };
    let mut head = format!(
        "HTTP/1.1 {} {}\r\nContent-Length: {}\r\nConnection: close\r\n",
        response.status,
        reason,
        response.body.len()
    );
    for (name, value) in response.headers {
        head.push_str(&format!("{name}: {value}\r\n"));
    }
    head.push_str("\r\n");
    stream.write_all(head.as_bytes()).await?;
    stream.write_all(&response.body).await?;
    stream.shutdown().await
}
