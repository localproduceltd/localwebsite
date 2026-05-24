-- Add featured flag for pinning reviews to homepage
ALTER TABLE ratings  ADD COLUMN featured boolean NOT NULL DEFAULT false;
ALTER TABLE feedback ADD COLUMN featured boolean NOT NULL DEFAULT false;
