-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "emotion" AS ENUM ('HAPPY', 'SAD', 'ANGRY', 'TIRED', 'NEUTRAL', 'FEARFUL', 'SURPRISED', 'DISGUSTED');

-- CreateEnum
CREATE TYPE "emotion_source" AS ENUM ('CAMERA', 'MANUAL');

-- CreateEnum
CREATE TYPE "media_type" AS ENUM ('MOVIE', 'TV');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "display_name" VARCHAR(120),
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emotion_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emotion" "emotion" NOT NULL,
    "source" "emotion_source" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emotion_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emotion_record_id" UUID NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "media_type" "media_type" NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "overview" TEXT,
    "poster_path" TEXT,
    "backdrop_path" TEXT,
    "release_date" DATE,
    "vote_average" DOUBLE PRECISION,
    "position" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "media_type" "media_type" NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "poster_path" TEXT,
    "release_date" DATE,
    "vote_average" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meme_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emotion_record_id" UUID,
    "provider" VARCHAR(100) NOT NULL,
    "external_id" VARCHAR(255),
    "title" VARCHAR(300),
    "image_url" TEXT NOT NULL,
    "content_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meme_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emotion_records_user_id_created_at_idx" ON "emotion_records"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "emotion_records_id_user_id_key" ON "emotion_records"("id", "user_id");

-- CreateIndex
CREATE INDEX "recommendations_user_id_created_at_idx" ON "recommendations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "recommendations_emotion_record_id_idx" ON "recommendations"("emotion_record_id");

-- CreateIndex
CREATE INDEX "recommendations_tmdb_id_media_type_idx" ON "recommendations"("tmdb_id", "media_type");

-- CreateIndex
CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_tmdb_id_media_type_key" ON "favorites"("user_id", "tmdb_id", "media_type");

-- CreateIndex
CREATE INDEX "meme_history_user_id_created_at_idx" ON "meme_history"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "meme_history_emotion_record_id_idx" ON "meme_history"("emotion_record_id");

-- AddForeignKey
ALTER TABLE "emotion_records" ADD CONSTRAINT "emotion_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_emotion_record_id_user_id_fkey" FOREIGN KEY ("emotion_record_id", "user_id") REFERENCES "emotion_records"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meme_history" ADD CONSTRAINT "meme_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meme_history" ADD CONSTRAINT "meme_history_emotion_record_id_fkey" FOREIGN KEY ("emotion_record_id") REFERENCES "emotion_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Link profiles with Supabase Auth users
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_auth_user_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;
