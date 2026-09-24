import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Divider, IconButton, LargeTitle, Reveal, Screen } from '../../components';
import { tokens } from '../../design';
import type { VoteChoice } from '../../types';
import { previewPosts } from '../preview/sample-data';
import { ProfileButton } from '../profile/ProfileButton';
import { PostCard } from './PostCard';

export interface FeedViewProps {
  readonly onOpenPost?: (postId: string) => void;
  readonly onSearch?: () => void;
  readonly onOpenProfile?: () => void;
}

export function FeedView({ onOpenPost, onSearch, onOpenProfile }: FeedViewProps) {
  // Local until VoteService exists: tapping the same vote again withdraws it.
  const [votes, setVotes] = useState<Record<string, VoteChoice | null>>({});

  return (
    <Screen clearTabBar>
      <LargeTitle
        title="Feed"
        subtitle="Is the estimate right? Cast your vote."
        trailing={
          <View style={styles.actions}>
            <IconButton
              icon={Search}
              label="Search the feed"
              appearance="outline"
              onPress={onSearch}
              size={20}
            />
            <ProfileButton onPress={onOpenProfile} />
          </View>
        }
      />
      <View style={styles.list}>
        {previewPosts.map((post, index) => (
          <Reveal key={post.id} index={index} style={styles.item}>
            {index > 0 ? <Divider /> : null}
            <PostCard
              post={post}
              vote={votes[post.id] ?? null}
              onVote={(choice) =>
                setVotes((current) => ({
                  ...current,
                  [post.id]: current[post.id] === choice ? null : choice,
                }))
              }
              onOpen={() => onOpenPost?.(post.id)}
            />
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  list: {
    gap: tokens.spacing[8],
  },
  item: {
    gap: tokens.spacing[8],
  },
});
