import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { createMomentRepository } from '@/moments/repository';
import { MomentDetail } from '@/moments/MomentDetail';
const repository = supabase ? createMomentRepository(supabase) : null;
export default function MomentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  if (!session || !repository || !id) return null;
  return <MomentDetail key={`${session.user.id}/${id}`} id={id} userId={session.user.id} repository={repository} goBack={() => router.replace('/')} />;
}
