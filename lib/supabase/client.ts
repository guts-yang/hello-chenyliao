type SupabaseBrowserClient = {
  auth: {
    signOut: () => Promise<{ error: null }>;
  };
};

export function createSupabaseBrowserClient(): SupabaseBrowserClient {
  return {
    auth: {
      signOut: async () => ({ error: null }),
    },
  };
}
