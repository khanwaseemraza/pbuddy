-- Add a terminal 'cancelled' state to the booking lifecycle (used when a sender
-- or traveller calls off a booking before pickup). ALTER TYPE ... ADD VALUE must
-- run outside an explicit transaction block, so no BEGIN/COMMIT here.
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cancelled';
