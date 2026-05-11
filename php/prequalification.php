<?php
/**
 * StudyAlready — Pré-qualification de dossier (formulaire long)
 * Envoie un email structuré à l'équipe pour analyse avant premier contact.
 */

declare(strict_types=1);

const DESTINATAIRE = 'studyalready8@gmail.com';
const EXPEDITEUR   = 'no-reply@studyalready.com';
const SUJET_PREFIX = '[StudyAlready] Pré-qualification dossier — ';

header('Content-Type: application/json; charset=utf-8');

function reponse(int $code, string $message, bool $ok = false): void {
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reponse(405, 'Méthode non autorisée.');
}

if (!empty($_POST['website'] ?? '')) {
    reponse(200, 'Merci.', true);
}

function cleanLine(string $s): string {
    $s = trim($s);
    $s = strip_tags($s);
    $s = str_replace(["\r", "\n"], ' ', $s);
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function cleanText(string $s, int $maxLen): string {
    $s = trim($s);
    $s = strip_tags($s);
    if (mb_strlen($s) > $maxLen) {
        $s = mb_substr($s, 0, $maxLen);
    }
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function field(string $key, string $default = ''): string {
    return cleanLine($_POST[$key] ?? $default);
}

function fieldText(string $key, int $max, string $default = ''): string {
    return cleanText($_POST[$key] ?? $default, $max);
}

$nom           = field('nom_complet');
$email         = trim($_POST['email'] ?? '');
$tel           = field('telephone_whatsapp');
$ville         = field('ville_pays');
$dateNaissance = field('date_naissance');
$nationalite   = field('nationalite');

$diplomeType   = field('diplome_type');
$diplomeAutre  = field('diplome_autre');
$etablissement = field('etablissement_cam');
$anneeDiplome  = field('annee_diplome');
$mention       = field('mention_ou_grade');
$filiere       = fieldText('filiere_suivie', 2000);
$matieres      = fieldText('matieres_principales', 1500);

$formationVisee = fieldText('formation_visee_belgique', 2000);
$etabsEnvisages = fieldText('etablissements_envisages', 1500);
$rentree        = field('annee_rentree_souhaitee');
$statutEquiv    = field('statut_equivalence');

$docsCopies     = isset($_POST['doc_copies']) ? 'Oui' : 'Non';
$docsOriginaux  = isset($_POST['doc_originaux']) ? 'Oui' : 'Non';
$docsReleves    = isset($_POST['doc_releves']) ? 'Oui' : 'Non';
$docsTrad       = isset($_POST['doc_traductions']) ? 'Oui' : 'Non';
$docsMotiv      = isset($_POST['doc_motivation']) ? 'Oui' : 'Non';

$niveauFr       = field('niveau_francais');
$contactFwb     = field('deja_contact_fwb');
$delai          = field('delai_urgence');
$budget         = field('budget_approximatif');
$chargeFamille  = fieldText('personnes_a_charge', 800);
$questions      = fieldText('questions_supplementaires', 4000);

$consent = $_POST['consent_rgpd'] ?? '';

if ($nom === '' || $email === '' || $tel === '' || $ville === '') {
    reponse(400, 'Merci de remplir les coordonnées obligatoires (nom, email, téléphone, ville/pays).');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    reponse(400, 'Adresse email invalide.');
}

if (preg_match('/[\r\n]/', $email) || preg_match('/[\r\n]/', $nom)) {
    reponse(400, 'Caractères non autorisés détectés.');
}

if ($diplomeType === '' || $etablissement === '' || $anneeDiplome === '' || $filiere === '' || $formationVisee === '' || $rentree === '' || $statutEquiv === '' || $niveauFr === '') {
    reponse(400, 'Merci de compléter toutes les sections obligatoires du parcours académique et du projet.');
}

if (!preg_match('/^\d{4}$/', $anneeDiplome)) {
    reponse(400, "L'année du diplôme doit être au format AAAA (ex. 2023).");
}
$y = (int) $anneeDiplome;
if ($y < 1990 || $y > (int) date('Y') + 1) {
    reponse(400, "Année de diplôme hors plage plausible (1990 — " . ((int) date('Y') + 1) . ").");
}

if ($consent !== '1') {
    reponse(400, 'Vous devez accepter le traitement de vos données pour envoyer ce formulaire.');
}

if (mb_strlen($filiere) < 15) {
    reponse(400, 'Décrivez un peu plus votre filière / parcours (au moins 15 caractères).');
}

if (mb_strlen($formationVisee) < 15) {
    reponse(400, 'Précisez davantage votre formation visée en Belgique (au moins 15 caractères).');
}

$sujet = SUJET_PREFIX . $nom;

$corps  = "=== PRÉ-QUALIFICATION DOSSIER — StudyAlready ===\n\n";
$corps .= "Date : " . date('d/m/Y H:i') . "\n";
$corps .= "IP   : " . ($_SERVER['REMOTE_ADDR'] ?? 'inconnue') . "\n";
$corps .= str_repeat('=', 60) . "\n\n";

$corps .= "--- 1. Coordonnées ---\n";
$corps .= "Nom complet        : {$nom}\n";
$corps .= "Email              : {$email}\n";
$corps .= "WhatsApp / tél.     : {$tel}\n";
$corps .= "Ville / pays       : {$ville}\n";
$corps .= "Date de naissance  : " . ($dateNaissance ?: 'Non renseignée') . "\n";
$corps .= "Nationalité        : " . ($nationalite ?: 'Non renseignée') . "\n\n";

$corps .= "--- 2. Diplôme Cameroun ---\n";
$corps .= "Type de diplôme    : {$diplomeType}\n";
if ($diplomeAutre !== '') {
    $corps .= "Précision (autre)  : {$diplomeAutre}\n";
}
$corps .= "Établissement      : {$etablissement}\n";
$corps .= "Année d'obtention  : {$anneeDiplome}\n";
$corps .= "Mention / résultat : " . ($mention ?: 'Non renseigné') . "\n";
$corps .= "Filière / parcours :\n{$filiere}\n\n";
$corps .= "Matières principales :\n" . ($matieres ?: '—') . "\n\n";

$corps .= "--- 3. Projet Belgique (FWB) ---\n";
$corps .= "Formation visée    :\n{$formationVisee}\n\n";
$corps .= "Établissements envisagés :\n" . ($etabsEnvisages ?: '—') . "\n\n";
$corps .= "Rentrée souhaitée  : {$rentree}\n";
$corps .= "Statut équivalence : {$statutEquiv}\n";
$corps .= "Déjà contacté FWB  : " . ($contactFwb ?: 'Non précisé') . "\n";
$corps .= "Délai / urgence    : " . ($delai ?: 'Non précisé') . "\n\n";

$corps .= "--- 4. Documents disponibles ---\n";
$corps .= "Copies certifiées  : {$docsCopies}\n";
$corps .= "Originaux en main  : {$docsOriginaux}\n";
$corps .= "Relevés complets   : {$docsReleves}\n";
$corps .= "Traductions FR     : {$docsTrad}\n";
$corps .= "Lettre motivation  : {$docsMotiv}\n\n";

$corps .= "--- 5. Langue & situation ---\n";
$corps .= "Niveau de français : {$niveauFr}\n";
$corps .= "Budget approximatif: " . ($budget ?: 'Non communiqué') . "\n";
$corps .= "Situation familiale / contraintes :\n" . ($chargeFamille ?: '—') . "\n\n";

$corps .= "--- 6. Questions complémentaires ---\n";
$corps .= ($questions ?: '—') . "\n\n";

$corps .= "--- Consentement ---\n";
$corps .= "RGPD : accepté (case cochée)\n";

$headers   = [];
$headers[] = 'From: StudyAlready <' . EXPEDITEUR . '>';
$headers[] = 'Reply-To: ' . $email;
$headers[] = 'X-Mailer: PHP/' . phpversion();
$headers[] = 'Content-Type: text/plain; charset=UTF-8';

$envoyé = @mail(DESTINATAIRE, $sujet, $corps, implode("\r\n", $headers));

if (!$envoyé) {
    reponse(500, "Impossible d'envoyer le formulaire. Écrivez à studyalready8@gmail.com.");
}

reponse(200, 'Votre pré-qualification a bien été envoyée. Nous revenons vers vous sous 48 h ouvrées.', true);
