-- meme_history pasa de guardar solo memes (imagen obligatoria) a poder
-- guardar también contenido bíblico (sin imagen). Aditiva: no borra ni
-- recrea la tabla, no toca los registros existentes (ya tienen image_url).

ALTER TABLE "public"."meme_history"
ALTER COLUMN "image_url" DROP NOT NULL;
