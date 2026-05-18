import click
import logging
from viu_media.core.config import AppConfig

logger = logging.getLogger(__name__)


@click.command(help="Run the background worker for notifications and downloads.")
@click.pass_obj
def worker(config: AppConfig):
    """
    Starts the long-running background worker process.
    This process will periodically check for AniList notifications and
    process any queued downloads. It's recommended to run this in the
    background (e.g., 'viu worker &') or as a system service.
    """
    from viu_media.cli.service.auth import AuthService
    from viu_media.cli.service.download.service import DownloadService
    from viu_media.cli.service.feedback import FeedbackService
    from viu_media.cli.service.notification.service import NotificationService
    from viu_media.cli.service.registry.service import MediaRegistryService
    from viu_media.cli.service.worker.service import BackgroundWorkerService
    from viu_media.libs.media_api.api import create_api_client
    from viu_media.libs.provider.anime.provider import create_provider

    feedback = FeedbackService(config)
    logger.debug("Worker command initiated.")
    
    if not config.worker.enabled:
        logger.debug("Worker is disabled in config. Exiting.")
        feedback.warning("Worker is disabled in the configuration. Exiting.")
        return

    # Instantiate services
    media_api = create_api_client(config.general.media_api, config)
    # Authenticate if credentials exist (enables notifications)
    auth = AuthService(config.general.media_api)
    logger.debug("Checking for authentication credentials...")
    if profile := auth.get_auth():
        try:
            media_api.authenticate(profile.token)
            logger.debug(f"Successfully authenticated as {profile.name} (ID: {profile.id})")
        except Exception as e:
            logger.error(f"Failed to authenticate worker: {e}")
            pass
    provider = create_provider(config.general.provider)
    registry = MediaRegistryService(config.general.media_api, config.media_registry)

    notification_service = NotificationService(config, media_api, registry)
    download_service = DownloadService(config, registry, media_api, provider)
    
    logger.debug("Initializing BackgroundWorkerService")
    worker_service = BackgroundWorkerService(
        config.worker, notification_service, download_service
    )

    feedback.info("Starting background worker...", "Press Ctrl+C to stop.")
    logger.debug("Starting worker run loop.")
    worker_service.run()
