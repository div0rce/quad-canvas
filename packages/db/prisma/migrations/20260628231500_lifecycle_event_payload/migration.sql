-- Expand the per-canvas event stream so lifecycle facts can share the same authoritative sequence.
-- Existing pixel rows retain coordinates; lifecycle rows use payload and null coordinates/colors.
ALTER TABLE "pixel_events" ALTER COLUMN "x" DROP NOT NULL;
ALTER TABLE "pixel_events" ALTER COLUMN "y" DROP NOT NULL;
ALTER TABLE "pixel_events" ADD COLUMN "payload" JSONB;
