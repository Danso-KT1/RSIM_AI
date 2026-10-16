/**
 * RSIM Directorate Centralized API Service Wrapper
 * Provides resilient HTTP fetching with comprehensive browser console diagnostics,
 * payload sanitization, latency tracking, and root-cause error analysis for Gemini AI calls.
 */

export interface ApiLogEntry {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  durationMs: number;
  ok: boolean;
  requestSummary: any;
  responseSummary: any;
  error?: string;
  diagnosticAdvice?: string;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
  durationMs: number;
  rawResponse?: Response;
}

// In-memory ring buffer for the latest 100 API transactions
const LOG_HISTORY_LIMIT = 100;
const logHistory: ApiLogEntry[] = [];
const logListeners = new Set<(entry: ApiLogEntry) => void>();

/**
 * Sanitizes request/response payloads to avoid freezing devtools with multi-megabyte base64 strings,
 * while extracting vital diagnostic metadata (size, MIME type, filename, character length).
 */
function sanitizePayload(payload: any): any {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload === 'string') {
    if (payload.length > 500) {
      return `${payload.slice(0, 150)}... [${payload.length} chars total]`;
    }
    return payload;
  }
  if (Array.isArray(payload)) {
    return payload.slice(0, 10).map(sanitizePayload);
  }
  if (typeof payload === 'object') {
    const clone: Record<string, any> = {};
    for (const [key, val] of Object.entries(payload)) {
      if (typeof val === 'string' && (key.toLowerCase().includes('base64') || val.startsWith('data:audio') || val.length > 1000)) {
        const approxKb = (val.length * 0.75 / 1024).toFixed(1);
        clone[key] = `[Base64 Audio/File Data: ${val.length} chars, approx ${approxKb} KB]`;
      } else if (typeof val === 'string' && val.length > 400) {
        clone[key] = `${val.slice(0, 180)}... [${val.length} characters]`;
      } else if (typeof val === 'object' && val !== null) {
        clone[key] = sanitizePayload(val);
      } else {
        clone[key] = val;
      }
    }
    return clone;
  }
  return payload;
}

/**
 * Analyzes API failures and provides direct diagnostic troubleshooting advice for Gemini and audio endpoints
 */
function analyzeError(status: number, url: string, errorMsg?: string): string {
  const isAudio = url.includes('transcribe-audio');
  const isGemini = url.includes('/api/ai/');

  if (status === 0) {
    return 'Network connection failure. The backend server might be rebooting or unreachable.';
  }
  if (status === 400) {
    if (isAudio) {
      return 'Bad Request (400): The audio payload is either empty, under 300 characters, or corrupted. Please verify the audio file format (WAV, MP3, WebM, M4A).';
    }
    return 'Bad Request (400): Missing required parameters in the request payload.';
  }
  if (status === 429) {
    return 'Rate Limit Exceeded (429): Google Gemini API quota limit reached. The system uses automatic fallback models, but high volume may require a brief wait.';
  }
  if (status === 503) {
    return 'Service Unavailable (503): GEMINI_API_KEY may not be configured on the server, or Gemini model demand is temporarily high.';
  }
  if (status === 500) {
    if (isAudio) {
      return `Internal Server Error (500) during transcription: ${errorMsg || 'Audio container header mismatch or model decoding failure. Check backend terminal for full stack trace.'}`;
    }
    if (isGemini) {
      return `Internal Server Error (500) during AI generation: ${errorMsg || 'Gemini inference failed. Check server terminal.'}`;
    }
    return `Server Error (500): ${errorMsg || 'Internal server error'}`;
  }
  return `HTTP Error ${status}: ${errorMsg || 'Unexpected server response'}`;
}

