import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface Envelope<T = unknown> {
  success: true
  data: T
  meta?: Record<string, unknown>
  timestamp: string
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Envelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<Envelope<T>> {
    const isHttp = context.getType() === 'http'

    return next.handle().pipe(
      map((data) => {
        if (!isHttp) return data as unknown as Envelope<T>

        // Preserve raw response for metadata-carrying handlers
        if (data && typeof data === 'object' && 'success' in data) {
          return data as unknown as Envelope<T>
        }

        // Handle paginated responses tagged with __paginated
        if (data && typeof data === 'object' && (data as any).__paginated) {
          const { __paginated, __meta, ...rest } = data as any
          return {
            success: true,
            data: rest,
            meta: __meta,
            timestamp: new Date().toISOString(),
          } as Envelope<T>
        }

        if (data === undefined || data === null) {
          if (context.switchToHttp().getRequest().method === 'DELETE') {
            return { success: true, data: {}, timestamp: new Date().toISOString() } as Envelope<T>
          }
          throw new NotFoundException('Resource not found')
        }

        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        } as Envelope<T>
      }),
    )
  }
}
