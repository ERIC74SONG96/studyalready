<?php
/**
 * StudyAlready - Traitement du formulaire de contact
 * Compatible avec l'hébergement LWS (PHP 7.4+ / 8.x).
 *
 * À configurer :
 *   - DESTINATAIRE : boîte qui reçoit réellement les messages (ex. studyalready8@gmail.com).
 *                     Le site peut afficher contact@studyalready.com au public.
 *   - EXPEDITEUR   : doit être une adresse de votre domaine (ex. no-reply@studyalready.com)
 *
 * Sécurité incluse :
 *   - Vérification de méthode HTTP
 *   - Honeypot anti-bot (champ "website")
 *   - Validation et nettoyage des entrées
 *   - Protection contre l'injection d'en-têtes
 */

declare(strict_types=1);

// ============== CONFIGURATION ==============
const DESTINATAIRE = 'studyalready8@gmail.com';
const EXPEDITEUR   = 'no-reply@studyalready.com';
const SUJET_PREFIX = '[StudyAlready] Nouvelle demande - ';

// ============== HEADERS DE REPONSE ==============
header('Content-Type: application/json; charset=utf-8');

function reponse(int $code, string $message, bool $ok = false): void {
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

// ============== METHODE HTTP ==============
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reponse(405, 'Méthode non autorisée.');
}

// ============== HONEYPOT ANTI-BOT ==============
if (!empty($_POST['website'] ?? '')) {
    // Bot détecté : on simule un succès pour ne pas alerter
    reponse(200, 'Merci.', true);
}

// ============== RECUPERATION ET NETTOYAGE ==============
function clean(string $s): string {
    $s = trim($s);
    $s = strip_tags($s);
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

$nom       = clean($_POST['nom']        ?? '');
$email     = trim($_POST['email']       ?? '');
$telephone = clean($_POST['telephone']  ?? '');
$service   = clean($_POST['service']    ?? 'Non précisé');
$message   = clean($_POST['message']    ?? '');

// ============== VALIDATION ==============
if ($nom === '' || $email === '' || $message === '') {
    reponse(400, 'Merci de remplir tous les champs obligatoires.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    reponse(400, 'Adresse email invalide.');
}

if (mb_strlen($message) < 10 || mb_strlen($message) > 5000) {
    reponse(400, 'Le message doit contenir entre 10 et 5000 caractères.');
}

// Protection contre l'injection d'en-têtes via le champ email
if (preg_match('/[\r\n]/', $email) || preg_match('/[\r\n]/', $nom)) {
    reponse(400, 'Caractères non autorisés détectés.');
}

// ============== CONSTRUCTION DE L'EMAIL ==============
$sujet = SUJET_PREFIX . $service;

$corps  = "Nouvelle demande reçue via le site StudyAlready :\n\n";
$corps .= "Nom        : {$nom}\n";
$corps .= "Email      : {$email}\n";
$corps .= "WhatsApp   : " . ($telephone ?: 'Non renseigné') . "\n";
$corps .= "Service    : {$service}\n";
$corps .= "Date       : " . date('d/m/Y H:i') . "\n";
$corps .= "IP         : " . ($_SERVER['REMOTE_ADDR'] ?? 'inconnue') . "\n";
$corps .= str_repeat('-', 50) . "\n\n";
$corps .= "Message :\n{$message}\n";

$headers   = [];
$headers[] = 'From: StudyAlready <' . EXPEDITEUR . '>';
$headers[] = 'Reply-To: ' . $email;
$headers[] = 'X-Mailer: PHP/' . phpversion();
$headers[] = 'Content-Type: text/plain; charset=UTF-8';

// ============== ENVOI ==============
$envoyé = @mail(DESTINATAIRE, $sujet, $corps, implode("\r\n", $headers));

if (!$envoyé) {
    reponse(500, "Impossible d'envoyer le message. Merci d'écrire directement à contact@studyalready.com.");
}

reponse(200, 'Message envoyé avec succès !', true);
