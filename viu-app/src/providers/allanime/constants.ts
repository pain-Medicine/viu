// Mirrors viu_media/libs/provider/anime/allanime/constants.py. When AllAnime
// rotates its client crypto, update both files together.

export const API_GRAPHQL_REFERER = 'https://mkissa.to';
export const API_GRAPHQL_ENDPOINT = 'https://api.mkissa.net/api';
export const API_BOOTSTRAP_ENDPOINT = 'https://api.mkissa.net/client-crypto/v1/bootstrap';
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0';

export const API_GRAPHQL_HEADERS: Record<string, string> = {
  'User-Agent': USER_AGENT,
  'Content-Type': 'application/json',
  Referer: API_GRAPHQL_REFERER,
  Origin: API_GRAPHQL_REFERER,
};

export const EPISODE_GQL_HASH = '670bbf38d0868f446e2346c1e956ca2c40c416e733ca248fd54e04f1c8b99145';

// Client crypto for the episode query, taken from mkissa web build 181.
export const CLIENT_BUILD_ID = '181';
export const CLIENT_KEY_LANE = 'k7';
export const CLIENT_KEY_GROUP = 'mkissa';
export const CLIENT_BOOT_SALT = 'UZQjku7';
export const CLIENT_MASK_HEX = 'fcccd2c105d4873d88ce94359bb5e458a972bde6ac930693ef1fcaa85418f56e';
// The bootstrap epoch is the week number since the unix epoch.
export const CLIENT_EPOCH_MS = 7 * 24 * 60 * 60 * 1000;

export const MP4_SERVER_JUICY_STREAM_REGEX = /video\/mp4",src:"(https?:\/\/.*\/video\.mp4)"/;

export const SEARCH_GQL = `query (
  $search: SearchInput
  $limit: Int
  $page: Int
  $translationType: VaildTranslationTypeEnumType
  $countryOrigin: VaildCountryOriginEnumType
) {
  shows(
    search: $search
    limit: $limit
    page: $page
    translationType: $translationType
    countryOrigin: $countryOrigin
  ) {
    pageInfo {
      total
    }
    edges {
      _id
      name
      availableEpisodes
      __typename
    }
  }
}`;

export const ANIME_GQL = `query ($showId: String!) {
  show(_id: $showId) {
    _id
    name
    availableEpisodesDetail
  }
}`;
