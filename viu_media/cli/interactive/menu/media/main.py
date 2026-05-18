import logging
import random
from typing import Callable, Dict

from .....libs.media_api.params import MediaSearchParams, UserMediaListSearchParams
from .....libs.media_api.types import (
    MediaSort,
    MediaStatus,
    UserMediaListStatus,
)
from ...session import Context, session
from ...state import InternalDirective, MediaApiState, MenuName, State

logger = logging.getLogger(__name__)
MenuAction = Callable[[], State | InternalDirective]


@session.menu
def main(ctx: Context, state: State) -> State | InternalDirective:
    icons = ctx.config.general.icons
    feedback = ctx.feedback
    feedback.clear_console()

    logger.debug("Entered main interactive menu")

    options: Dict[str, MenuAction] = {
        f"{'🔥 ' if icons else ''}Trending": _create_media_list_action(
            ctx, state, MediaSort.TRENDING_DESC
        ),
        f"{'🎞️ ' if icons else ''}Recent": _create_recent_media_action(ctx, state),
        f"{'📺 ' if icons else ''}Watching": _create_user_list_action(
            ctx, state, UserMediaListStatus.WATCHING
        ),
        f"{'🔁 ' if icons else ''}Rewatching": _create_user_list_action(
            ctx, state, UserMediaListStatus.REPEATING
        ),
        f"{'⏸️ ' if icons else ''}Paused": _create_user_list_action(
            ctx, state, UserMediaListStatus.PAUSED
        ),
        f"{'📑 ' if icons else ''}Planned": _create_user_list_action(
            ctx, state, UserMediaListStatus.PLANNING
        ),
        f"{'🔎 ' if icons else ''}Search": _create_search_media_list(ctx, state),
        f"{'🔍 ' if icons else ''}Dynamic Search": _create_dynamic_search_action(
            ctx, state
        ),
        f"{'🏠 ' if icons else ''}Downloads": _create_downloads_action(ctx, state),
        f"{'🔔 ' if icons else ''}Recently Updated": _create_media_list_action(
            ctx, state, MediaSort.UPDATED_AT_DESC
        ),
        f"{'✨ ' if icons else ''}Popular": _create_media_list_action(
            ctx, state, MediaSort.POPULARITY_DESC
        ),
        f"{'💯 ' if icons else ''}Top Scored": _create_media_list_action(
            ctx, state, MediaSort.SCORE_DESC
        ),
        f"{'💖 ' if icons else ''}Favourites": _create_media_list_action(
            ctx, state, MediaSort.FAVOURITES_DESC
        ),
        f"{'🎲 ' if icons else ''}Random": _create_random_media_list(ctx, state),
        f"{'🎬 ' if icons else ''}Upcoming": _create_media_list_action(
            ctx, state, MediaSort.POPULARITY_DESC, MediaStatus.NOT_YET_RELEASED
        ),
        f"{'✅ ' if icons else ''}Completed": _create_user_list_action(
            ctx, state, UserMediaListStatus.COMPLETED
        ),
        f"{'🚮 ' if icons else ''}Dropped": _create_user_list_action(
            ctx, state, UserMediaListStatus.DROPPED
        ),
        f"{'📝 ' if icons else ''}Edit Config": lambda: InternalDirective.CONFIG_EDIT,
        f"{'❌ ' if icons else ''}Exit": lambda: InternalDirective.EXIT,
    }

    logger.debug("Prompting user to select category from main menu")
    choice = ctx.selector.choose(
        prompt="Select Category",
        choices=list(options.keys()),
    )
    if not choice:
        logger.debug("No choice made in main menu, reloading")
        return InternalDirective.MAIN

    selected_action = options[choice]
    logger.debug(f"User selected: {choice}")

    next_step = selected_action()
    return next_step


