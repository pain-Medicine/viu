"""Search functionality."""

from viu_media.core.utils.fuzzy import fuzz
from viu_media.core.utils.normalizer import normalize_title
from viu_media.libs.provider.anime.types import SearchResult, ProviderName
from viu_media.libs.media_api.types import MediaItem


def find_best_match_title(
    provider_results_map: dict[str, SearchResult],
    provider: ProviderName,
    media_item: MediaItem,
) -> str:
    """Find the best match title using advanced fuzzy matching across all available aliases.

    Parameters:
        provider_results_map (dict[str, SearchResult]): The map of provider results.
        provider (ProviderName): The provider name from the config.
        media_item (MediaItem): The media item to match.

    Returns:
        str: The best match title.
    """
    if not provider_results_map:
        return ""

    # 1. Collect all valid official titles and aliases
    valid_titles = []
    if media_item.title.english:
        valid_titles.append(media_item.title.english.lower())
    if media_item.title.romaji:
        valid_titles.append(media_item.title.romaji.lower())
    if media_item.title.native:
        valid_titles.append(media_item.title.native.lower())
    if hasattr(media_item, "synonymns") and media_item.synonymns:
        for syn in media_item.synonymns:
            if syn:
                valid_titles.append(syn.lower())

    best_match = None
    highest_score = -9999

    # Calculate expected episodes from AniList
    expected_episodes = None
    if media_item.next_airing and media_item.next_airing.episode:
        expected_episodes = media_item.next_airing.episode - 1
    elif media_item.episodes:
        expected_episodes = media_item.episodes

    # 2. Score each provider title
    for p_title, result in provider_results_map.items():
        norm_p_title = normalize_title(p_title, provider.value).lower()

        # Hard override check: if normalized title exactly matches an official title
        if norm_p_title in valid_titles:
            return p_title  # Immediate exact match via normalizer or exact string

        # Determine the maximum available episodes for this provider result
        p_episodes = 0
        if hasattr(result, "episodes") and result.episodes:
            p_episodes = max(
                len(result.episodes.sub) if hasattr(result.episodes, "sub") else 0,
                len(result.episodes.dub) if hasattr(result.episodes, "dub") else 0,
                len(result.episodes.raw) if hasattr(result.episodes, "raw") else 0,
            )

        # Calculate Episode Bonus/Penalty
        episode_bonus = 0
        if expected_episodes is not None and expected_episodes > 0 and p_episodes > 0:
            diff = abs(expected_episodes - p_episodes)
            if diff == 0:
                episode_bonus = 100
            elif diff <= 2:
                episode_bonus = 75
            elif diff <= 5:
                episode_bonus = 30
            elif diff > max(10, expected_episodes * 0.3):
                # If off by more than 10 AND more than 30% of the total episodes, it's likely a movie/OVA decoy
                episode_bonus = -50

        # Calculate robust fuzzy score against all valid titles
        p_title_lower = p_title.lower()
        best_local_text_score = 0
        for vt in valid_titles:
            # We average token_set_ratio (handles out-of-order/extra words well) 
            # with ratio (penalizes large length differences) to prevent 
            # spin-offs/movies like "One Piece Film: Red" from getting a 100 text score
            t_set = fuzz.token_set_ratio(p_title_lower, vt)
            r = fuzz.ratio(p_title_lower, vt)
            score = (t_set + r) / 2
            
            if score > best_local_text_score:
                best_local_text_score = score
            
            t_set_norm = fuzz.token_set_ratio(norm_p_title, vt)
            r_norm = fuzz.ratio(norm_p_title, vt)
            score_norm = (t_set_norm + r_norm) / 2
            
            if score_norm > best_local_text_score:
                best_local_text_score = score_norm

        # Final combined score
        final_score = best_local_text_score + episode_bonus

        if final_score > highest_score:
            highest_score = final_score
            best_match = p_title

    return best_match or list(provider_results_map.keys())[0]
