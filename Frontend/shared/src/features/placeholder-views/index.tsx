import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../design';

interface RoutePlaceholderProps {
  readonly title: string;
  readonly question?: string;
  readonly detail?: string;
  readonly live?: boolean;
}

function RoutePlaceholder({
  title,
  question,
  detail = 'This route is ready for its feature implementation.',
  live = false,
}: RoutePlaceholderProps) {
  return (
    <View
      accessibilityLabel={`${title} screen`}
      accessibilityLiveRegion={live ? 'polite' : 'none'}
      testID="route-placeholder"
      style={styles.screen}
    >
      <Text accessibilityRole="header" style={[styles.text, styles.title]}>
        {title}
      </Text>
      {question ? <Text style={styles.text}>{question}</Text> : null}
      <Text style={styles.text}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: tokens.spacing[2],
    padding: tokens.layout.pageGutterCompact,
    paddingTop: tokens.spacing[16],
    backgroundColor: tokens.color.dark.canvas,
  },
  text: {
    color: tokens.color.dark.textSecondary,
    fontFamily: tokens.typography.family.bodyRegular,
  },
  title: {
    color: tokens.color.dark.textPrimary,
    fontFamily: tokens.typography.family.displayBold,
  },
});

export interface ItemDetailViewProps {
  readonly itemId?: string;
}

export interface PostDetailViewProps {
  readonly postId?: string;
}

export interface CreateListingViewProps {
  readonly itemId?: string;
}

export interface ListingDetailViewProps {
  readonly listingId?: string;
}

export interface ConversationViewProps {
  readonly conversationId?: string;
}

function routeEntityDetail(kind: string, id?: string): string {
  return id ? `${kind} route ready for ${id}.` : `${kind} route identifier is unavailable.`;
}

export function RootSessionView() {
  return <RoutePlaceholder title="SnapWorth" detail="Checking your session." live />;
}

export function CaptureView() {
  return <RoutePlaceholder title="Capture an item" question="What is this thing worth?" />;
}

export function ItemDetailView({ itemId }: ItemDetailViewProps) {
  return (
    <RoutePlaceholder
      title="Item estimate"
      question="What is it worth, and how much should I trust that?"
      detail={routeEntityDetail('Item', itemId)}
    />
  );
}

export function HistoryView() {
  return <RoutePlaceholder title="History" question="What have I already checked?" />;
}

export function FeedView() {
  return <RoutePlaceholder title="Feed" question="Does the community think this price is right?" />;
}

export function PostDetailView({ postId }: PostDetailViewProps) {
  return (
    <RoutePlaceholder
      title="Post"
      question="What do people actually think, and why?"
      detail={routeEntityDetail('Post', postId)}
    />
  );
}

export function CreateListingView({ itemId }: CreateListingViewProps) {
  return (
    <RoutePlaceholder
      title="Create listing"
      question="What am I actually asking for it?"
      detail={routeEntityDetail('Item', itemId)}
    />
  );
}

export function MarketplaceView() {
  return <RoutePlaceholder title="Marketplace" question="Is there something here I want?" />;
}

export function ListingDetailView({ listingId }: ListingDetailViewProps) {
  return (
    <RoutePlaceholder
      title="Listing"
      question="Is this worth buying, and is the price fair?"
      detail={routeEntityDetail('Listing', listingId)}
    />
  );
}

export function ConversationView({ conversationId }: ConversationViewProps) {
  return (
    <RoutePlaceholder
      title="Conversation"
      question="What are we agreeing on?"
      detail={routeEntityDetail('Conversation', conversationId)}
    />
  );
}
