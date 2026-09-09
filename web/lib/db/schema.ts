import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerifiedAt: timestamp('email_verified_at'),
  passwordHash: text('password_hash').notNull(),
  sessionVersion: integer('session_version').notNull().default(0),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

export const teamMembers = pgTable(
  'team_members',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    role: varchar('role', { length: 50 }).notNull(),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (table) => ({
    userTeamUnique: uniqueIndex('team_members_user_team_unique').on(table.userId, table.teamId),
    userIdIdx: index('team_members_user_id_idx').on(table.userId),
  })
);

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const friendInvites = pgTable('friend_invites', {
  id: serial('id').primaryKey(),
  inviterUserId: integer('inviter_user_id')
    .notNull()
    .references(() => users.id),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastGeneratedAt: timestamp('last_generated_at').notNull().defaultNow(),
});

export const friendInviteRedemptions = pgTable(
  'friend_invite_redemptions',
  {
    id: serial('id').primaryKey(),
    inviteId: integer('invite_id')
      .notNull()
      .references(() => friendInvites.id),
    invitedUserId: integer('invited_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    invitedUserIdUnique: uniqueIndex('friend_invite_redemptions_invited_user_id_unique').on(table.invitedUserId),
  })
);

export const friendInviteRewards = pgTable(
  'friend_invite_rewards',
  {
    id: serial('id').primaryKey(),
    redemptionId: integer('redemption_id')
      .notNull()
      .references(() => friendInviteRedemptions.id),
    inviterUserId: integer('inviter_user_id')
      .notNull()
      .references(() => users.id),
    invitedUserId: integer('invited_user_id')
      .notNull()
      .references(() => users.id),
    checkoutSessionId: text('checkout_session_id').notNull(),
    invitedSubscriptionId: text('invited_subscription_id').notNull(),
    stripeCustomerId: text('stripe_customer_id'),
    stripeCreditBalanceTransactionId: text('stripe_credit_balance_transaction_id'),
    amount: integer('amount'),
    currency: varchar('currency', { length: 10 }),
    status: varchar('status', { length: 40 }).notNull().default('pending'),
    error: text('error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    redemptionIdUnique: uniqueIndex('friend_invite_rewards_redemption_id_unique').on(table.redemptionId),
  })
);

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  tokenHash: text('token_hash').notNull().unique(),
  codeHash: text('code_hash'),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  usedAt: timestamp('used_at'),
}, (table) => ({
  userCreatedIdx: index('email_verification_tokens_user_created_idx').on(table.userId, table.createdAt),
}));

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  email: varchar('email', { length: 255 }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  sessionVersion: integer('session_version').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  usedAt: timestamp('used_at'),
}, (table) => ({
  userCreatedIdx: index('password_reset_tokens_user_created_idx').on(table.userId, table.createdAt),
}));

export const userSettings = pgTable(
  'user_settings',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    senderName: text('sender_name'),
    region: text('region'),
    school: text('school'),
    emailSignature: text('email_signature'),
    introStyle: varchar('intro_style', { length: 40 }).notNull().default('student'),
    targetRole: text('target_role'),
    emailTone: varchar('email_tone', { length: 40 }).notNull().default('warm'),
    outreachLength: varchar('outreach_length', { length: 40 }).notNull().default('concise'),
    outreachGoal: varchar('outreach_goal', { length: 40 }).notNull().default('advice'),
    outreachStyleNotes: text('outreach_style_notes'),
    defaultSearchPreferences: jsonb('default_search_preferences')
      .notNull()
      .default({}),
    senderProfile: text('sender_profile'),
    resumeContext: text('resume_context'),
    resumeFileName: text('resume_file_name'),
    resumeUploadedAt: timestamp('resume_uploaded_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdUnique: uniqueIndex('user_settings_user_id_unique').on(table.userId),
  })
);

export const extensionApiTokens = pgTable(
  'extension_api_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 100 }).notNull().default('Chrome extension'),
    tokenHash: text('token_hash').notNull().unique(),
    lastUsedAt: timestamp('last_used_at'),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    activeUserUnique: uniqueIndex('extension_api_tokens_active_user_unique')
      .on(table.userId)
      .where(sql`${table.revokedAt} is null`),
  })
);

export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    amount: integer('amount').notNull(),
    action: text('action').notNull(),
    requestId: text('request_id'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userCreatedAtIdx: index('credit_ledger_user_created_at_idx').on(table.userId, table.createdAt),
    freeTrialUnique: uniqueIndex('credit_ledger_free_trial_unique').on(table.userId)
      .where(sql`${table.action} = 'trial.initial_grant'`),
    requestUnique: uniqueIndex('credit_ledger_user_action_request_unique')
      .on(table.userId, table.action, table.requestId)
      .where(sql`${table.requestId} is not null`),
    initialSubscriptionUnique: uniqueIndex('credit_ledger_initial_subscription_unique')
      .on(sql`(${table.metadata}->>'subscriptionId')`)
      .where(sql`${table.action} = 'subscription.initial_grant'`),
    monthlyInvoiceUnique: uniqueIndex('credit_ledger_monthly_invoice_unique')
      .on(sql`(${table.metadata}->>'invoiceId')`)
      .where(sql`${table.action} = 'subscription.monthly_grant'`),
  })
);

