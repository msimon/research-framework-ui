import { createBrowserClient } from '@supabase/ssr';

import { publicConfig } from '@/shared/config/public.config';
import type { Database } from '@/shared/lib/supabase/supabase.types';

const supabaseUrl = publicConfig.supabase.url;
const supabaseKey = publicConfig.supabase.publishableKey;

export const createClient = () => createBrowserClient<Database>(supabaseUrl, supabaseKey);

export const supabaseClient = createClient();
