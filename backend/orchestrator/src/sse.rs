use crate::types::SseEventData;
use bytes::Bytes;
use futures::Stream;
use pin_project::pin_project;
use std::pin::Pin;
use std::task::{Context, Poll};
use tokio::sync::mpsc::Receiver;

#[pin_project]
pub struct SseStream {
    #[pin]
    rx: Receiver<Bytes>,
}

impl SseStream {
    pub fn new(rx: Receiver<Bytes>) -> Self {
        Self { rx }
    }
}

impl Stream for SseStream {
    type Item = Result<Bytes, std::io::Error>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let mut this = self.project();
        match this.rx.poll_recv(cx) {
            Poll::Ready(Some(event)) => Poll::Ready(Some(Ok(event))),
            Poll::Ready(None) => Poll::Ready(None),
            Poll::Pending => Poll::Pending,
        }
    }
}

pub fn event_to_sse_bytes(event: &SseEventData) -> Bytes {
    let (event_name, data_str) = match event {
        SseEventData::BenchmarkStarted(_) => {
            ("benchmark_started", serde_json::to_string(event).unwrap())
        }
        SseEventData::ModelResult(_) => ("model_result", serde_json::to_string(event).unwrap()),
        SseEventData::JudgeResult(_) => ("judge_result", serde_json::to_string(event).unwrap()),
        SseEventData::Recommendation(_) => {
            ("recommendation", serde_json::to_string(event).unwrap())
        }
        SseEventData::Error(_) => ("error", serde_json::to_string(event).unwrap()),
        SseEventData::Done => ("done", "{}".to_string()),
    };

    Bytes::from(format!("event: {}\ndata: {}\n\n", event_name, data_str))
}
