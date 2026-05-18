import logging
from typing import TYPE_CHECKING

from .....core.utils.graphql import execute_graphql
from ..base import BaseAnimeProvider
from ..utils.debug import debug_provider
from .constants import (
    ANIME_GQL,
    API_GRAPHQL_ENDPOINT,
    API_GRAPHQL_HEADERS,
    API_GRAPHQL_REFERER,
    EPISODE_GQL,
    EPISODE_GQL_HASH,
    SEARCH_GQL,
)
from .mappers import (
    map_to_anime_result,
    map_to_search_results,
)

if TYPE_CHECKING:
    from .types import AllAnimeEpisode
logger = logging.getLogger(__name__)


class AllAnime(BaseAnimeProvider):
    HEADERS = {
        "Referer": API_GRAPHQL_REFERER,
        "Origin": "https://youtu-chan.com",
    }

    def __init__(self, client):
        super().__init__(client)
        # Use curl_cffi to bypass Cloudflare TLS fingerprinting on AllAnime
        from curl_cffi import requests
        self.curl_client = requests.Session(impersonate="chrome", headers=self.HEADERS)

    @debug_provider
    def search(self, params):
        response = execute_graphql(
            API_GRAPHQL_ENDPOINT,
            self.curl_client,
            SEARCH_GQL,
            variables={
                "search": {
                    "allowAdult": params.allow_nsfw,
                    "allowUnknown": params.allow_unknown,
                    "query": params.query,
                },
                "limit": params.page_limit,
                "page": params.current_page,
                "translationType": params.translation_type,
                "countryOrigin": params.country_of_origin,
            },
            headers=API_GRAPHQL_HEADERS
        )
        return map_to_search_results(response)

    @debug_provider
    def get(self, params):
        response = execute_graphql(
            API_GRAPHQL_ENDPOINT,
            self.curl_client,
            ANIME_GQL,
            variables={"showId": params.id},
            headers=API_GRAPHQL_HEADERS
        )
        return map_to_anime_result(response)

    @debug_provider
    def episode_streams(self, params):
        from .extractors import extract_server
        from .utils import decrypt_tobeparsed

        import json
        extensions = {
            "persistedQuery": {
                "version": 1,
                "sha256Hash": EPISODE_GQL_HASH,
            }
        }
        variables = {
            "showId": params.anime_id,
            "translationType": params.translation_type,
            "episodeString": params.episode,
        }
        
        # Try GET request with persisted query first (bypasses CAPTCHA for many users)
        episode_response = self.curl_client.get(
            API_GRAPHQL_ENDPOINT,
            params={
                "variables": json.dumps(variables),
                "extensions": json.dumps(extensions),
            },
            headers=API_GRAPHQL_HEADERS
        )
        
        # If GET fails or returns captcha error, fall back to POST (original behavior)
        if episode_response.status_code != 200 or "NEED_CAPTCHA" in episode_response.text:
            logger.info("GET persisted query failed or triggered CAPTCHA, falling back to POST")
            episode_response = execute_graphql(
                API_GRAPHQL_ENDPOINT,
                self.curl_client,
                EPISODE_GQL,
                variables=variables,
            )

        try:
            data = episode_response.json().get("data", {})
            if "episode" in data and data["episode"]:
                episode = data["episode"]
            elif "tobeparsed" in data:
                episode = data
            else:
                raise KeyError("episode or tobeparsed not found in data")
        except KeyError:
            print("GraphQL Error response:", episode_response.text)
            raise
        
        if not episode:
            logger.error(f"Failed to fetch episode: {episode_response.text}")
            return

        if "tobeparsed" in episode:
            decrypted = decrypt_tobeparsed(episode["tobeparsed"])
            if "episode" in decrypted and "sourceUrls" in decrypted["episode"]:
                episode = decrypted["episode"]
                source_urls = episode["sourceUrls"]
            else:
                source_urls = decrypted.get("sourceUrls", [])
        else:
            source_urls = episode.get("sourceUrls", [])

        for source in source_urls:
            if server := extract_server(self.curl_client, params.episode, episode, source):
                yield server


if __name__ == "__main__":
    from ..utils.debug import test_anime_provider

    test_anime_provider(AllAnime)
