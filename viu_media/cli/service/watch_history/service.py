import logging
from typing import Optional

from ....core.config.model import AppConfig
from ....libs.media_api.base import BaseApiClient
from ....libs.media_api.params import UpdateUserMediaListEntryParams
from ....libs.media_api.types import MediaItem, UserMediaListStatus
from ....libs.player.types import PlayerResult
from ..registry import MediaRegistryService

logger = logging.getLogger(__name__)


class WatchHistoryService:
    def __init__(
        self,
        config: AppConfig,
        media_registry: MediaRegistryService,
        media_api: Optional[BaseApiClient] = None,
    ):
        self.config = config
        self.media_registry = media_registry
        self.media_api = media_api

    def track(self, media_item: MediaItem, player_result: PlayerResult):
        logger.debug(f"WatchHistoryService.track called for {media_item.id}, episode {player_result.episode}")
        logger.info(
            f"Updating watch history for {media_item.title.english} ({media_item.id}) with Episode={player_result.episode}; Stop Time={player_result.stop_time}; Total Duration={player_result.total_time}"
        )
        status = None

        if (
            media_item.user_status
            and media_item.user_status.status == UserMediaListStatus.COMPLETED
        ):
            status = UserMediaListStatus.REPEATING
            status = UserMediaListStatus.REPEATING
        
        logger.debug(f"Updating local registry with watched=True, status={status}")
        self.media_registry.update_media_index_entry(
            media_id=media_item.id,
            watched=True,
            media_item=media_item,
            last_watch_position=player_result.stop_time,
            total_duration=player_result.total_time,
            progress=player_result.episode,
            status=status,
        )

        if player_result.stop_time and player_result.total_time:
            from ....core.utils.converter import calculate_completion_percentage

            completion_percentage = calculate_completion_percentage(
                player_result.stop_time, player_result.total_time
            )
            if completion_percentage < self.config.stream.episode_complete_at:
                logger.info(
                    f"Not updating remote watch history since completion percentage ({completion_percentage} is not greater than episode complete at ({self.config.stream.episode_complete_at}))"
                )
                return
        if self.media_api and self.media_api.is_authenticated():
            if not self.media_api.update_list_entry(
                UpdateUserMediaListEntryParams(
                    media_id=media_item.id,
                    status=status,
                    progress=player_result.episode,
                )
            ):
                logger.info(
                    "successfully updated remote progress with {player_result.episode}"
                )

            else:
                logger.warning(
                    "failed to update remote progress with {player_result.episode}"
                )
        else:
            logger.debug("Skipping remote watch history update: media_api is not authenticated or not present")
            logger.warning("Not logged in")

    def get_episode(self, media_item: MediaItem):
        logger.debug(f"get_episode called for media item {media_item.id}")
        index_entry = self.media_registry.get_media_index_entry(media_item.id)
        current_remote_episode = None
        current_local_episode = None
        start_time = None
        episode = None

        if media_item.user_status:
            # TODO: change mediaa item progress to a string
            current_remote_episode = str(media_item.user_status.progress)
            logger.debug(f"Remote episode progress: {current_remote_episode}")
            
        if index_entry:
            current_local_episode = index_entry.progress
            start_time = index_entry.last_watch_position
            total_duration = index_entry.total_duration
            if start_time and total_duration and current_local_episode:
                from ....core.utils.converter import calculate_completion_percentage

                if (
                    calculate_completion_percentage(start_time, total_duration)
                    >= self.config.stream.episode_complete_at
                ):
                    start_time = None
                    try:
                        current_local_episode = str(int(current_local_episode) + 1)
                    except Exception:
                        # incase its a float
                        pass
        else:
            current_local_episode = current_remote_episode
        if not media_item.user_status:
            current_remote_episode = current_local_episode
        if current_local_episode != current_remote_episode:
            if self.config.general.preferred_tracker == "local":
                episode = current_local_episode
            else:
                episode = current_remote_episode
        else:
            episode = current_local_episode

        # TODO: check if start time is mostly complete and increment the episode
        if episode == "0":
            episode = "1"
            
        logger.debug(f"Calculated next episode: {episode}, start_time: {start_time}")
        return episode, start_time

    def update(
        self,
        media_item: MediaItem,
        progress: Optional[str] = None,
        status: Optional[UserMediaListStatus] = None,
        score: Optional[float] = None,
        notes: Optional[str] = None,
    ):
        logger.debug(f"WatchHistoryService.update called for {media_item.id}, progress={progress}, status={status}")
        self.media_registry.update_media_index_entry(
            media_id=media_item.id,
            media_item=media_item,
            progress=progress,
            status=status,
            score=score,
            notes=notes,
        )

        if self.media_api and self.media_api.is_authenticated():
            self.media_api.update_list_entry(
                UpdateUserMediaListEntryParams(
                    media_id=media_item.id,
                    status=status,
                    score=score,
                    progress=progress,
                )
            )
            logger.info("updating remote progressd")
        else:
            logger.warning("Not logged in")

    def add_media_to_list_if_not_present(self, media_item: MediaItem):
        """Adds a media item to the user's PLANNING list if it's not already on any list."""
        if not self.media_api or not self.media_api.is_authenticated():
            return

        # If user_status is None, it means the item is not on the user's list.
        if media_item.user_status is None:
            logger.debug(f"'{media_item.title.english}' not on list. Adding to 'Planning'.")
            logger.info(
                f"'{media_item.title.english}' not on list. Adding to 'Planning'."
            )
            self.update(media_item, status=UserMediaListStatus.PLANNING)
        else:
            logger.debug(f"'{media_item.title.english}' is already on a list.")
