import test from 'node:test';
import assert from 'node:assert/strict';

import {
  persistUserAvatarUrl,
  pickSupportedProfileFields
} from '../api/_user-profile.js';

test('pickSupportedProfileFields keeps only columns present in the live profile row', () => {
  const filtered = pickSupportedProfileFields(
    {
      full_name: 'Pascal Wagner',
      phone: '9417308700',
      avatar_url: 'https://example.com/avatar.png',
      investable_capital: '$250K - $1M'
    },
    {
      id: 'user-1',
      full_name: 'Pascal',
      phone: null,
      email: 'info@pascalwagner.com'
    }
  );

  assert.deepEqual(filtered, {
    full_name: 'Pascal Wagner',
    phone: '9417308700'
  });
});

test('persistUserAvatarUrl falls back to auth metadata when the profile row lacks avatar_url', async () => {
  let metadataUpdatePayload = null;

  const admin = {
    from() {
      throw new Error('profile update should not run when avatar_url is unsupported');
    },
    auth: {
      admin: {
        async getUserById(userId) {
          assert.equal(userId, 'user-1');
          return {
            data: {
              user: {
                user_metadata: {
                  full_name: 'Pascal Wagner'
                }
              }
            },
            error: null
          };
        },
        async updateUserById(userId, payload) {
          assert.equal(userId, 'user-1');
          metadataUpdatePayload = payload;
          return { error: null };
        }
      }
    }
  };

  const result = await persistUserAvatarUrl({
    admin,
    userId: 'user-1',
    avatarUrl: 'https://cdn.example.com/avatar.png',
    profileRecord: {
      id: 'user-1',
      email: 'info@pascalwagner.com',
      full_name: 'Pascal Wagner'
    }
  });

  assert.equal(result.profilePersisted, false);
  assert.equal(result.metadataPersisted, true);
  assert.equal(result.profileRecord?.id, 'user-1');
  assert.deepEqual(metadataUpdatePayload, {
    user_metadata: {
      full_name: 'Pascal Wagner',
      avatar_url: 'https://cdn.example.com/avatar.png'
    }
  });
});

test('persistUserAvatarUrl updates both profile storage and auth metadata when avatar_url exists', async () => {
  let profileUpdatePayload = null;
  let metadataUpdatePayload = null;

  const admin = {
    from(table) {
      assert.equal(table, 'user_profiles');
      return {
        update(payload) {
          profileUpdatePayload = payload;
          return {
            eq(column, value) {
              assert.equal(column, 'id');
              assert.equal(value, 'user-1');
              return {
                select() {
                  return {
                    async maybeSingle() {
                      return {
                        data: {
                          id: 'user-1',
                          email: 'info@pascalwagner.com',
                          avatar_url: payload.avatar_url
                        },
                        error: null
                      };
                    }
                  };
                }
              };
            }
          };
        }
      };
    },
    auth: {
      admin: {
        async getUserById() {
          return {
            data: {
              user: {
                user_metadata: {
                  full_name: 'Pascal Wagner'
                }
              }
            },
            error: null
          };
        },
        async updateUserById(userId, payload) {
          assert.equal(userId, 'user-1');
          metadataUpdatePayload = payload;
          return { error: null };
        }
      }
    }
  };

  const result = await persistUserAvatarUrl({
    admin,
    userId: 'user-1',
    avatarUrl: 'https://cdn.example.com/avatar.png',
    profileRecord: {
      id: 'user-1',
      email: 'info@pascalwagner.com',
      avatar_url: null
    }
  });

  assert.deepEqual(profileUpdatePayload, {
    avatar_url: 'https://cdn.example.com/avatar.png'
  });
  assert.equal(result.profilePersisted, true);
  assert.equal(result.metadataPersisted, true);
  assert.equal(result.profileRecord?.avatar_url, 'https://cdn.example.com/avatar.png');
  assert.deepEqual(metadataUpdatePayload, {
    user_metadata: {
      full_name: 'Pascal Wagner',
      avatar_url: 'https://cdn.example.com/avatar.png'
    }
  });
});
