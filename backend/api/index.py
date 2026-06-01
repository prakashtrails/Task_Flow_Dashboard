from app.main import app

# Vercel Python supports ASGI apps exposed as `app`.
# This file is the entrypoint for the backend deployment.
__vercel_handler__ = app
