-- Allow comment-only reviews (stars can be null)
ALTER TABLE ratings ALTER COLUMN stars DROP NOT NULL;

-- Track which page Carrie feedback was submitted from
ALTER TABLE feedback ADD COLUMN page_url text;
