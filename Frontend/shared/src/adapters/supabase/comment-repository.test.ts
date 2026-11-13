import { createSupabaseCommentRepository } from './comment-repository';

describe('createSupabaseCommentRepository', () => {
  it('maps author_display_name from comment_thread RPC and insert response', async () => {
    const client = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'usr_1' } } }, error: null }),
      },
      rpc: async () => ({
        data: [
          {
            id: '00000000-0000-4000-c000-000000000001',
            parent_id: null,
            parent_hidden: false,
            body: 'Looks fair.',
            moderation_status: 'approved',
            created_at: '2026-11-10T10:00:00.000Z',
            author_id: 'usr_2',
            author_handle: 'user_a1b2c3d4e5',
            author_display_name: 'Maya Reyes',
            author_avatar_url: null,
            is_mine: false,
            reported_by_me: false,
          },
        ],
        error: null,
      }),
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: 'post_1' }, error: null }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: {
                id: '00000000-0000-4000-c000-000000000002',
                parent_id: null,
                body: 'Agreed!',
                moderation_status: 'pending',
                created_at: '2026-11-10T10:05:00.000Z',
                author_id: 'usr_1',
                author: {
                  handle: 'user_1122334455',
                  display_name: 'Ivan Cruz',
                  avatar_url: null,
                },
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    const repo = createSupabaseCommentRepository(client as never);
    const thread = await repo.listThread('retro-windbreaker');
    expect(thread.ok).toBe(true);
    if (thread.ok) {
      expect(thread.value[0]?.author).toEqual({
        userId: 'usr_2',
        handle: 'user_a1b2c3d4e5',
        displayName: 'Maya Reyes',
        avatarUrl: undefined,
      });
    }

    const inserted = await repo.insert({
      postKey: 'retro-windbreaker',
      body: 'Agreed!',
    });
    expect(inserted.ok).toBe(true);
    if (inserted.ok) {
      expect(inserted.value.author).toEqual({
        userId: 'usr_1',
        handle: 'user_1122334455',
        displayName: 'Ivan Cruz',
        avatarUrl: undefined,
      });
    }
  });
});
