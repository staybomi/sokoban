import { createClient } from '@supabase/supabase-js';

/*
 * Supabase 연동 — 사과 인벤토리를 새로고침 후에도 유지하기 위한 얇은 래퍼.
 * URL / anon key 는 Vite 환경변수(.env, VITE_ 접두사 필수)로 주입한다.
 * 키가 없으면 client 를 null 로 두어, 게임은 저장 없이도 정상 동작한다(오프라인 폴백).
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  url && anonKey ? createClient(url, anonKey) : null;

// 게임에 로그인이 없으므로 사과 개수는 단일 전역 행(id=1)에 담는다.
const ITEM_ID = 1;

// 저장된 사과 개수를 읽어온다. 실패하거나 미설정이면 0.
export async function loadApples() {
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase
      .from('item')
      .select('apple')
      .eq('id', ITEM_ID)
      .maybeSingle();
    if (error) {
      console.warn('[supabase] 사과 불러오기 실패:', error.message);
      return 0;
    }
    return data?.apple ?? 0;
  } catch (e) {
    console.warn('[supabase] 사과 불러오기 예외:', e);
    return 0;
  }
}

// 현재 사과 개수를 저장(upsert)한다. 미설정이면 아무것도 하지 않는다.
export async function saveApples(count) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('item')
      .upsert({ id: ITEM_ID, apple: count }, { onConflict: 'id' });
    if (error) console.warn('[supabase] 사과 저장 실패:', error.message);
  } catch (e) {
    console.warn('[supabase] 사과 저장 예외:', e);
  }
}
