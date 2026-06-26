-- Compensating events (e.g. PixelRolledBack) may revert a cell to empty, which has no color.
-- Relax the NOT NULL on pixel_events.new_color so those events can carry a null reverted color.
ALTER TABLE "pixel_events" ALTER COLUMN "new_color" DROP NOT NULL;
