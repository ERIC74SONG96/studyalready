/**
 * Table public.user_site_context : déclaration à l'inscription (Belgique / hors + mode étudiant/pro + persona).
 * Aucune vérification documentaire imposée — personnalisation de l'UI et ciblage des contenus.
 */
const PERSONAS = ['cameroun', 'belgique_etudiant', 'travailleur', 'visiteur'];

function normalizePersona(p) {
  const v = String(p || '').trim();
  return PERSONAS.indexOf(v) !== -1 ? v : 'cameroun';
}

/** Comptes sans signup_location dans les métadonnées Auth (avant cette évolution). */
export function inferSiteContextFromPersona(persona) {
  const p = normalizePersona(persona);
  if (p === 'belgique_etudiant') {
    return { signup_location: 'belgique', signup_be_mode: 'etudiant', espace_persona: p };
  }
  if (p === 'travailleur') {
    return { signup_location: 'belgique', signup_be_mode: 'pro', espace_persona: p };
  }
  if (p === 'visiteur') {
    return { signup_location: 'hors', signup_be_mode: null, espace_persona: p };
  }
  return { signup_location: 'hors', signup_be_mode: null, espace_persona: 'cameroun' };
}

export function buildSiteContextFromUser(user) {
  const um = (user && user.user_metadata) || {};
  const persona = normalizePersona(um.espace_persona);
  const locMeta = um.signup_location;
  const modeMeta = um.signup_be_mode;

  if (locMeta === 'belgique' || locMeta === 'hors') {
    let mode = null;
    if (locMeta === 'belgique') {
      if (modeMeta === 'pro' || modeMeta === 'etudiant') mode = modeMeta;
      else mode = inferSiteContextFromPersona(persona).signup_be_mode;
    }
    return {
      user_id: user.id,
      signup_location: locMeta,
      signup_be_mode: mode,
      espace_persona: persona,
    };
  }
  const inf = inferSiteContextFromPersona(persona);
  return {
    user_id: user.id,
    signup_location: inf.signup_location,
    signup_be_mode: inf.signup_be_mode,
    espace_persona: inf.espace_persona,
  };
}

/**
 * Crée ou met à jour la ligne user_site_context pour l'utilisateur courant.
 * Ne bloque pas l'UX en cas d'erreur (migration absente, RLS, etc.).
 */
export async function syncUserSiteContextRow(sb, user) {
  if (!sb || !user || !user.id) return { ok: false, skipped: true };
  const row = buildSiteContextFromUser(user);
  try {
    const { error } = await sb.from('user_site_context').upsert(
      {
        user_id: row.user_id,
        signup_location: row.signup_location,
        signup_be_mode: row.signup_be_mode,
        espace_persona: row.espace_persona,
      },
      { onConflict: 'user_id' }
    );
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}
