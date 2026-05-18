import logging
from typing import Optional

from ....core.config import AppConfig
from ....core.exceptions import ViuError
from ....libs.media_api.types import MediaItem
from ....libs.player.base import BasePlayer
from ....libs.player.params import PlayerParams
from ....libs.player.player import create_player
from ....libs.player.types import PlayerResult
from ....libs.provider.anime.base import BaseAnimeProvider
from ....libs.provider.anime.types import Anime
from ..registry import MediaRegistryService

logger = logging.getLogger(__name__)


class PlayerService:
    app_config: AppConfig
    provider: BaseAnimeProvider
    player: BasePlayer
    registry: Optional[MediaRegistryService] = None
    local: bool = False

    def __init__(
        self,
        app_config: AppConfig,
        provider: BaseAnimeProvider,
        registry: Optional[MediaRegistryService] = None,
    ):
        self.app_config = app_config
        self.provider = provider
        self.registry = registry
        logger.debug(f"Initializing PlayerService with provider: {provider.__class__.__name__}, registry: {registry is not None}")
        self.player = create_player(app_config)

    def play(
        self,
        params: PlayerParams,
        anime: Optional[Anime] = None,
        media_item: Optional[MediaItem] = None,
        local: bool = False,
    ) -> PlayerResult:
        self.local = local
        logger.debug(f"PlayerService.play called. params.url: {params.url}, local: {local}, use_ipc: {self.app_config.stream.use_ipc}")
        if self.app_config.stream.use_ipc:
            if anime or self.registry:
                logger.debug("Routing to IPC player")
                return self._play_with_ipc(params, anime, media_item)
            else:
                logger.warning(
                    f"Ipc player won't be used since Anime Object has not been given for url={params.url}"
                )
        logger.debug("Routing to standard player")
        return self.player.play(params)

    def _play_with_ipc(
        self,
        params: PlayerParams,
        anime: Optional[Anime] = None,
        media_item: Optional[MediaItem] = None,
    ) -> PlayerResult:
        logger.debug(f"_play_with_ipc called for player: {self.app_config.stream.player}")
        if self.app_config.stream.player == "mpv":
            from .ipc.mpv import MpvIPCPlayer

            registry = self.registry if self.local else None
            return MpvIPCPlayer(self.app_config.stream).play(
                self.player, params, self.provider, anime, registry, media_item
            )
        else:
            logger.error(f"IPC not implemented for player: {self.app_config.stream.player}")
            raise ViuError("Not implemented")
