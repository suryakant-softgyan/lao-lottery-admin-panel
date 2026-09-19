import { HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { map } from 'rxjs';

interface Envelope {
  success: boolean;
  data?: unknown;
  message?: string;
  timestamp?: string;
}

function isEnvelope(body: unknown): body is Envelope {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Envelope).success === 'boolean' &&
    'timestamp' in body
  );
}

/**
 * The API wraps every payload as `{ success, data, message, timestamp, traceId }`. Repositories and
 * services work with the bare model, so the envelope is removed here — in exactly one place.
 * It sits last in the chain (closest to the network) so every other interceptor sees plain bodies.
 */
export const envelopeInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    map((event) =>
      event instanceof HttpResponse && isEnvelope(event.body)
        ? event.clone({ body: event.body.data ?? null })
        : event,
    ),
  );
