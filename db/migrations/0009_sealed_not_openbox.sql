-- Sealed-package model (PBD-137, counsel-mandated). Per legal advice, requiring
-- the carrier to OPEN and inspect the parcel gives them "knowledge" of the
-- contents and erodes the innocent-carrier defence. The safer model is:
-- sealed package + sender contents declaration + carrier RIGHT TO REFUSE.
-- So we drop the structural open-box-before-pickup gate.
DROP TRIGGER IF EXISTS bookings_enforce_open_box ON bookings;
DROP FUNCTION IF EXISTS enforce_open_box_before_pickup();
