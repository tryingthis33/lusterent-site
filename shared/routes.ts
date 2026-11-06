import { z } from 'zod';
import { insertWebsiteSchema, insertInvestmentInquirySchema, insertBlogPostSchema, insertJobOpeningSchema, insertCreditApplicationSchema, creditApplicationSubmissionSchema, enrollBuilderSchema, generateMetro2Schema, simulateSpendingSchema, makePaymentSchema, adminUpdateCreditApplicationSchema, adminUpdateCreditAccountSchema, websites, investmentInquiries, companySettings, blogPosts, jobOpenings, creditAccounts, creditTransactions, creditMemberships, creditStatements, metro2Reports, creditAuditLog, creditDisputes, type PublicCreditApplication, type AdminCreditApplication } from './schema';

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  role: z.string(),
  createdAt: z.coerce.date().nullable(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export const api = {
  websites: {
    list: {
      method: 'GET' as const,
      path: '/api/websites',
      responses: {
        200: z.array(z.custom<typeof websites.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/websites',
      input: insertWebsiteSchema,
      responses: {
        201: z.custom<typeof websites.$inferSelect>(),
      }
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/websites/:id',
      input: insertWebsiteSchema.partial(),
      responses: {
        200: z.custom<typeof websites.$inferSelect>(),
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/websites/:id',
      responses: {
        204: z.void(),
      }
    }
  },
  settings: {
    list: {
      method: 'GET' as const,
      path: '/api/settings',
      responses: {
        200: z.array(z.custom<typeof companySettings.$inferSelect>()),
      }
    },
    update: {
      method: 'POST' as const,
      path: '/api/settings',
      input: z.object({ key: z.string(), value: z.string() }),
      responses: {
        200: z.custom<typeof companySettings.$inferSelect>(),
      }
    }
  },
  investments: {
    create: {
      method: 'POST' as const,
      path: '/api/investments',
      input: insertInvestmentInquirySchema,
      responses: {
        201: z.custom<typeof investmentInquiries.$inferSelect>(),
      },
    },
  },
  blogPosts: {
    list: {
      method: 'GET' as const,
      path: '/api/blog-posts',
      responses: {
        200: z.array(z.custom<typeof blogPosts.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/blog-posts',
      input: insertBlogPostSchema,
      responses: {
        201: z.custom<typeof blogPosts.$inferSelect>(),
      }
    }
  },
  lentCredit: {
    submitApplication: {
      method: 'POST' as const,
      path: '/api/lent-credit/applications',
      input: creditApplicationSubmissionSchema,
      responses: {
        201: z.custom<PublicCreditApplication>(),
      },
    },
    enrollBuilder: {
      method: 'POST' as const,
      path: '/api/lent-credit/enroll-builder',
      input: enrollBuilderSchema,
      responses: {
        201: z.custom<typeof creditMemberships.$inferSelect>(),
      },
    },
    myMembership: {
      method: 'GET' as const,
      path: '/api/lent-credit/my-membership',
      responses: {
        200: z.custom<typeof creditMemberships.$inferSelect | null>(),
      },
    },
    myStatements: {
      method: 'GET' as const,
      path: '/api/lent-credit/my-statements',
      responses: {
        200: z.array(z.custom<typeof creditStatements.$inferSelect>()),
      },
    },
    myApplication: {
      method: 'GET' as const,
      path: '/api/lent-credit/my-application',
      responses: {
        200: z.custom<PublicCreditApplication | null>(),
      },
    },
    myAccount: {
      method: 'GET' as const,
      path: '/api/lent-credit/my-account',
      responses: {
        200: z.custom<typeof creditAccounts.$inferSelect | null>(),
      },
    },
    myTransactions: {
      method: 'GET' as const,
      path: '/api/lent-credit/my-transactions',
      responses: {
        200: z.array(z.custom<typeof creditTransactions.$inferSelect>()),
      },
    },
    simulateSpending: {
      method: 'POST' as const,
      path: '/api/lent-credit/simulate-spending',
      input: simulateSpendingSchema,
      responses: {
        201: z.custom<typeof creditTransactions.$inferSelect>(),
      },
    },
    makePayment: {
      method: 'POST' as const,
      path: '/api/lent-credit/make-payment',
      input: makePaymentSchema,
      responses: {
        200: z.custom<typeof creditTransactions.$inferSelect>(),
        201: z.custom<typeof creditTransactions.$inferSelect>(),
      },
    },
    adminListApplications: {
      method: 'GET' as const,
      path: '/api/lent-credit/admin/applications',
      responses: { 200: z.array(z.custom<AdminCreditApplication>()) },
    },
    adminUpdateApplication: {
      method: 'PATCH' as const,
      path: '/api/lent-credit/admin/applications/:id',
      input: adminUpdateCreditApplicationSchema,
      responses: { 200: z.custom<AdminCreditApplication>() },
    },
    adminListAccounts: {
      method: 'GET' as const,
      path: '/api/lent-credit/admin/accounts',
      responses: { 200: z.array(z.custom<typeof creditAccounts.$inferSelect>()) },
    },
    adminUpdateAccount: {
      method: 'PATCH' as const,
      path: '/api/lent-credit/admin/accounts/:id',
      input: adminUpdateCreditAccountSchema,
      responses: { 200: z.custom<typeof creditAccounts.$inferSelect>() },
    },
    adminListTransactions: {
      method: 'GET' as const,
      path: '/api/lent-credit/admin/transactions',
      responses: { 200: z.array(z.custom<typeof creditTransactions.$inferSelect>()) },
    },
    adminListMemberships: {
      method: 'GET' as const,
      path: '/api/lent-credit/admin/memberships',
      responses: { 200: z.array(z.custom<typeof creditMemberships.$inferSelect>()) },
    },
    adminGenerateStatements: {
      method: 'POST' as const,
      path: '/api/lent-credit/admin/generate-statements',
      responses: { 200: z.custom<{ generated: number }>() },
    },
    adminGenerateMetro2: {
      method: 'POST' as const,
      path: '/api/lent-credit/admin/metro2/generate',
      input: generateMetro2Schema,
      responses: { 201: z.custom<typeof metro2Reports.$inferSelect>() },
    },
    adminListMetro2: {
      method: 'GET' as const,
      path: '/api/lent-credit/admin/metro2',
      responses: { 200: z.array(z.custom<typeof metro2Reports.$inferSelect>()) },
    },
    adminGetMetro2: {
      method: 'GET' as const,
      path: '/api/lent-credit/admin/metro2/:id',
      responses: { 200: z.custom<typeof metro2Reports.$inferSelect>() },
    },
    adminTransmitMetro2: {
      method: 'POST' as const,
      path: '/api/lent-credit/admin/metro2/:id/transmit',
      responses: { 200: z.custom<typeof metro2Reports.$inferSelect>() },
    },
    adminListAuditLog: {
      method: 'GET' as const,
      path: '/api/lent-credit/admin/audit-log',
      responses: { 200: z.array(z.custom<typeof creditAuditLog.$inferSelect>()) },
    },
    adminListDisputes: {
      method: 'GET' as const,
      path: '/api/lent-credit/admin/disputes',
      responses: { 200: z.array(z.custom<typeof creditDisputes.$inferSelect>()) },
    },
  },
  admin: {
    me: {
      method: 'GET' as const,
      path: '/api/admin/me',
      responses: { 200: z.object({ isAdmin: z.boolean() }) },
    },
    listUsers: {
      method: 'GET' as const,
      path: '/api/admin/users',
      responses: { 200: z.array(adminUserSchema) },
    },
    updateUserRole: {
      method: 'PATCH' as const,
      path: '/api/admin/users/:id/role',
      input: updateUserRoleSchema,
      responses: { 200: adminUserSchema },
    },
  },
  jobOpenings: {
    list: {
      method: 'GET' as const,
      path: '/api/job-openings',
      responses: {
        200: z.array(z.custom<typeof jobOpenings.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/job-openings',
      input: insertJobOpeningSchema,
      responses: {
        201: z.custom<typeof jobOpenings.$inferSelect>(),
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
