// Relocalise les fichiers Storage historiques (non préfixés par company_id)
// sous le dossier de l'entreprise par défaut, et met à jour les références en base.
//
// Pré-requis : clé SERVICE ROLE (contourne la RLS). Ne JAMAIS committer cette clé.
//
// Usage (bash) :
//   SUPABASE_URL="https://xxxx.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
//   node scripts/migrate-storage-tenant.mjs            # exécution réelle
//   node scripts/migrate-storage-tenant.mjs --dry      # simulation (aucun changement)
//
// Usage (PowerShell) :
//   $env:SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
//   node scripts/migrate-storage-tenant.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY = process.argv.includes('--dry')
const BUCKET = 'documents'
const DEFAULT_COMPANY = '00000000-0000-0000-0000-000000000001'
const LEGACY_PREFIXES = ['cni', 'photos', 'logos', 'employees']

if (!URL || !KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.')
  process.exit(1)
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

// Colonnes DB référençant des chemins Storage (table, colonne).
const REFS = [
  ['access_logs', 'photo_url'],
  ['access_logs', 'cni_url'],
  ['employees', 'photo_url'],
  ['company_settings', 'logo_url'],
]

async function listFiles(prefix) {
  const files = []
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000, offset })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const entry of data) {
      if (entry.id) files.push(`${prefix}/${entry.name}`) // id non-null = fichier
    }
    if (data.length < 1000) break
    offset += 1000
  }
  return files
}

async function updateRefs(oldPath, newPath) {
  let updated = 0
  for (const [table, col] of REFS) {
    // Référence sous forme de chemin nu
    const a = await supabase.from(table).update({ [col]: newPath }).eq(col, oldPath).select('id')
    if (!a.error && a.data) updated += a.data.length
    // Référence sous forme d'ancienne URL publique (.../documents/<oldPath>)
    const b = await supabase
      .from(table)
      .update({ [col]: newPath })
      .like(col, `%/${BUCKET}/${oldPath}`)
      .select('id')
    if (!b.error && b.data) updated += b.data.length
  }
  return updated
}

async function main() {
  console.log(`${DRY ? '🔎 SIMULATION' : '🚚 MIGRATION'} — bucket "${BUCKET}" → dossier ${DEFAULT_COMPANY}/\n`)
  let moved = 0
  let refs = 0

  for (const prefix of LEGACY_PREFIXES) {
    const files = await listFiles(prefix)
    if (files.length === 0) continue
    console.log(`📁 ${prefix}/ — ${files.length} fichier(s)`)
    for (const oldPath of files) {
      const newPath = `${DEFAULT_COMPANY}/${oldPath}`
      if (DRY) {
        console.log(`   • ${oldPath}  →  ${newPath}`)
        continue
      }
      const { error } = await supabase.storage.from(BUCKET).move(oldPath, newPath)
      if (error) {
        console.warn(`   ⚠️  échec déplacement ${oldPath}: ${error.message}`)
        continue
      }
      moved++
      const n = await updateRefs(oldPath, newPath)
      refs += n
      console.log(`   ✓ ${oldPath}  (${n} réf. mises à jour)`)
    }
  }

  console.log(
    `\n${DRY ? 'Simulation terminée.' : `✅ Terminé — ${moved} fichier(s) déplacé(s), ${refs} référence(s) mises à jour.`}`,
  )
}

main().catch((e) => {
  console.error('❌ Erreur :', e)
  process.exit(1)
})