export const freeTrialClaims = pgTable('free_trial_claims', {
  emailFingerprint: text('email_fingerprint').primaryKey(),
  userId: integer('user_id').notNull().unique().references(() => users.id),
  searches: integer('searches').notNull().default(0),
  revealAttempts: integer('reveal_attempts').notNull().default(0),
  drafts: integer('drafts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authRateLimits = pgTable('auth_rate_limits', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull(),
  resetsAt: timestamp('resets_at', { withTimezone: true }).notNull(),
}, table => ({ expiryIdx: index('auth_rate_limits_expiry_idx').on(table.resetsAt) }));

export const apiUsage = pgTable(
  'api_usage',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    requestId: text('request_id'),
    credits: integer('credits').notNull().default(0),
    status: varchar('status', { length: 40 }).notNull(),
    request: jsonb('request').notNull().default({}),
    response: jsonb('response').notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userCreatedAtIdx: index('api_usage_user_created_at_idx').on(table.userId, table.createdAt),
    successfulRequestUnique: uniqueIndex('api_usage_successful_request_unique')
      .on(table.userId, table.action, table.requestId)
      .where(sql`${table.requestId} is not null and ${table.status} = 'success'`),
  })
);

export const apiIdempotencyKeys = pgTable(
  'api_idempotency_keys',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    key: varchar('idempotency_key', { length: 120 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('processing'),
    response: jsonb('response').notNull().default({}),
    error: text('error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userActionKeyUnique: uniqueIndex('api_idempotency_keys_user_action_key_unique').on(
      table.userId,
      table.action,
      table.key
    ),
    updatedAtIdx: index('api_idempotency_keys_updated_at_idx').on(table.updatedAt),
  })
);

export const productEvents = pgTable('product_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  event: varchar('event', { length: 80 }).notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const stripeWebhookEvents = pgTable('stripe_webhook_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  processed: boolean('processed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
  emailVerificationTokens: many(emailVerificationTokens),
  friendInvitesSent: many(friendInvites),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const emailVerificationTokensRelations = relations(
  emailVerificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerificationTokens.userId],
      references: [users.id],
    }),
  })
);

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

export const friendInvitesRelations = relations(friendInvites, ({ one, many }) => ({
  inviter: one(users, {
    fields: [friendInvites.inviterUserId],
    references: [users.id],
  }),
  redemptions: many(friendInviteRedemptions),
}));

export const friendInviteRedemptionsRelations = relations(friendInviteRedemptions, ({ one }) => ({
  invite: one(friendInvites, {
    fields: [friendInviteRedemptions.inviteId],
    references: [friendInvites.id],
  }),
  invitedUser: one(users, {
    fields: [friendInviteRedemptions.invitedUserId],
    references: [users.id],
  }),
}));

export const friendInviteRewardsRelations = relations(friendInviteRewards, ({ one }) => ({
  redemption: one(friendInviteRedemptions, {
    fields: [friendInviteRewards.redemptionId],
    references: [friendInviteRedemptions.id],
  }),
  inviter: one(users, {
    fields: [friendInviteRewards.inviterUserId],
    references: [users.id],
  }),
  invitedUser: one(users, {
    fields: [friendInviteRewards.invitedUserId],
    references: [users.id],
  }),
}));

export const extensionApiTokensRelations = relations(
  extensionApiTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [extensionApiTokens.userId],
      references: [users.id],
    }),
  })
);

export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
  user: one(users, {
    fields: [creditLedger.userId],
    references: [users.id],
  }),
}));

export const apiUsageRelations = relations(apiUsage, ({ one }) => ({
  user: one(users, {
    fields: [apiUsage.userId],
    references: [users.id],
  }),
}));

export const productEventsRelations = relations(productEvents, ({ one }) => ({
  user: one(users, {
    fields: [productEvents.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type FriendInvite = typeof friendInvites.$inferSelect;
export type FriendInviteRedemption = typeof friendInviteRedemptions.$inferSelect;
export type FriendInviteReward = typeof friendInviteRewards.$inferSelect;
export type EmailVerificationToken =
  typeof emailVerificationTokens.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type ExtensionApiToken = typeof extensionApiTokens.$inferSelect;
export type CreditLedger = typeof creditLedger.$inferSelect;
export type ApiUsage = typeof apiUsage.$inferSelect;
export type ApiIdempotencyKey = typeof apiIdempotencyKeys.$inferSelect;
export type ProductEvent = typeof productEvents.$inferSelect;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}