def _create_media_list_action(
    ctx: Context, state: State, sort: MediaSort, status: MediaStatus | None = None
) -> MenuAction:
    def action():
        feedback = ctx.feedback
        search_params = MediaSearchParams(sort=sort, status=status)
        logger.debug(f"Executing media list action with sort={sort}, status={status}")

        loading_message = "Fetching media list"
        result = None
        with feedback.progress(loading_message):
            result = ctx.media_api.search_media(search_params)

        if result:
            return State(
                menu_name=MenuName.RESULTS,
                media_api=MediaApiState(
                    search_result={
                        media_item.id: media_item for media_item in result.media
                    },
                    search_params=search_params,
                    page_info=result.page_info,
                ),
            )
        else:
            return InternalDirective.MAIN

    return action


def _create_random_media_list(ctx: Context, state: State) -> MenuAction:
    def action():
        feedback = ctx.feedback
        search_params = MediaSearchParams(id_in=random.sample(range(1, 15000), k=50))

        loading_message = "Fetching media list"
        result = None
        with feedback.progress(loading_message):
            result = ctx.media_api.search_media(search_params)

        if result:
            return State(
                menu_name=MenuName.RESULTS,
                media_api=MediaApiState(
                    search_result={
                        media_item.id: media_item for media_item in result.media
                    },
                    search_params=search_params,
                    page_info=result.page_info,
                ),
            )
        else:
            return InternalDirective.MAIN

    return action


def _create_search_media_list(ctx: Context, state: State) -> MenuAction:
    def action():
        feedback = ctx.feedback

        query = ctx.selector.ask("Search for Anime")
        if not query:
            return InternalDirective.MAIN
            
        logger.debug(f"Executing search media list action for query '{query}'")

        search_params = MediaSearchParams(query=query)

        loading_message = "Fetching media list"
        result = None
        with feedback.progress(loading_message):
            result = ctx.media_api.search_media(search_params)

        if result:
            return State(
                menu_name=MenuName.RESULTS,
                media_api=MediaApiState(
                    search_result={
                        media_item.id: media_item for media_item in result.media
                    },
                    search_params=search_params,
                    page_info=result.page_info,
                ),
            )
        else:
            return InternalDirective.MAIN

    return action


def _create_user_list_action(
    ctx: Context, state: State, status: UserMediaListStatus
) -> MenuAction:
    """A factory to create menu actions for fetching user lists, handling authentication."""

    def action():
        feedback = ctx.feedback
        logger.debug(f"Executing user list action for status={status}")
        if not ctx.media_api.is_authenticated():
            logger.warning("User list action failed: not authenticated")
            feedback.error("You haven't logged in")
            return InternalDirective.MAIN

        search_params = UserMediaListSearchParams(status=status)

        loading_message = "Fetching media list"
        result = None
        with feedback.progress(loading_message):
            result = ctx.media_api.search_media_list(search_params)

        if result:
            return State(
                menu_name=MenuName.RESULTS,
                media_api=MediaApiState(
                    search_result={
                        media_item.id: media_item for media_item in result.media
                    },
                    search_params=search_params,
                    page_info=result.page_info,
                ),
            )
        else:
            return InternalDirective.MAIN

    return action


def _create_recent_media_action(ctx: Context, state: State) -> MenuAction:
    def action():
        result = ctx.media_registry.get_recently_watched()
        if result:
            return State(
                menu_name=MenuName.RESULTS,
                media_api=MediaApiState(
                    search_result={
                        media_item.id: media_item for media_item in result.media
                    },
                    page_info=result.page_info,
                ),
            )
        else:
            return InternalDirective.MAIN

    return action


def _create_downloads_action(ctx: Context, state: State) -> MenuAction:
    """Create action to navigate to the downloads menu."""

    def action():
        return State(menu_name=MenuName.DOWNLOADS)

    return action


def _create_dynamic_search_action(ctx: Context, state: State) -> MenuAction:
    """Create action to navigate to the dynamic search menu."""

    def action():
        return State(menu_name=MenuName.DYNAMIC_SEARCH)

    return action
