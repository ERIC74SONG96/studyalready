-- Bucket public pour les images des fiches bourses (complète la migration 016).
-- Idempotent : sans erreur si le bucket existe déjà.

INSERT INTO storage.buckets (id, name, public)
SELECT 'scholarship-offers', 'scholarship-offers', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'scholarship-offers');
