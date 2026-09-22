import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton, LargeTitle, Reveal, Screen } from '../../components';
import { tokens } from '../../design';
import type { VoteChoice } from '../../types';
import { previewPosts } from '../preview/sample-data';
import { PostCard } from './PostCard';

export interface FeedViewProps {
  readonly onOpenPost?: (postId: string) => void;
  readonly onSearch?: () => void;
}

export function FeedView({ onOpenPost, onSearch }: FeedViewProps) {
  // Local until VoteService exists: tapping the same vote again withdraws it.
  const [votes, setVotes] = useState<Record<string, VoteChoice | null>>({});

  return (
    <Screen clearTabBar>
      <LargeTitle
        title="Feed"
        trailing={
          <IconButton
            icon={Search}
            label="Search the feed"
            appearance="glass"
            onPress={onSearch}
            size={20}
          />
        }
      />
      <View style={styles.list}>
        {previewPosts.map((post, index) => (
          <Reveal key={post.id} index={index + 1}>
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
  list: {
    gap: tokens.spacing[4],
  },
});
