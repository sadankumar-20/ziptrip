import { z } from 'zod';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(8787),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_SSL: bool.default(true),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    /** Comma-separated list of origins allowed to call the API with cookies. */
    WEB_ORIGIN: z.string().default('http://localhost:5173'),
    /** Number of proxies in front of the API (Render/Railway/Fly = 1). Needed for correct client IPs in rate limiting. */
    TRUST_PROXY: z.coerce.number().default(1),

    STORAGE_DRIVER: z.enum(['supabase', 'cloudinary', 'local']).default('local'),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_BUCKET: z.string().default('media'),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    LOCAL_UPLOAD_DIR: z.string().default('uploads'),
    PUBLIC_API_URL: z.string().default('http://localhost:8787'),

    PAYMENTS_ENABLED: bool.default(false),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((e, ctx) => {
    if (e.STORAGE_DRIVER === 'supabase' && (!e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY))
      ctx.addIssue({ code: 'custom', message: 'STORAGE_DRIVER=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' });
    if (e.STORAGE_DRIVER === 'cloudinary' && (!e.CLOUDINARY_CLOUD_NAME || !e.CLOUDINARY_API_KEY || !e.CLOUDINARY_API_SECRET))
      ctx.addIssue({ code: 'custom', message: 'STORAGE_DRIVER=cloudinary needs the three CLOUDINARY_* values' });
    if (e.PAYMENTS_ENABLED && (!e.RAZORPAY_KEY_ID || !e.RAZORPAY_KEY_SECRET || !e.RAZORPAY_WEBHOOK_SECRET))
      ctx.addIssue({ code: 'custom', message: 'PAYMENTS_ENABLED=true needs RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET' });
    if (e.NODE_ENV === 'production' && e.STORAGE_DRIVER === 'local')
      ctx.addIssue({ code: 'custom', message: 'Use supabase or cloudinary storage in production; local disk is wiped on redeploy' });
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${msg}`);
  }
  return parsed.data;
}
