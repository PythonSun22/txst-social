"""Process-local worker circuit breaker. Restart after correcting credentials."""
import logging
import os
from threading import Event, Lock
from uuid import uuid4


def credential_error(code: str | None) -> bool:
    return code in {"configuration", "context_configuration", "storage_configuration", "storage_auth",
                   "provider_http_401", "provider_http_403", "context_http_401", "context_http_403"}


class WorkerControl:
    def __init__(self):
        self.worker_id = f"{os.getpid()}-{uuid4().hex[:8]}"
        self.paused = Event()
        self._lock = Lock()
        self.reason: str | None = None

    def pause(self, code, job_id):
        with self._lock:
            if not self.paused.is_set():
                self.reason = code
                self.paused.set()
                logging.getLogger(__name__).error(
                    "Workers paused worker_id=%s job_id=%s code=%s; fix credentials and restart backend.",
                    self.worker_id, job_id, code)


control = WorkerControl()
