// supabaseService.js
// Frontend Supabase client — reads articles from DB, triggers edge function

import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

// ─── Read articles from DB ────────────────────────────────────────────────────

export async function fetchArticlesFromDB() {
  const { data, error } = await supabase
    .from('articles')
    .select('url, title, description, image, published_at, source, source_priority, tag, summary, title_ar, summary_ar')
    .order('published_at', { ascending: false })
    .limit(400)

  if (error) throw new Error(error.message)

  return (data || []).map(a => ({
    id:          a.url,
    url:         a.url,
    title:       a.title || '',
    description: a.description || '',
    image:       a.image || null,
    publishedAt: a.published_at || null,
    source:      a.source || '',
    sourcePriority: a.source_priority || '',
    tag:         a.tag || null,
    summary:     a.summary || a.description || '',
    title_ar:    a.title_ar || null,
    summary_ar:  a.summary_ar || null,
  }))
}

// ─── Admin: trigger server-side fetch ────────────────────────────────────────

export async function triggerFetchNews(adminPassword) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-news`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key':  adminPassword,
    },
    body: JSON.stringify({}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// ─── Admin: DB stats ─────────────────────────────────────────────────────────

export async function getDBStats() {
  const [{ count }, { data: tagRows }, { data: logRows }] = await Promise.all([
    supabase.from('articles').select('*', { count: 'exact', head: true }),
    supabase.from('articles').select('tag'),
    supabase.from('fetch_log').select('ran_at, stored, ai_tagged, status, error_msg').order('ran_at', { ascending: false }).limit(5),
  ])

  const byTag = {}
  ;(tagRows || []).forEach(a => {
    const t = a.tag || 'Untagged'
    byTag[t] = (byTag[t] || 0) + 1
  })

  return {
    total:   count || 0,
    byTag,
    recentRuns: logRows || [],
  }
}