export const api = {
  /**
   * Central HTTP Request method with detailed styled console logging
   */
  async request<T = any>(
    url: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const reqId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const method = (options.method || 'GET').toUpperCase();
    const startTime = performance.now();
    const timeStr = new Date().toLocaleTimeString();

    // Parse & sanitize request body for diagnostic logging
    let parsedBody: any = null;
    if (options.body && typeof options.body === 'string') {
      try {
        parsedBody = JSON.parse(options.body);
      } catch {
        parsedBody = options.body;
      }
    }
    const sanitizedRequest = sanitizePayload(parsedBody);

    // Console Request Group (dev-only — no performance cost in production)
    if (import.meta.env.DEV) {
      console.groupCollapsed(
        `%c[API:REQ #${reqId}] %c${method} %c${url} %c@ ${timeStr}`,
        'background: #0284c7; color: white; font-weight: bold; border-radius: 3px; padding: 2px 6px;',
        'background: #e0f2fe; color: #0369a1; font-weight: bold; padding: 2px 4px; border-radius: 2px;',
        'color: #0f172a; font-weight: 600;',
        'color: #64748b; font-size: 11px;'
      );
      console.log('Endpoint URL:', url);
      console.log('Method:', method);
      console.log('Headers:', options.headers || { 'Content-Type': 'application/json' });
      if (sanitizedRequest) {
        console.log('Request Payload:', sanitizedRequest);
      }
      console.groupEnd();
    }

    try {
      const response = await fetch(url, options);
      const durationMs = Math.round(performance.now() - startTime);

      let responseData: any = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        responseData = await response.json().catch(() => null);
      } else {
        responseData = await response.text().catch(() => null);
      }

      const isSuccess = response.ok;
      const sanitizedResponse = sanitizePayload(responseData);
      const errorMsg = !isSuccess ? responseData?.error || responseData?.message || response.statusText : undefined;
      const advice = !isSuccess ? analyzeError(response.status, url, errorMsg) : undefined;

      // Console Response Logging (dev-only)
      if (import.meta.env.DEV) {
        if (isSuccess) {
          console.groupCollapsed(
            `%c[API:RES #${reqId}] %c${response.status} OK %c${method} %c${url} %c(${durationMs}ms)`,
            'background: #059669; color: white; font-weight: bold; border-radius: 3px; padding: 2px 6px;',
            'background: #d1fae5; color: #065f46; font-weight: bold; padding: 2px 4px; border-radius: 2px;',
            'color: #047857; font-weight: 600;',
            'color: #0f172a;',
            'color: #64748b; font-size: 11px;'
          );
          console.log('Status:', response.status, response.statusText);
          console.log('Latency:', `${durationMs}ms`);
          console.log('Response Body:', sanitizedResponse);
          console.groupEnd();
        } else {
          console.group(
            `%c[API:FAIL #${reqId}] %c${response.status} %c${method} %c${url} %c(${durationMs}ms)`,
            'background: #dc2626; color: white; font-weight: bold; border-radius: 3px; padding: 2px 6px;',
            'background: #fee2e2; color: #991b1b; font-weight: bold; padding: 2px 4px; border-radius: 2px;',
            'color: #b91c1c; font-weight: 600;',
            'color: #0f172a;',
            'color: #64748b; font-size: 11px;'
          );
          console.error('\u274c Status:', response.status, response.statusText);
          console.error('\u274c Error Message:', errorMsg);
          if (advice) {
            console.warn('\uD83D\uDCA1 Diagnostic Guidance:', advice);
          }
          console.error('Full Error Response Body:', responseData);
          console.groupEnd();
        }
      }

      // Record in transaction log ring buffer
      const logEntry: ApiLogEntry = {
        id: reqId,
        timestamp: timeStr,
        method,
        url,
        status: response.status,
        statusText: response.statusText,
        durationMs,
        ok: isSuccess,
        requestSummary: sanitizedRequest,
        responseSummary: sanitizedResponse,
        error: errorMsg,
        diagnosticAdvice: advice,
      };

      logHistory.unshift(logEntry);
      if (logHistory.length > LOG_HISTORY_LIMIT) {
        logHistory.pop();
      }
      logListeners.forEach((listener) => listener(logEntry));

      return {
        ok: isSuccess,
        status: response.status,
        data: responseData as T,
        error: errorMsg,
        durationMs,
        rawResponse: response,
      };
    } catch (networkError: any) {
      const durationMs = Math.round(performance.now() - startTime);
      const errorMsg = networkError?.message || 'Network request failed';
      const advice = analyzeError(0, url, errorMsg);

      if (import.meta.env.DEV) {
        console.group(
          `%c[API:NET_ERR #${reqId}] %c${method} %c${url} %c(${durationMs}ms)`,
          'background: #991b1b; color: white; font-weight: bold; border-radius: 3px; padding: 2px 6px;',
          'color: #b91c1c; font-weight: bold;',
          'color: #0f172a;',
          'color: #64748b; font-size: 11px;'
        );
        console.error('\u274c Network Exception:', networkError);
        console.warn('\uD83D\uDCA1 Diagnostic Guidance:', advice);
        console.groupEnd();
      }

      const logEntry: ApiLogEntry = {
        id: reqId,
        timestamp: timeStr,
        method,
        url,
        status: 0,
        statusText: 'Network Error',
        durationMs,
        ok: false,
        requestSummary: sanitizedRequest,
        responseSummary: null,
        error: errorMsg,
        diagnosticAdvice: advice,
      };

      logHistory.unshift(logEntry);
      if (logHistory.length > LOG_HISTORY_LIMIT) {
        logHistory.pop();
      }
      logListeners.forEach((listener) => listener(logEntry));

      return {
        ok: false,
        status: 0,
        data: null as any,
        error: errorMsg,
        durationMs,
      };
    }
  },

  /**
   * Helper for GET requests
   */
  async get<T = any>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  },

  /**
   * Helper for POST requests with JSON serialization
   */
  async post<T = any>(
    url: string,
    body?: any,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      headers,
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
  },

  /**
   * Helper for PUT requests
   */
  async put<T = any>(
    url: string,
    body?: any,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      headers,
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
  },

  /**
   * Helper for DELETE requests
   */
  async delete<T = any>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  },

  /**
   * Helper for multipart/form-data uploads with upload progress tracking
   */
  async upload<T = any>(
    url: string,
    formData: FormData,
    onProgress?: (percent: number) => void
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const resolvedUrl = url.startsWith('http') ? url : url.startsWith('/') ? url : `/${url}`;

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', resolvedUrl);

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        const durationMs = Date.now() - startTime;
        let responseData: any = null;
        try {
          responseData = JSON.parse(xhr.responseText);
        } catch {
          responseData = xhr.responseText;
        }

        const isOk = xhr.status >= 200 && xhr.status < 300;
        const entry: ApiLogEntry = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString(),
          url: resolvedUrl,
          method: 'POST [UPLOAD]',
          status: xhr.status,
          statusText: xhr.statusText || (isOk ? 'OK' : 'Error'),
          durationMs,
          ok: isOk,
          requestSummary: '[Multipart FormData Audio Upload]',
          responseSummary: sanitizePayload(responseData),
          error: isOk ? undefined : (responseData?.error || `HTTP Error ${xhr.status}`),
        };

        logHistory.unshift(entry);
        if (logHistory.length > 100) logHistory.pop();
        logListeners.forEach((fn) => fn(entry));

        resolve({
          data: isOk ? responseData : (null as any),
          error: isOk ? undefined : (responseData?.error || `HTTP ${xhr.status}`),
          status: xhr.status,
          durationMs,
          ok: isOk,
        });
      };

      xhr.onerror = () => {
        const durationMs = Date.now() - startTime;
        const entry: ApiLogEntry = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString(),
          url: resolvedUrl,
          method: 'POST [UPLOAD]',
          status: 0,
          statusText: 'Network Error',
          durationMs,
          ok: false,
          requestSummary: '[Multipart FormData Audio Upload]',
          responseSummary: null,
          error: 'Network connection failure during file upload',
        };
        logHistory.unshift(entry);
        logListeners.forEach((fn) => fn(entry));

        resolve({
          data: null as any,
          error: 'Network connection failure during file upload',
          status: 0,
          durationMs,
          ok: false,
        });
      };

      xhr.send(formData);
    });
  },

  /**
   * Retrieve in-memory API transaction history for diagnostics
   */
  getRecentLogs(): ApiLogEntry[] {
    return [...logHistory];
  },

  /**
   * Clear API transaction history
   */
  clearLogs(): void {
    logHistory.length = 0;
  },

  /**
   * Subscribe to new API transaction log entries
   */
  subscribeToLogs(listener: (entry: ApiLogEntry) => void): () => void {
    logListeners.add(listener);
    return () => {
      logListeners.delete(listener);
    };
  },
};
