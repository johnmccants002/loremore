import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { createMomentRepository } from '@/moments/repository';
import { TodayScreen } from '@/moments/TodayScreen';

const repository = supabase ? createMomentRepository(supabase) : null;
export default function Screen() {
  const { session } = useAuth();
  if (!repository || !session) return null;
  return <TodayScreen key={session.user.id} userId={session.user.id} repository={repository} />;
}
