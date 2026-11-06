
-- Agregar las seis emociones nuevas al enum existente

ALTER TYPE "public"."emotion"
ADD VALUE IF NOT EXISTS 'NEGATIVE_SURPRISE';

ALTER TYPE "public"."emotion"
ADD VALUE IF NOT EXISTS 'CONTEMPT';

ALTER TYPE "public"."emotion"
ADD VALUE IF NOT EXISTS 'FRUSTRATION';

ALTER TYPE "public"."emotion"
ADD VALUE IF NOT EXISTS 'CONFUSION';

ALTER TYPE "public"."emotion"
ADD VALUE IF NOT EXISTS 'SHAME';

ALTER TYPE "public"."emotion"
ADD VALUE IF NOT EXISTS 'BOREDOM';
