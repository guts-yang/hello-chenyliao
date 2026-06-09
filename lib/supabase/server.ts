import 'server-only';

type SupabaseLike = {
  auth: {
    getUser: () => Promise<{ data: { user: null }; error: null }>;
  };
  from: (table: string) => SupabaseQuery;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<SupabaseResult>;
  storage: {
    from: (bucket: string) => {
      createSignedUploadUrl: (path: string) => Promise<{
        data: { signedUrl: string; path: string; token: string; uploadUrl: string };
        error: SupabaseError | null;
      }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};

type SupabaseError = { message: string };
type SupabaseData = Array<Record<string, unknown>> & {
  count?: number;
};
type SupabaseResult = {
  data: SupabaseData | null;
  error: SupabaseError | null;
  count?: number | null;
};

type SupabaseQuery = PromiseLike<SupabaseResult> & {
  select: (columns?: string, options?: { count?: string; head?: boolean }) => SupabaseQuery;
  eq: (column: string, value: unknown) => SupabaseQuery;
  order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => SupabaseQuery;
  limit: (count: number) => SupabaseQuery;
  insert: (value: unknown) => Promise<SupabaseResult>;
  update: (value: unknown) => SupabaseQuery;
  upsert: (value: unknown) => Promise<SupabaseResult>;
  delete: () => SupabaseQuery;
  maybeSingle: () => Promise<SupabaseResult>;
};

function createQuery(): SupabaseQuery {
  const result: SupabaseResult = { data: null, error: null, count: 0 };
  const query: SupabaseQuery = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    insert: async () => result,
    update: () => query,
    upsert: async () => result,
    delete: () => query,
    maybeSingle: async () => result,
    then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
  };

  return query;
}

function createNoopClient(): SupabaseLike {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    from: () => createQuery(),
    rpc: async () => ({ data: null, error: null, count: 0 }),
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path) => ({
          data: { signedUrl: '', path, token: '', uploadUrl: '' },
          error: null,
        }),
        getPublicUrl: (path) => ({ data: { publicUrl: path } }),
      }),
    },
  };
}

export function createSupabaseAnonClient(): SupabaseLike | null {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ? createNoopClient() : null;
}

export function createSupabaseAdminClient(): SupabaseLike | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? createNoopClient() : null;
}

export function createSupabaseServerClient(): SupabaseLike | null {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ? createNoopClient() : null;
}
