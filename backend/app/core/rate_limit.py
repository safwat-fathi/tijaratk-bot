import time
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.redis import get_arq_pool


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        # Skip rate limiting for health check and docs
        if request.url.path in ["/health", "/docs", "/openapi.json", "/health/"]:
            return await call_next(request)

        # Extract client IP (respecting X-Forwarded-For if behind a proxy)
        client_ip = request.headers.get("x-forwarded-for")
        if not client_ip and request.client:
            client_ip = request.client.host
        if not client_ip:
            client_ip = "unknown"

        # Check tier
        if request.url.path.startswith("/demo"):
            max_reqs = settings.RATE_LIMIT_DEMO_MAX
            window = settings.RATE_LIMIT_DEMO_WINDOW
        else:
            max_reqs = settings.RATE_LIMIT_DEFAULT_MAX
            window = settings.RATE_LIMIT_DEFAULT_WINDOW

        # Sliding window logic using Redis
        current_time = int(time.time())
        window_key = current_time // window
        redis_key = f"rl:{client_ip}:{window_key}"

        try:
            redis = await get_arq_pool()

            # Use a pipeline to INCR and set EXPIRE
            pipe = redis.pipeline()
            pipe.incr(redis_key)
            pipe.expire(redis_key, window * 2) # keep it around slightly longer than the window
            results = await pipe.execute()

            request_count = results[0]

            if request_count > max_reqs:
                retry_after = window - (current_time % window)
                return Response(
                    content="Too Many Requests",
                    status_code=429,
                    headers={"Retry-After": str(retry_after)},
                )
        except Exception as e:
            # If Redis fails, fail open to avoid blocking legitimate traffic
            import logging
            logging.getLogger("app.core.rate_limit").error(f"Rate limiting error: {e}")

        return await call_next(request)
