import { useRef, useState } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';

import { CardMedia, getMany, ListStatus, listCollection } from '../api/anilist';
import { useAsync } from '../lib/useAsync';
import { deviceKind } from '../lib/device';
import { useNav } from '../nav/navigation';
import { useAccount } from '../state/account';
import { useLocalList } from '../state/mylist';
import { useSettings } from '../state/settings';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { FrameMarks } from '../ui/Decor';
import { Empty } from '../ui/Empty';
import { ErrorState } from '../ui/ErrorState';
import { MediaCard, PosterSkeletons } from '../ui/MediaCard';
import { gridColumns, gridGap, useCardSize, useStage } from '../ui/Stage';
import { Text } from '../ui/Text';
import { TopNav } from '../ui/TopNav';
import { formatLabel } from './format';

const CARD_W = 262;
const CARD_H = 374;

const STATUSES: { status: ListStatus; label: string }[] = [
  { status: 'CURRENT', label: 'Watching' },
  { status: 'PLANNING', label: 'Planning' },
  { status: 'PAUSED', label: 'Paused' },
  { status: 'REPEATING', label: 'Rewatching' },
  { status: 'COMPLETED', label: 'Completed' },
  { status: 'DROPPED', label: 'Dropped' },
];

interface Item {
  media: CardMedia;
  tag?: string;
}

// The AniList list when signed in, otherwise titles saved on this device.
export function MyListScreen() {
  const { account, revision } = useAccount();
  const local = useLocalList();

  const remote = useAsync(account ? `list:${account.user.id}:${revision}` : null, () => listCollection(account!.token, account!.user.id));
  const saved = useAsync(!account && local.ids.length ? `many:${local.ids.join(',')}` : null, () => getMany(local.ids));
  const [status, setStatus] = useState<ListStatus>('CURRENT');

  if (account) {
    const groups = remote.data ?? [];
    const group = groups.find((g) => g.status === status);
    const items: Item[] = (group?.entries ?? []).map((e) => ({
      media: e.media,
      tag: e.progress ? `${e.progress}${e.media.episodes ? `/${e.media.episodes}` : ''}` : undefined,
    }));
    const tabs = STATUSES.map((s) => ({ ...s, count: groups.find((g) => g.status === s.status)?.entries.length ?? 0 }));
    return (
      <ListLayout
        crumb={`VIU.TV / MY LIST / ${account.user.name.toUpperCase()}`}
        header={tabs
          .filter((t) => t.count || t.status === 'CURRENT' || t.status === 'PLANNING')
          .map((t, i) => (
            <Chip
              key={t.status}
              label={`${t.label} · ${t.count}`}
              accessibilityLabel={`${t.label}, ${t.count} titles`}
              selected={status === t.status}
              autoFocus={i === 0}
              onPress={() => setStatus(t.status)}
            />
          ))}
        note={`AniList · ${account.user.name}`}
        items={items}
        loading={remote.loading && !remote.data}
        error={remote.error}
        empty={{ title: 'Nothing here yet', body: 'Titles you mark this way on AniList show up here.' }}
        onRetry={remote.retry}
      />
    );
  }

  const items: Item[] = local.ids.length ? (saved.data ?? []).map((media) => ({ media })) : [];
  return (
    <ListLayout
      crumb="VIU.TV / MY LIST"
      header={<SignInPrompt />}
      note={`Saved on this ${deviceKind()}`}
      items={items}
      loading={saved.loading && !saved.data}
      error={saved.error}
      empty={{ title: 'Your list is empty', body: 'Found something good? Open its page and choose “Add to My List”.' }}
      onRetry={saved.retry}
    />
  );
}

function SignInPrompt() {
  const { theme } = useSettings();
  const nav = useNav();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
      <Button autoFocus size="sm" label="Sign in to AniList" onPress={() => nav.push({ name: 'signin' })} />
      <Text variant="note" color={theme.colors.textMuted} style={{ flexShrink: 1 }}>
        {`Use your AniList lists here instead of this ${deviceKind()}’s.`}
      </Text>
    </View>
  );
}

function ListLayout({
  crumb,
  header,
  note,
  items,
  loading,
  error,
  empty,
  onRetry,
}: {
  crumb: string;
  header: React.ReactNode;
  note: string;
  items: Item[];
  loading: boolean;
  error?: Error;
  empty: { title: string; body: string };
  onRetry: () => void;
}) {
  const { theme } = useSettings();
  const c = theme.colors;
  const nav = useNav();
  const scroll = useRef<ScrollViewInstance>(null);
  const stage = useStage();
  const { cardW, cardH, rowStep } = useCardSize(CARD_W, CARD_H);
  const cols = gridColumns(stage.width - 132, cardW, 32);

  return (
    <View style={StyleSheet.absoluteFill}>
      <FrameMarks crumb={crumb} />
      <TopNav active="mylist" />
      <View
        style={{
          position: 'absolute',
          top: theme.layout.contentTop,
          left: 80,
          right: 80,
          flexDirection: 'row',
          gap: 12,
          alignItems: 'center',
        }}
      >
        {header}
        <View style={{ flex: 1 }} />
        <Text variant="label" color={c.textMuted}>
          {loading ? 'Loading…' : stage.narrow ? `${items.length} titles` : `${note}  ·  ${items.length} titles`}
        </Text>
      </View>
      <ScrollView
        ref={scroll}
        style={{ position: 'absolute', top: theme.layout.contentTop + 66, left: 66, right: 66, bottom: 0 }}
        contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: gridGap(stage.width - 132, cardW, 32), rowGap: 32, padding: 14, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {error && <ErrorState compact error={error} service="AniList" title="Couldn't load My List" onRetry={onRetry} />}
        {loading && <PosterSkeletons count={cols} width={cardW} height={cardH} />}
        {!loading && !error && !items.length && (
          <Empty title={empty.title} body={empty.body} action={{ label: 'Browse titles', onPress: () => nav.goTo({ name: 'browse' }) }} />
        )}
        {items.map(({ media, tag }, i) => (
          <MediaCard
            key={media.id}
            media={media}
            shape="poster"
            width={cardW}
            height={cardH}
            tag={tag}
            meta={[media.seasonYear, formatLabel(media)].filter(Boolean).join(' · ')}
            onFocus={() => scroll.current?.scrollTo({ y: Math.max(0, Math.floor(i / cols) * rowStep), animated: true })}
            onPress={() => nav.push({ name: 'details', mediaId: media.id })}
          />
        ))}
      </ScrollView>
    </View>
  );
}
